package main

import (
	"bytes"
	"compress/gzip"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strconv"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

const isPvP = true
const numColor = 16
const resetTime = 120.0

const (
	surfaceWidth  = 256
	surfaceHeight = 256
)

type Point struct {
	Alive   bool
	Changed bool
	Row     int
	Col     int
	ColorId int
}

type PointData struct {
	Row  uint8
	Col  uint8
	Data uint8
}

type Coord struct {
	x int
	y int
}

type ClientMessage struct {
	Type string
	Data interface{}
}

type Client struct {
	Connection *websocket.Conn
	ColorId    int
}

var (
	currentColorId int
	conMutex       sync.Mutex
	connections    []Client
)

var (
	gsMutex   sync.Mutex
	gameState = make([]Point, surfaceWidth*surfaceHeight)
)

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

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

var lastReset = time.Now()

func handleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		fmt.Println(err)
		return
	}
	defer conn.Close()

	colorId := currentColorId
	conMutex.Lock()
	connections = append(connections, Client{conn, colorId})

	if isPvP {
		currentColorId++
		if currentColorId > numColor {
			currentColorId = 1
		}
	}
	conMutex.Unlock()

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

	var rateLimit = 2000
	var lastProcessedTime time.Time

	for {
		_, message, err := conn.ReadMessage()
		if err != nil {
			fmt.Println("Read error:", err)
			return
		}

		now := time.Now()

		if now.Sub(lastProcessedTime) >= time.Duration(rateLimit)*time.Millisecond {
			lastProcessedTime = now

			var msg ClientMessage
			err = json.Unmarshal(message, &msg)
			if err != nil {
				log.Printf("Error unmarshalling JSON: %v", err)
				log.Printf("Msg: %v", message)
				continue
			}

			if msg.Type == "points" {
				setJSONPoints(colorId, msg.Data)

				err = conn.WriteMessage(websocket.TextMessage, []byte("recieved "+strconv.Itoa(rateLimit/1000)))
				if err != nil {
					fmt.Println("Error writing:", err)
					return
				}
			}
		}
	}
}

func setJSONPoints(colorId int, data interface{}) {
	points, ok := data.([]interface{})

	if ok {
		gsMutex.Lock()
		for _, p := range points {
			pointMap, ok := p.(map[string]interface{})
			if ok {
				x, _ := pointMap["x"].(float64)
				y, _ := pointMap["y"].(float64)
				idx := int(x*surfaceWidth + y)
				gameState[idx].Alive = true
				gameState[idx].Changed = true
				gameState[idx].ColorId = colorId
			}
		}
		gsMutex.Unlock()
	}
}

func compressBuffer(input *bytes.Buffer) (*bytes.Buffer, error) {
	var compressedBuffer bytes.Buffer
	gzipWriter := gzip.NewWriter(&compressedBuffer)

	_, err := io.Copy(gzipWriter, input)
	if err != nil {
		return nil, err
	}

	err = gzipWriter.Close()
	if err != nil {
		return nil, err
	}

	return &compressedBuffer, nil
}

func pointArrayToPackedUint(array []Point) []uint8 {
	size := len(array)
	packed := make([]uint8, size)
	for i, p := range array {
		if p.Alive {
			pd := 1
			pd |= (p.ColorId << 1)
			packed[i] = uint8(pd)
		}
	}
	return packed
}

func getFullSyncBuffer() (*bytes.Buffer, error) {
	gsMutex.Lock()
	packed := pointArrayToPackedUint(gameState)
	gsMutex.Unlock()

	var buf bytes.Buffer
	msgType := uint8(0)
	binary.Write(&buf, binary.LittleEndian, msgType)

	for _, value := range packed {
		err := binary.Write(&buf, binary.LittleEndian, value)
		if err != nil {
			fmt.Println("binary.Write failed:", err)
			return nil, err
		}
	}

	compressedBuffer, err := compressBuffer(&buf)
	if err != nil {
		fmt.Println("Error compressing buffer:", err)
		return nil, err
	}

	return compressedBuffer, nil
}

func sendFullSync() {
	buf, err := getFullSyncBuffer()
	if err != nil {
		return
	}

	conMutex.Lock()
	activeConnections := []Client{}
	for _, c := range connections {
		err := c.Connection.WriteMessage(websocket.BinaryMessage, buf.Bytes())
		if err == nil {
			activeConnections = append(activeConnections, c)
		}
	}

	connections = activeConnections
	conMutex.Unlock()

	for i := range gameState {
		gameState[i].Changed = false
	}

	remainingRoundTime := resetTime - (time.Since(lastReset).Seconds())
	timestring := strconv.FormatFloat(remainingRoundTime, 'f', 1, 64)
	for _, c := range connections {
		err := c.Connection.WriteMessage(websocket.TextMessage, []byte("time "+timestring))
		if err != nil {
			fmt.Println("Error writing:", err)
		}
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

	numChanged := 0
	for i, p := range gameState {
		if p.Changed {
			pointData := PointData{}
			pointData.Col = uint8(p.Col)
			pointData.Row = uint8(p.Row)
			if p.Alive {
				pd := 1
				pd |= (p.ColorId << 1)
				pointData.Data = uint8(pd)
			} else {
				pointData.Data = uint8(0)
			}

			gameState[i].Changed = false

			err := binary.Write(&buf, binary.LittleEndian, pointData)
			if err != nil {
				fmt.Println("binary.Write failed:", err)
				return
			}

			numChanged++
		}
	}

	if numChanged != 0 {
		compressedBuffer, err := compressBuffer(&buf)
		if err != nil {
			fmt.Println("Error compressing buffer:", err)
			return
		}

		conMutex.Lock()
		activeConnections := []Client{}
		for _, c := range connections {
			err := c.Connection.WriteMessage(websocket.BinaryMessage, compressedBuffer.Bytes())
			if err == nil {
				activeConnections = append(activeConnections, c)
			}
		}

		connections = activeConnections
		conMutex.Unlock()
	}
}

func reset() {
	gsMutex.Lock()
	for i := range gameState {
		gameState[i].Alive = false
		gameState[i].Changed = true
		gameState[i].ColorId = 0
	}
	gsMutex.Unlock()

	lastReset = time.Now()
}

func update() {
	gsMutex.Lock()
	var newState = make([]Point, surfaceWidth*surfaceHeight)
	for i := 0; i < surfaceWidth; i++ {
		for j := 0; j < surfaceHeight; j++ {
			idx := (j*surfaceWidth + i)
			alive := gameState[idx].Alive
			neighbors := 0
			neighborIds := make(map[int]int)

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
					neighborIds[gameState[(ny*surfaceWidth+nx)].ColorId]++
				}
			}

			changed := gameState[idx].Changed
			colorId := gameState[idx].ColorId
			if alive {
				if neighbors < 2 || neighbors > 3 {
					alive = false
					changed = true
					colorId = 0
				}
			} else {
				if neighbors == 3 {
					alive = true
					changed = true

					var maxCount int
					var maxIDs []int

					for id, count := range neighborIds {
						if count > maxCount {
							maxCount = count
							maxIDs = []int{id}
						} else if count == maxCount {
							maxIDs = append(maxIDs, id)
						}
					}

					if len(maxIDs) == 1 {
						colorId = maxIDs[0]
					}
				}
			}

			newState[idx] = Point{alive, changed, j, i, colorId}
		}
	}

	copy(gameState, newState)
	gsMutex.Unlock()

	sendChanged()
}

func main() {
	if isPvP {
		currentColorId = 1
	}
	//Full sync routine
	reset()

	updateTick := time.NewTicker(50 * time.Millisecond)
	syncTick := time.NewTicker(10 * time.Second)
	resetTick := time.NewTicker(resetTime * time.Second)
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
	if err := http.ListenAndServe(":5502", nil); err != nil {
		fmt.Println(err)
	}
}
