package ws

import "encoding/json"

type Message struct {
    Type    string            `json:"type"`
    Room    string            `json:"room"`
    Sender  string            `json:"from"`
    Target  string            `json:"to,omitempty"`
    SDP     json.RawMessage   `json:"sdp,omitempty"`
    Candidate json.RawMessage `json:"candidate,omitempty"`
    Clients []string          `json:"clients,omitempty"`
}
