package main

import (
    "fmt"
    "log"
    "net/http"
    "github.com/siddharthakatiyar/evaarta/backend/signaling/ws"
)

func main() {
    http.HandleFunc("/ws", ws.HandleWebSocket)

    fmt.Println("✅ Signaling server running on http://localhost:8080/ws")
    log.Fatal(http.ListenAndServe(":8080", nil))
}
