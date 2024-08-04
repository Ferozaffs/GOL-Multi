package main

import (
	"bytes"
	"encoding/binary"
	"fmt"
	"math/rand"
	"net/http"
	"time"

	"github.com/gorilla/websocket"
)

const (
	surfaceWidth  = 128
	surfaceHeight = 128
)

type Coord struct {
	x int
	y int
}

var offsets = []Coord{
	{x: -1, y: -1},
	{x: 0, y: -1},
	{x: 1, y: -1},
	{x: -1, y: 0},
	{x: 1, y: 0},
	{x: -1, y: 1},
	{x: 0, y: 1},
	{x: 1, y: 1},
}

var gameState = make([]bool, surfaceWidth*surfaceHeight)

var connections = []*websocket.Conn{}

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

func handleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		fmt.Println(err)
		return
	}
	defer conn.Close()

	connections = append(connections, conn)

	err = conn.WriteMessage(websocket.TextMessage, []byte("Server connection response"))
	if err != nil {
		fmt.Println("Error writing:", err)
		return
	}

	for {
		_, message, err := conn.ReadMessage()
		if err != nil {
			fmt.Println("Read error:", err)
			return
		}
		fmt.Printf("Received: %s\n", message)
		conn.SetReadDeadline(time.Now().Add(10 * time.Second))
	}
}

func boolArrayToPackedUint(boolArray []bool) []uint64 {
	size := (len(boolArray) + 63) / 64
	packed := make([]uint64, size)
	for i, v := range boolArray {
		if v {
			idx := i / 64
			bit := i % 64
			packed[idx] |= (1 << bit)
		}
	}
	return packed
}

func sendFullSync() {
	packed := boolArrayToPackedUint(gameState)
	var buf bytes.Buffer
	for _, value := range packed {
		err := binary.Write(&buf, binary.LittleEndian, value)
		if err != nil {
			fmt.Println("binary.Write failed:", err)
			return
		}
	}

	activeConnections := []*websocket.Conn{}
	for _, c := range connections {
		err := c.WriteMessage(websocket.BinaryMessage, buf.Bytes())
		if err == nil {
			activeConnections = append(activeConnections, c)
		}
	}

	connections = activeConnections
}

func reset() {
	for i := 0; i < surfaceHeight; i++ {
		for j := 0; j < surfaceWidth; j++ {
			idx := (j*surfaceHeight + i)
			if rand.Int()%20 == 0 {
				gameState[idx] = true
			} else {
				gameState[idx] = false
			}
		}
	}
}

func update() {
	for i := 0; i < surfaceHeight; i++ {
		for j := 0; j < surfaceWidth; j++ {
			idx := (i*surfaceWidth + j)
			alive := gameState[idx]
			neighbors := 0

			for _, c := range offsets {
				nx := j + c.x
				if nx < 0 {
					nx += surfaceWidth
				} else if nx >= surfaceWidth {
					nx -= surfaceWidth
				}

				ny := i + c.y
				if ny < 0 {
					ny += surfaceHeight
				} else if ny >= surfaceHeight {
					ny -= surfaceHeight
				}

				if gameState[(ny*surfaceWidth + nx)] {
					neighbors++
				}
			}

			if alive {
				if neighbors < 2 || neighbors > 3 {
					gameState[idx] = false
				}
			} else {
				if neighbors == 3 {
					gameState[idx] = true
				}
			}
		}
	}
}

func main() {
	//Full sync routine
	reset()

	updateTick := time.NewTicker(50 * time.Millisecond)
	syncTick := time.NewTicker(50 * time.Millisecond)
	resetTick := time.NewTicker(60 * time.Second)
	go func() {
		for {
			select {
			case <-updateTick.C:
				update()
			case <-syncTick.C:
				sendFullSync()
			case <-resetTick.C:
				reset()
			}
		}
	}()

	http.HandleFunc("/", handleWebSocket)
	if err := http.ListenAndServe(":8080", nil); err != nil {
		fmt.Println(err)
	}
}
