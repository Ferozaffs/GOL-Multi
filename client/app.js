import * as PIXI from "https://cdn.skypack.dev/pixi.js";
import { sendPoints } from "./connection.js";
import { getActiveCoordinates } from "./scratchpad.js";

const app = new PIXI.Application();
let initialized = false;
let tickCounter = 0.0;
let view = undefined;
let pointerActive = false;
let width = 0;
let currentSize = 1.0;
let previousPoint = undefined;
let stampCooldown = 0.0;
let cooldownElement;
const updaterate = 1.0 / 1.0;

const rows = 256;
const cols = 256;
const padding = 0;
const points = new Array(rows);
let color = [];
let colorLabel = [];
let colorTailwind = [];
let scoreElements = [];

(async () => {
  await init();

  initialized = true;

  app.ticker.add((time) => {
    updateView();

    stampCooldown = Math.max(0.0, stampCooldown - time.elapsedMS / 1000.0);
    if (stampCooldown > 0.0) {
      cooldownElement.textContent = "Cooldown: " + stampCooldown.toFixed(2);
      cooldownElement.className = "text-lg sm:text-md text-red-500 font-bold";
    } else {
      cooldownElement.textContent = "Ready!";
      cooldownElement.className = "text-lg sm:text-md text-green-600 font-bold";
    }

    tickCounter += time.elapsedMS / 1000.0;
    if (tickCounter > updaterate) {
      tickCounter = 0.0;
    }
  });
})();

async function init() {
  await app.init({
    background: 0xbbbbbb,
    antialias: false,
    autoDensity: false,
  });

  view = document.querySelector("#view");
  view.appendChild(app.canvas);
  app.resizeTo = view;

  let asset = PIXI.Sprite.from(PIXI.Texture.WHITE);
  asset.width = view.getBoundingClientRect().width;
  asset.height = view.getBoundingClientRect().height;
  asset.tint = 0xbbbbbb;
  app.stage.addChild(asset);

  for (let i = 0; i < rows; i++) {
    points[i] = new Array(cols);
    for (let j = 0; j < cols; j++) {
      const point = {
        row: i,
        col: j,
        active: false,
        pending: false,
        colorId: 0,
        asset: PIXI.Sprite.from(PIXI.Texture.WHITE),
      };

      point.asset.width = 1;
      point.asset.height = 1;
      point.asset.tint = 0xbbbbbb;
      point.asset.visible = false;

      app.stage.addChild(point.asset);

      points[i][j] = point;
    }
  }

  app.stage.interactive = true;
  //app.stage.on("pointermove", updateInteraction_legacy);
  app.stage.on("pointerdown", activatePointer);
  app.stage.on("pointerup", deactivatePointer);

  generateColors();

  cooldownElement = document.getElementById("cooldown");

  const container = document.getElementById("score");
  for (let i = 0; i <= 5; i++) {
    const scoreElement = document.createElement("div");
    scoreElement.id = `scoreElement-${i}`;
    scoreElement.textContent = "";
    scoreElement.className = "";
    container.appendChild(scoreElement);

    scoreElements.push(scoreElement);
  }
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

  colorTailwind[0] = "text-[#111111]";
  colorTailwind[1] = "text-[#ff0000]";
  colorTailwind[2] = "text-[#00ff00]";
  colorTailwind[3] = "text-[#0000ff]";
  colorTailwind[4] = "text-[#ffff00]";
  colorTailwind[5] = "text-[#ff00ff]";
  colorTailwind[6] = "text-[#00ffff]";
  colorTailwind[7] = "text-[#ff7700]";
  colorTailwind[8] = "text-[#ff0077]";
  colorTailwind[9] = "text-[#00ff77]";
  colorTailwind[10] = "text-[#77ff00]";
  colorTailwind[11] = "text-[#0077ff]";
  colorTailwind[12] = "text-[#7700ff]";
  colorTailwind[13] = "text-[#770000]";
  colorTailwind[14] = "text-[#007700]";
  colorTailwind[15] = "text-[#000077]";
  colorTailwind[16] = "text-[#777700]";

  colorLabel[0] = "BLACK";
  colorLabel[1] = "RED";
  colorLabel[2] = "GREEN";
  colorLabel[3] = "BLUE";
  colorLabel[4] = "YELLOW";
  colorLabel[5] = "PURPLE";
  colorLabel[6] = "CYAN";
  colorLabel[7] = "ORANGE";
  colorLabel[8] = "PINK";
  colorLabel[9] = "TEAL";
  colorLabel[10] = "LIME";
  colorLabel[11] = "AQUA";
  colorLabel[12] = "DARK PURPLE";
  colorLabel[13] = "DARK RED";
  colorLabel[14] = "DARK GREEN";
  colorLabel[15] = "DARK BLUE";
  colorLabel[16] = "DARK ORANGE";
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
  //updateInteraction_legacy(e);
}
function deactivatePointer(e) {
  if (pointerActive) {
    stamp(e);
    sendData();
  }
  pointerActive = false;
  previousPoint = undefined;
}

function stamp(e) {
  if (pointerActive && stampCooldown === 0.0) {
    const row = Math.floor(e.data.global.y / currentSize);
    const col = Math.floor(e.data.global.x / currentSize);

    const stampCoords = getActiveCoordinates();

    let minCol = Infinity,
      maxCol = -Infinity;
    let minRow = Infinity,
      maxRow = -Infinity;
    stampCoords.forEach((coord) => {
      if (coord.col < minCol) minCol = coord.col;
      if (coord.col > maxCol) maxCol = coord.col;

      if (coord.row < minRow) minRow = coord.row;
      if (coord.row > maxRow) maxRow = coord.row;
    });

    const halfWidth = Math.floor((maxCol - minCol) / 2);
    const halfHeight = Math.floor((maxRow - minRow) / 2);

    stampCoords.forEach((coord) => {
      let c = col - halfWidth + (coord.col - minCol);
      let r = row - halfHeight + (coord.row - minRow);

      if (c < 0) c += cols;
      if (r < 0) r += rows;

      const point = points[r % rows][c % rows];
      if (point) {
        point.pending = true;
      }
    });

    stampCooldown = 2.0;
  }
}

function updateInteraction_legacy(e) {
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

    colorPoint(point, point.alive);

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

        colorPoint(point, point.alive);
      }
    }
  }

  sendPoints(pointsToSend);
}

export function sync(array) {
  if (initialized) {
    for (let i = 1; i < array.length; i += 3) {
      const point = points[array[i]][array[i + 1]];
      const alive = array[i + 2] & 0x1;
      const colorId = array[i + 2] >> 1;

      point.colorId = colorId;
      colorPoint(point, alive);
    }

    updateScore();
  }
}

export function fullSync(array) {
  if (initialized) {
    let idx = 0;
    for (let i = 1; i < array.length; i++) {
      const alive = array[i] & 0x1;
      const colorId = array[i] >> 1;

      const point = points[Math.floor(idx / rows)][idx % cols];
      point.colorId = colorId;
      colorPoint(point, alive);

      idx++;
    }

    updateScore();
  }
}

function colorPoint(point, alive) {
  const asset = point.asset;
  if (alive > 0) {
    point.color = color[point.colorId];
    point.active = true;
    point.asset.visible = true;
  } else {
    point.color = 0xbbbbbb;
    point.active = false;
    point.asset.visible = false;
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

function updateScore() {
  const colorCounts = {};

  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const point = points[i][j];

      if (point.active) {
        if (colorCounts[point.colorId]) {
          colorCounts[point.colorId] += 1;
        } else {
          colorCounts[point.colorId] = 1;
        }
      }
    }
  }

  const colorCountsArray = [];
  for (const color in colorCounts) {
    if (colorCounts.hasOwnProperty(color)) {
      colorCountsArray.push([color, colorCounts[color]]);
    }
  }

  colorCountsArray.sort((a, b) => b[1] - a[1]);

  for (let i = 0; i < 5; i++) {
    scoreElements[i].textContent = "";
  }

  for (let i = 0; i < Math.min(5, colorCountsArray.length); i++) {
    const element = colorCountsArray[i];

    scoreElements[i].textContent = colorLabel[element[0]] + ": " + element[1];
    scoreElements[i].className =
      "font-semibold text-sm " + colorTailwind[element[0]];
  }
}
