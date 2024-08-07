import { fullSync, sync } from "./app.js";

let socket;
let pingInterval;

connectToServer("", window.location.hostname + ":5501");

export function connectToServer(rn, url) {
  socket = new WebSocket("ws://" + url);
  socket.binaryType = "arraybuffer";
  window.addEventListener("beforeunload", closeWebSocket);
  window.addEventListener("unload", closeWebSocket);

  socket.onopen = function (event) {
    console.log("WebSocket connection established.");
    startHeartbeat();
  };

  socket.onclose = function (event) {
    console.log("WebSocket connection closed.");
    stopHeartbeat();
  };

  socket.onmessage = function (event) {
    if (event.data instanceof ArrayBuffer) {
      handleBuffer(event.data);
    } else if (event.data !== "pong") {
      console.log(event.data);
    }
  };
}

function handleBuffer(buffer) {
  const array = new Uint8Array(buffer);
  const type = array[0];
  if (type === 0) {
    fullSync(array);
  } else if (type === 1) {
    sync(array);
  }
}

function closeWebSocket() {
  if (socket !== undefined) {
    const code = 1000;
    const reason = "Client closing connection";

    if (
      socket.readyState === WebSocket.OPEN ||
      socket.readyState === WebSocket.CONNECTING
    ) {
      socket.close(code, reason);
    }
  }
}

export function sendPoints(points) {
  if (socket !== undefined) {
    const message = {
      type: "points",
      data: points,
    };

    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
    }
  }
}

function startHeartbeat() {
  pingInterval = setInterval(() => {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send("ping");
    }
  }, 30000);
}

function stopHeartbeat() {
  clearInterval(pingInterval);
}
