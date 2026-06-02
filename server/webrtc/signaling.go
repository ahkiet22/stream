package webrtc

import (
	"log"

	"github.com/gofiber/contrib/websocket"
)

func SignalingHandler(roomManager *RoomManager) func(*websocket.Conn) {
	return func(conn *websocket.Conn) {
		peerID := conn.Query("peerId")
		roomID := conn.Query("roomId")

		if peerID == "" || roomID == "" {
			_ = conn.WriteJSON(Message{
				Type: EventError,
				Data: "peerId and roomId are required",
			})
			_ = conn.Close()
			return
		}

		peer := &Peer{
			ID:     peerID,
			RoomID: roomID,
			Conn:   conn,
			Send:   make(chan Message, 16),
		}

		roomManager.AddPeer(roomID, peer)

		roomManager.BroadcastExcept(roomID, peerID, Message{
			Type:   EventPeerJoined,
			RoomID: roomID,
			From:   peerID,
		})

		go writePump(peer)

		readPump(peer, roomManager)
	}
}

func readPump(peer *Peer, roomManager *RoomManager) {
	defer func() {
		roomManager.RemovePeer(peer.RoomID, peer.ID)

		roomManager.BroadcastExcept(peer.RoomID, peer.ID, Message{
			Type:   EventPeerLeft,
			RoomID: peer.RoomID,
			From:   peer.ID,
		})

		close(peer.Send)
		_ = peer.Conn.Close()
	}()

	for {
		var msg Message

		if err := peer.Conn.ReadJSON(&msg); err != nil {
			log.Println("read error:", err)
			break
		}

		msg.From = peer.ID
		msg.RoomID = peer.RoomID

		switch msg.Type {
		case EventOffer, EventAnswer, EventICECandidate:
			if msg.To != "" {
				target := roomManager.GetPeer(peer.RoomID, msg.To)
				if target != nil {
					target.Send <- msg
				}
			} else {
				roomManager.BroadcastExcept(peer.RoomID, peer.ID, msg)
			}

		case EventLeave:
			return

		default:
			log.Println("unknown event:", msg.Type)
		}
	}
}

func writePump(peer *Peer) {
	for msg := range peer.Send {
		if err := peer.Conn.WriteJSON(msg); err != nil {
			log.Println("write error:", err)
			return
		}
	}
}
