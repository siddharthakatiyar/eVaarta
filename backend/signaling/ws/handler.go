package ws

import (
	"log"
	"net/http"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
    CheckOrigin: func(r *http.Request) bool {
        return true
    },
}

var rooms = make(map[string]map[string]*Client)
// Example: rooms["room1"]["user1"] = *Client


func HandleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("Upgrade failed:", err)
		return
	}

	client := &Client{
		Conn: conn,
		Send: make(chan []byte),
	}
	go client.WriteMessages()
	client.ReadMessages()
	
}