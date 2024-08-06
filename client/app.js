import * as PIXI from "https://cdn.skypack.dev/pixi.js";
import { sendPoints } from "./connection.js";

const app = new PIXI.Application();
let initialized = false;
let tickCounter = 0.0;
let view = undefined;
let pointerActive = false;
let width = 0;
let currentSize = 1.0;
let previousPoint = undefined;
const updaterate = 1.0 / 1.0;

const rows = 128;
const cols = 128;
const padding = 0;
const points = new Array(rows);
const pendingTint = 0x00ffff;

(async () => {
  await init();

  initialized = true;

  app.ticker.add((time) => {
    updateView();

    tickCounter += time.elapsedMS / 1000.0;
    if (tickCounter > updaterate) {
      tickCounter = 0.0;
    }
  });
})();

async function init() {
  await app.init({
    background: 0xaaaaaa,
    antialias: false,
    autoDensity: false,
  });

  view = document.querySelector("#view");
  view.appendChild(app.canvas);
  app.resizeTo = view;

  for (let i = 0; i < rows; i++) {
    points[i] = new Array(cols);
    for (let j = 0; j < cols; j++) {
      const point = {
        row: i,
        col: j,
        active: false,
        pending: false,
        asset: PIXI.Sprite.from(PIXI.Texture.WHITE),
      };

      point.asset.width = 1;
      point.asset.height = 1;
      point.asset.tint = 0xbbbbbb;

      app.stage.addChild(point.asset);

      points[i][j] = point;
    }
  }

  app.stage.interactive = true;
  app.stage.on("pointermove", updateInteraction);
  app.stage.on("pointerdown", activatePointer);
  app.stage.on("pointerup", deactivatePointer);
}

export async function updateData(json) {
  while (!initialized) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

function updateView() {
  if (width !== view.clientWidth) {
    width = view.clientWidth;
    currentSize = view.clientWidth / cols;

    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        const asset = points[i][j].asset;
        asset.width = currentSize - padding;
        asset.height = currentSize - padding;
        asset.y = padding + i * currentSize;
        asset.x = padding + j * currentSize;
      }
    }
  }
}

function activatePointer(e) {
  pointerActive = true;
  updateInteraction(e);
}
function deactivatePointer(e) {
  if (pointerActive) {
    sendData();
  }
  pointerActive = false;
  previousPoint = undefined;
}

function updateInteraction(e) {
  if (pointerActive) {
    const row = Math.floor(e.data.global.y / currentSize);
    const col = Math.floor(e.data.global.x / currentSize);

    const point = points[row][col];
    if (point !== previousPoint) {
      if (point.pending) {
        point.asset.tint = (point.asset.tint - pendingTint) * 10.0;
        point.pending = false;
      } else {
        point.asset.tint = point.asset.tint * 0.1 + pendingTint;
        point.pending = true;
      }
    }

    previousPoint = point;
  }
}

function sendData() {
  let pointsToSend = [];

  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const point = points[i][j];

      if (point.pending) {
        pointsToSend.push({ x: i, y: j });

        point.asset.tint = (point.asset.tint - pendingTint) * 10.0;
        point.pending = false;
      }
    }
  }

  sendPoints(pointsToSend);
}

export function setData(array) {
  let idx = 0;
  for (let i = 0; i < array.length; i++) {
    for (let j = 0; j < 32; j++) {
      const val = (array[i] >> j) & 0x1;

      const point = points[Math.floor(idx / rows)][idx % cols];
      const asset = point.asset;
      if (val > 0) {
        asset.tint = 0x111111;
        point.active = true;
      } else {
        asset.tint = 0xbbbbbb;
      }

      if (point.pending) {
        point.asset.tint = point.asset.tint * 0.1 + pendingTint;
      }

      idx++;
    }
  }
}
