package ws

import (
	"log"
	"net/http"
	"sync"

	"github.com/gorilla/websocket"
)

/* ---------------------------- Upgrader & Globals --------------------------- */

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

var (
	rooms = make(map[string]map[string]*Client) // rooms[roomID][clientID] = *Client
	rmu   sync.RWMutex                          // guards rooms map
)

/* ------------------------------- HTTP Entry -------------------------------- */

func HandleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("Upgrade failed:", err)
		return
	}

	client := &Client{
		Conn: conn,
		Send: make(chan []byte, 16), // buffered to avoid blocking
	}

	go client.WriteMessages()
	go client.ReadMessages()
}
