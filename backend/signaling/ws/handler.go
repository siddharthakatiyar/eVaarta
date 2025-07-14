package ws

import (
    "fmt"
    "net/http"
    "sync"

    "github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
    CheckOrigin: func(r *http.Request) bool {
        return true
    },
}

var clients = make(map[*websocket.Conn]bool)
var mu sync.Mutex

func HandleWebSocket(w http.ResponseWriter, r *http.Request) {
    conn, err := upgrader.Upgrade(w, r, nil)
    if err != nil {
        fmt.Println("❌ Upgrade error:", err)
        return
    }
    fmt.Println("✅ Client connected:", conn.RemoteAddr())
    defer conn.Close()

    // 🔸 Send welcome message to this client
    conn.WriteMessage(websocket.TextMessage, []byte("👋 Welcome to eVaarta signaling server!"))

    mu.Lock()
    clients[conn] = true
    mu.Unlock()

    for {
        _, msg, err := conn.ReadMessage()
        if err != nil {
            fmt.Println("❌ Read error:", err)
            break
        }
        fmt.Println("📥 Message received:", string(msg))
        broadcast(msg, conn)
    }

    mu.Lock()
    delete(clients, conn)
    mu.Unlock()
}


func broadcast(message []byte, sender *websocket.Conn) {
    mu.Lock()
    defer mu.Unlock()

    fmt.Println("📨 Broadcasting:", string(message))
    for client := range clients {
        if client != sender {
            err := client.WriteMessage(websocket.TextMessage, message)
            if err != nil {
                fmt.Println("❌ Failed to send to client:", err)
            }
        }
    }
}
