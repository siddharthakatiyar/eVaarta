package ws

import "encoding/json"

// Message – canonical structure for every payload exchanged.
type Message struct {
	Type   string          `json:"type"`             // join, offer, answer, ice, reconnect, leave, ping
	Room   string          `json:"room"`             // room identifier
	Sender string          `json:"sender"`           // sender/client ID
	Target string          `json:"target,omitempty"` // target ID (for direct messages)
	Data   json.RawMessage `json:"data,omitempty"`   // SDP / ICE data or custom payload
}
