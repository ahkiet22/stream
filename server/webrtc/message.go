package webrtc

type Message struct {
	Type   string `json:"type"`
	RoomID string `json:"roomId,omitempty"`
	From   string `json:"from,omitempty"`
	To     string `json:"to,omitempty"`
	Data   any    `json:"data,omitempty"`
}
