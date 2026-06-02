package webrtc

import "sync"

type Room struct {
	ID    string
	Peers map[string]*Peer
}

type RoomManager struct {
	Rooms map[string]*Room
	mu    sync.RWMutex
}

func NewRoomManager() *RoomManager {
	return &RoomManager{
		Rooms: make(map[string]*Room),
	}
}

func (rm *RoomManager) AddPeer(roomID string, peer *Peer) {
	rm.mu.Lock()
	defer rm.mu.Unlock()

	room, ok := rm.Rooms[roomID]
	if !ok {
		room = &Room{
			ID:    roomID,
			Peers: make(map[string]*Peer),
		}
		rm.Rooms[roomID] = room
	}

	room.Peers[peer.ID] = peer
}

func (rm *RoomManager) RemovePeer(roomID, peerID string) {
	rm.mu.Lock()
	defer rm.mu.Unlock()

	room, ok := rm.Rooms[roomID]
	if !ok {
		return
	}
	delete(room.Peers, peerID)

	if len(room.Peers) == 0 {
		delete(rm.Rooms, roomID)
	}
}

func (rm *RoomManager) GetPeer(roomID string, peerID string) *Peer {
	rm.mu.RLock()
	defer rm.mu.RUnlock()

	room, ok := rm.Rooms[roomID]
	if !ok {
		return nil
	}

	return room.Peers[peerID]
}

func (rm *RoomManager) BroadcastExcept(roomID string, senderID string, msg Message) {
	rm.mu.RLock()
	defer rm.mu.RUnlock()

	room, ok := rm.Rooms[roomID]
	if !ok {
		return
	}

	for id, peer := range room.Peers {
		if id == senderID {
			continue
		}

		select {
		case peer.Send <- msg:
		default:
		}
	}
}
