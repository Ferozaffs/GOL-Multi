import { setData } from "./app.js";

let socket;

connectToServer("", window.location.hostname + ":8080");

export function connectToServer(rn, url) {
  socket = new WebSocket("ws://" + url);
  socket.binaryType = "arraybuffer";
  window.addEventListener("beforeunload", closeWebSocket);
  window.addEventListener("unload", closeWebSocket);

  socket.onopen = function (event) {
    console.log("WebSocket connection established.");
  };

  socket.onclose = function (event) {
    console.log("WebSocket connection closed.");
  };

  socket.onmessage = function (event) {
    if (event.data instanceof ArrayBuffer) {
      handleBuffer(event.data);
    } else {
      console.log(event.data);
    }
  };
}

function handleBuffer(buffer) {
  const array = new Uint32Array(buffer);

  setData(array);
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
