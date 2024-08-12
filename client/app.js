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
let color = [];

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

  generateColors();
}

function generateColors() {
  color[0] = 0x111111;
  color[1] = 0xff0000;
  color[2] = 0x00ff00;
  color[3] = 0x0000ff;
  color[4] = 0xffff00;
  color[5] = 0xff00ff;
  color[6] = 0x00ffff;
  color[7] = 0xff7700;
  color[8] = 0xff0077;
  color[9] = 0x00ff77;
  color[10] = 0x77ff00;
  color[11] = 0x0077ff;
  color[12] = 0x7700ff;
  color[13] = 0x770000;
  color[14] = 0x007700;
  color[15] = 0x000077;
  color[16] = 0x777700;
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
        point.pending = false;
      } else {
        point.pending = true;
      }
    }

    colorPoint(point, point.alive, point.color);

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
        point.pending = false;

        colorPoint(point, point.alive, point.color);
      }
    }
  }

  sendPoints(pointsToSend);
}

export function sync(array) {
  for (let i = 1; i < array.length; i += 3) {
    const point = points[array[i]][array[i + 1]];
    const alive = array[i + 2] & 0x1;
    const colorId = array[i + 2] >> 1;

    colorPoint(point, alive, color[colorId]);
  }
}

export function fullSync(array) {
  let idx = 0;
  for (let i = 1; i < array.length; i++) {
    const alive = array[i] & 0x1;
    const colorId = array[i] >> 1;

    const point = points[Math.floor(idx / rows)][idx % cols];
    colorPoint(point, alive, color[colorId]);

    idx++;
  }
}

function colorPoint(point, alive, color) {
  const asset = point.asset;
  if (alive > 0) {
    point.color = color;
    point.active = true;
  } else {
    point.color = 0xbbbbbb;
  }

  if (point.pending) {
    let r = (point.color >> 16) & 0xff;
    let g = (point.color >> 8) & 0xff;
    let b = point.color & 0xff;

    r = Math.min(255, Math.floor(r + (255 - r) * 2));
    g = Math.min(255, Math.floor(g + (255 - g) * 2));
    b = Math.min(255, Math.floor(b + (255 - b) * 2));

    asset.tint = (r << 16) | (g << 8) | b;
  } else {
    asset.tint = point.color;
  }
}
