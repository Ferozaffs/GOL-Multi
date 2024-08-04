import * as PIXI from "https://cdn.skypack.dev/pixi.js";
//import { sendInput } from "./connection.js";

const app = new PIXI.Application();
let initialized = false;
let tickCounter = 0.0;
let view = undefined;
let width = 0;
const updaterate = 1.0 / 10.0;

const rows = 128;
const cols = 128;
const padding = 0;
const points = new Array(rows);

(async () => {
  await init();

  initialized = true;

  app.ticker.add((time) => {
    updateView();

    tickCounter += time.elapsedMS / 1000.0;
    if (tickCounter > updaterate) {
      sendData();
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
}

export async function updateData(json) {
  while (!initialized) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

function updateView() {
  if (width !== view.clientWidth) {
    width = view.clientWidth;
    const size = view.clientWidth / cols;

    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        const asset = points[i][j].asset;
        asset.width = size - padding;
        asset.height = size - padding;
        asset.y = padding + i * size;
        asset.x = padding + j * size;
      }
    }
  }
}

function sendData() {}

export function setData(array) {
  let idx = 0;
  for (let i = 0; i < array.length; i++) {
    for (let j = 0; j < 32; j++) {
      const val = (array[i] >> j) & 0x1;

      const asset = points[Math.floor(idx / rows)][idx % cols].asset;
      if (val > 0) {
        asset.tint = 0x111111;
      } else {
        asset.tint = 0xbbbbbb;
      }

      idx++;
    }
  }
}
