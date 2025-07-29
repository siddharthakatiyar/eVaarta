package ws

import "encoding/json"

type Message struct {
    Type      string          `json:"type"`                // e.g. "join", "offer", "chat"
    Room      string          `json:"room"`                // room ID
    From      string          `json:"from"`                // sender ID
    To        string          `json:"to,omitempty"`        // target ID for signaling
    SDP       json.RawMessage `json:"sdp,omitempty"`       // for offer/answer
    Candidate json.RawMessage `json:"candidate,omitempty"` // for ICE candidate
    Clients   []string        `json:"clients,omitempty"`   // for welcome message
    Text      string          `json:"text,omitempty"`      // for chat messages
}
