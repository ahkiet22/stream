package main

import (
	"log"

	"github.com/ahkiet22/stream/webrtc"
	"github.com/gofiber/contrib/websocket"
	"github.com/gofiber/fiber/v2"
)

func main() {
	app := fiber.New()
	roomManager := webrtc.NewRoomManager()

	app.Get("/", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"message": "WebRTC signaling server is running",
		})
	})

	app.Use("/ws", func(c *fiber.Ctx) error {
		if websocket.IsWebSocketUpgrade(c) {
			return c.Next()
		}

		return fiber.ErrUpgradeRequired
	})

	app.Get("/ws", websocket.New(webrtc.SignalingHandler(roomManager)))

	log.Println("Server running on :8080")
	log.Fatal(app.Listen(":8080"))
}
