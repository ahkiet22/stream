package webrtc

import "github.com/gofiber/contrib/websocket"

type Peer struct {
	ID     string
	RoomID string
	Conn   *websocket.Conn
	Send   chan Message
}
