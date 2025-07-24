package ws

import (
	"encoding/json"
	"log"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

/* ------------------------------------------------------------------ */
/*                             Client type                             */
/* ------------------------------------------------------------------ */

type Client struct {
	ID   string
	Room string
	Conn *websocket.Conn
	Send chan []byte       // buffered in handler.go (recommend 256)
	once sync.Once
}

/* ------------------------------------------------------------------ */
/*                        Message read-pump                            */
/* ------------------------------------------------------------------ */

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

		/* ------------------------- join ------------------------- */
		case "join":
			c.ID, c.Room = msg.Sender, msg.Room

			// add to room map (thread-safe)
			rmu.Lock()
			if rooms[c.Room] == nil {
				rooms[c.Room] = make(map[string]*Client)
			}
			rooms[c.Room][c.ID] = c

			// snapshot of all peerIDs for welcome
			peerIDs := make([]string, 0, len(rooms[c.Room]))
			for id := range rooms[c.Room] {
				peerIDs = append(peerIDs, id)
			}
			rmu.Unlock()

			log.Printf("Client %s joined room %s", c.ID, c.Room)

			// 1. send 'welcome' to the joining client
			welcome := Message{
				Type:    "welcome",
				Room:    c.Room,
				Sender:  "server",
				Clients: peerIDs,
			}
			c.safeSend(marshal(welcome))

			// 2. notify existing peers
			c.broadcast(Message{
				Type:   "new-peer",
				Room:   c.Room,
				Sender: c.ID,
			})

		/* -------------- WebRTC signaling relay --------------- */
		case "offer", "answer", "candidate":
			if msg.Target == "" {
				log.Println("Missing target for", msg.Type)
				continue
			}
			rmu.RLock()
			target, ok := rooms[msg.Room][msg.Target]
			rmu.RUnlock()
			if !ok {
				log.Printf("Target %s not found in room %s", msg.Target, msg.Room)
				continue
			}
			target.safeSend(raw)

		/* -------------------------- leave -------------------------- */
		case "leave":
			c.cleanup()

		/* --------------------------- ping -------------------------- */
		case "ping":
			c.safeSend([]byte(`{"type":"pong"}`))

		default:
			log.Println("Unknown message type:", msg.Type)
		}
	}
}

/* ------------------------------------------------------------------ */
/*                        Message write-pump                           */
/* ------------------------------------------------------------------ */

func (c *Client) WriteMessages() {
	defer c.cleanup()

	// Optional: periodic ping to keep connection alive in production
	ticker := time.NewTicker(25 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case msg, ok := <-c.Send:
			if !ok {
				return // channel closed
			}
			c.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.Conn.WriteMessage(websocket.TextMessage, msg); err != nil {
				log.Printf("Write error (%s): %v", c.ID, err)
				return
			}

		case <-ticker.C:
			c.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.Conn.WriteMessage(websocket.PingMessage, []byte("ping")); err != nil {
				log.Printf("Ping error (%s): %v", c.ID, err)
				return
			}
		}
	}
}

/* ------------------------------------------------------------------ */
/*                            Helpers                                 */
/* ------------------------------------------------------------------ */

func (c *Client) safeSend(b []byte) {
	select {
	case c.Send <- b:
	default:
		log.Printf("Send buffer full; dropping message to %s", c.ID)
	}
}

func (c *Client) broadcast(m Message) {
	data := marshal(m)
	rmu.RLock()
	defer rmu.RUnlock()
	for id, peer := range rooms[c.Room] {
		if id != c.ID {
			peer.safeSend(data)
		}
	}
}

/* ------------------------------------------------------------------ */
/*                           Cleanup                                  */
/* ------------------------------------------------------------------ */

func (c *Client) cleanup() {
	c.once.Do(func() {
		rmu.Lock()
		if rc, ok := rooms[c.Room]; ok {
			delete(rc, c.ID)
			if len(rc) == 0 {
				delete(rooms, c.Room)
			} else {
				exitMsg := Message{Type: "peer-left", Room: c.Room, Sender: c.ID}
				for _, p := range rc {
					p.safeSend(marshal(exitMsg))
				}
			}
		}
		rmu.Unlock()

		close(c.Send)
		c.Conn.Close()
	})
}

/* ------------------------------------------------------------------ */
/*                  JSON marshal helper with fallback                 */
/* ------------------------------------------------------------------ */

func marshal(m Message) []byte {
	b, err := json.Marshal(m)
	if err != nil {
		log.Println("Marshal error:", err)
		return []byte("{}")
	}
	return b
}
