package ws

type Message struct {
	Type    string      `json:"type"`    // "join", "offer", "answer", "ice", "leave"
	Room    string      `json:"room"`
	Sender  string      `json:"sender"`
	Target  string      `json:"target"`  // optional (for direct messages)
	Payload interface{} `json:"payload"`
	 // actual SDP / ICE data
}
