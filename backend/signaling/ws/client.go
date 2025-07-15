package ws

import (
	"encoding/json"
	"log"
	
	"github.com/gorilla/websocket"
)

type Client struct {
	ID     string
	Room   string
	Conn   *websocket.Conn
	Send   chan []byte
}
func (c *Client) ReadMessages() {
	defer c.Conn.Close()

	for {
		_, msgBytes, err := c.Conn.ReadMessage()
		if err != nil {
			log.Println("Read error:", err)
			// break
			return
		}

		if len(msgBytes) == 0 {
			log.Println("Empty message received — skipping")
			continue
		}

		log.Println("Raw message:", string(msgBytes))

		var msg Message
		if err := json.Unmarshal(msgBytes, &msg); err != nil {
			log.Println("Invalid JSON:", err)
			continue
		}

		switch msg.Type {
		case "join":
			c.ID = msg.Sender
			c.Room = msg.Room

			if rooms[c.Room] == nil {
				rooms[c.Room] = make(map[string]*Client)
			}
			rooms[c.Room][c.ID] = c
			log.Printf("Client %s joined room %s", c.ID, c.Room)

		case "offer", "answer", "ice", "chat":
			if msg.Target == "" {
				log.Println("Missing target for message type:", msg.Type)
				continue
			}
			if roomClients, ok := rooms[msg.Room]; ok {
				if targetClient, ok := roomClients[msg.Target]; ok {
					select {
					case targetClient.Send <- msgBytes:
					default:
						log.Println("Send channel blocked for target:", msg.Target)
					}
				} else {
					log.Println("Target client not found:", msg.Target)
				}
			}

		case "leave":
			if roomClients, ok := rooms[c.Room]; ok {
				delete(roomClients, c.ID)
			}
		default:
			log.Println("Unknown message type:", msg.Type)
		}
	}
}


func (c *Client) WriteMessages() {
	defer c.Conn.Close()

	for msg := range c.Send {
		err := c.Conn.WriteMessage(websocket.TextMessage, msg)
		if err != nil {
			log.Println("Write error:", err)
			break
		}
	}
}
