package main

import (
	"bytes"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/gorilla/websocket"
)

const (
	surfaceWidth  = 128
	surfaceHeight = 128
)

type Point struct {
	Alive   bool
	Changed bool
	Row     int
	Col     int
}

type PointData struct {
	Row   uint8
	Col   uint8
	Alive uint8
}

type Coord struct {
	x int
	y int
}

type ClientMessage struct {
	Type string
	Data interface{}
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

var gameState = make([]Point, surfaceWidth*surfaceHeight)

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

	buf, err := getFullSyncBuffer()
	if err != nil {
		err = conn.WriteMessage(websocket.TextMessage, []byte("Server error"))
		if err != nil {
			fmt.Println("Error writing:", err)
			return
		}
		return
	}
	conn.WriteMessage(websocket.BinaryMessage, buf.Bytes())

	for {
		_, message, err := conn.ReadMessage()
		if err != nil {
			fmt.Println("Read error:", err)
			return
		}

		var msg ClientMessage
		err = json.Unmarshal(message, &msg)
		if err != nil {
			log.Printf("Error unmarshalling JSON: %v", err)
			continue
		}

		if msg.Type == "points" {
			setJSONPoints(msg.Data)

			err = conn.WriteMessage(websocket.TextMessage, []byte("Points recieved"))
			if err != nil {
				fmt.Println("Error writing:", err)
				return
			}
		} else {
			err = conn.WriteMessage(websocket.TextMessage, []byte("Invalid request"))
			if err != nil {
				fmt.Println("Error writing:", err)
				return
			}
		}
	}
}

func setJSONPoints(data interface{}) {
	points, ok := data.([]interface{})

	if ok {
		for _, p := range points {
			pointMap, ok := p.(map[string]interface{})
			if ok {
				x, _ := pointMap["x"].(float64)
				y, _ := pointMap["y"].(float64)
				idx := int(x*surfaceWidth + y)
				gameState[idx].Alive = true
				gameState[idx].Changed = true
			}
		}
	}
}

func pointArrayToPackedUint(array []Point) []uint64 {
	size := (len(array) + 63) / 64
	packed := make([]uint64, size)
	for i, p := range array {
		if p.Alive {
			idx := i / 64
			bit := i % 64
			packed[idx] |= (1 << bit)
		}
	}
	return packed
}

func getFullSyncBuffer() (bytes.Buffer, error) {
	packed := pointArrayToPackedUint(gameState)
	var buf bytes.Buffer
	msgType := uint8(0)
	binary.Write(&buf, binary.LittleEndian, msgType)

	for _, value := range packed {
		err := binary.Write(&buf, binary.LittleEndian, value)
		if err != nil {
			fmt.Println("binary.Write failed:", err)
			return buf, err
		}
	}

	return buf, nil
}

func sendFullSync() {
	buf, err := getFullSyncBuffer()
	if err != nil {
		return
	}

	activeConnections := []*websocket.Conn{}
	for _, c := range connections {
		err := c.WriteMessage(websocket.BinaryMessage, buf.Bytes())
		if err == nil {
			activeConnections = append(activeConnections, c)
		}
	}

	connections = activeConnections

	for i := range gameState {
		gameState[i].Changed = false
	}
}

func sendChanged() {
	var buf bytes.Buffer
	msgType := uint8(1)
	err := binary.Write(&buf, binary.LittleEndian, msgType)
	if err != nil {
		fmt.Println("binary.Write failed:", err)
		return
	}

	for i, p := range gameState {
		if p.Changed {
			pointData := PointData{}
			pointData.Col = uint8(p.Col)
			pointData.Row = uint8(p.Row)
			if p.Alive {
				pointData.Alive = uint8(1)
			} else {
				pointData.Alive = uint8(0)
			}

			gameState[i].Changed = false

			err := binary.Write(&buf, binary.LittleEndian, pointData)
			if err != nil {
				fmt.Println("binary.Write failed:", err)
				return
			}
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
	for i := range gameState {
		gameState[i].Alive = false
		gameState[i].Changed = true
	}
}

func update() {
	var newState = make([]Point, surfaceWidth*surfaceHeight)
	for i := 0; i < surfaceWidth; i++ {
		for j := 0; j < surfaceHeight; j++ {
			idx := (j*surfaceWidth + i)
			alive := gameState[idx].Alive
			neighbors := 0

			for _, c := range offsets {
				nx := i + c.x
				if nx < 0 {
					nx += surfaceWidth
				} else if nx >= surfaceWidth {
					nx -= surfaceWidth
				}

				ny := j + c.y
				if ny < 0 {
					ny += surfaceHeight
				} else if ny >= surfaceHeight {
					ny -= surfaceHeight
				}

				if gameState[(ny*surfaceWidth + nx)].Alive {
					neighbors++
				}
			}

			changed := gameState[idx].Changed
			if alive {
				if neighbors < 2 || neighbors > 3 {
					alive = false
					changed = true
				}
			} else {
				if neighbors == 3 {
					alive = true
					changed = true
				}
			}

			newState[idx] = Point{alive, changed, j, i}
		}
	}

	copy(gameState, newState)

	sendChanged()
}

func main() {
	//Full sync routine
	reset()

	updateTick := time.NewTicker(50 * time.Millisecond)
	syncTick := time.NewTicker(10 * time.Second)
	resetTick := time.NewTicker(120 * time.Second)
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
	if err := http.ListenAndServe(":5501", nil); err != nil {
		fmt.Println(err)
	}
}
