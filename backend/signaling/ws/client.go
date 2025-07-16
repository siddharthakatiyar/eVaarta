package ws

import (
	"encoding/json"
	"log"
	"time"

	"github.com/gorilla/websocket"
)

/* ------------------------------ Client Model ------------------------------ */

type Client struct {
	ID   string
	Room string
	Conn *websocket.Conn
	Send chan []byte
}

/* ------------------------------- Read Pump -------------------------------- */

func (c *Client) ReadMessages() {
	defer c.cleanup()

	for {
		_, raw, err := c.Conn.ReadMessage()
		if err != nil {
			log.Printf("Read error (%s): %v", c.ID, err)
			return
		}
		if len(raw) == 0 {
			continue
		}

		var msg Message
		if err := json.Unmarshal(raw, &msg); err != nil {
			log.Println("Invalid JSON:", err)
			continue
		}

		switch msg.Type {

		/* --------------------------- JOIN / RECONNECT -------------------------- */
		case "join", "reconnect":
			c.ID, c.Room = msg.Sender, msg.Room
			rmu.Lock()
			if rooms[c.Room] == nil {
				rooms[c.Room] = make(map[string]*Client)
			}
			rooms[c.Room][c.ID] = c
			rmu.Unlock()
			log.Printf("Client %s joined room %s", c.ID, c.Room)

			if msg.Type == "reconnect" {
				// Inform peers so they can renegotiate streams
				c.broadcast(Message{Type: "peer-reconnected", Room: c.Room, Sender: c.ID})
			}

		/* ------------------------ CORE SIGNALING FLOW -------------------------- */
		case "offer", "answer", "ice":
			if msg.Target == "" {
				log.Println("Missing target for signaling")
				continue
			}
			rmu.RLock()
			target, ok := rooms[msg.Room][msg.Target]
			rmu.RUnlock()
			if ok {
				target.safeSend(raw)
			}

		/* ------------------------------- LEAVE --------------------------------- */
		case "leave":
			c.cleanup()

		/* ----------------------------- HEARTBEAT ------------------------------- */
		case "ping":
			c.safeSend([]byte(`{"type":"pong"}`))

		default:
			log.Println("Unknown message type:", msg.Type)
		}
	}
}

/* ------------------------------- Write Pump ------------------------------- */

func (c *Client) WriteMessages() {
	defer c.cleanup()
	for msg := range c.Send {
		if err := c.Conn.WriteMessage(websocket.TextMessage, msg); err != nil {
			log.Printf("Write error (%s): %v", c.ID, err)
			return
		}
	}
}

/* -------------------------------- Helpers --------------------------------- */

func (c *Client) safeSend(b []byte) {
	select {
	case c.Send <- b:
	default:
		log.Printf("Send buffer full; dropping message to %s", c.ID)
	}
}

func (c *Client) broadcast(m Message) {
	bytes, _ := json.Marshal(m)
	rmu.RLock()
	defer rmu.RUnlock()
	for id, peer := range rooms[c.Room] {
		if id != c.ID {
			peer.safeSend(bytes)
		}
	}
}

/* -------------------------------- Cleanup --------------------------------- */

func (c *Client) cleanup() {
	// Remove client from room & notify peers
	rmu.Lock()
	if rc, ok := rooms[c.Room]; ok {
		delete(rc, c.ID)
		if len(rc) == 0 {
			delete(rooms, c.Room)
		} else {
			leave, _ := json.Marshal(Message{Type: "peer-left", Room: c.Room, Sender: c.ID})
			for _, peer := range rc {
				peer.safeSend(leave)
			}
		}
	}
	rmu.Unlock()

	// Close resources
	close(c.Send)
	c.Conn.Close()

	// Ghost-client safety cleanup
	go func(room, id string) {
		time.Sleep(30 * time.Second)
		rmu.Lock()
		if rc, ok := rooms[room]; ok {
			delete(rc, id)
			if len(rc) == 0 {
				delete(rooms, room)
			}
		}
		rmu.Unlock()
	}(c.Room, c.ID)
}
