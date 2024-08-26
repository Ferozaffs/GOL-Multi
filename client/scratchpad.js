let checkboxes = [];
let savesSelect;
let isDragging;
let paint = undefined;

document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("scratchpad");

  container.addEventListener("mousedown", (e) => {
    isDragging = true;
  });

  container.addEventListener("mouseup", (e) => {
    isDragging = false;
    saveScratchPad("scratchpad");
  });

  container.addEventListener("touchend", (e) => {
    paint = undefined;
    saveScratchPad("scratchpad");
  });

  container.addEventListener("touchmove", (e) => {
    var touch = e.touches[0];

    var checkbox = document.elementFromPoint(touch.clientX, touch.clientY);

    if (checkbox) {
      if (paint === undefined) {
        checkbox.checked = !checkbox.checked;
        paint = checkbox.checked ? true : false;
      } else if ((!checkbox.checked && paint) || (checkbox.checked && !paint)) {
        checkbox.checked = !checkbox.checked;
      }
    }
  });

  for (let i = 0; i < 16; i++) {
    for (let j = 0; j < 16; j++) {
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.id = `checkbox-${i}-${j}`;
      checkbox.className =
        "w-3 h-3 md:w-5 md:h-5 text-gray-600 bg-gray-400 focus:ring-0 focus:ring-offset-0";
      container.appendChild(checkbox);

      checkbox.addEventListener("mousedown", (e) => {
        checkbox.checked = !checkbox.checked;
        paint = checkbox.checked ? true : false;
      });
      checkbox.addEventListener("mouseover", (e) => {
        if (isDragging) {
          if ((!checkbox.checked && paint) || (checkbox.checked && !paint)) {
            checkbox.checked = !checkbox.checked;
          }
        }
      });

      checkbox.addEventListener("click", (e) => {
        checkbox.checked = !checkbox.checked;
      });

      checkboxes.push(checkbox);
    }
  }

  const clear = document.getElementById("clear");
  clear.addEventListener("click", function () {
    clearState();
  });

  const save = document.getElementById("save");
  save.addEventListener("click", function () {
    saveState();
  });

  savesSelect = document.getElementById("saves");
  savesSelect.addEventListener("click", function () {
    loadSave();
  });

  loadScratchPad("scratchpad");
  loadSaves();
});

export function getActiveCoordinates() {
  let activeCoordinates = [];

  checkboxes.forEach((checkbox) => {
    if (checkbox.checked) {
      let [_, row, col] = checkbox.id.split("-");
      activeCoordinates.push({ row: parseInt(row), col: parseInt(col) });
    }
  });

  return activeCoordinates;
}

function saveScratchPad(key) {
  let bitString = "";
  checkboxes.forEach((checkbox) => {
    bitString += checkbox.checked ? "1" : "0";
  });
  localStorage.setItem(key, bitString);
}

function loadScratchPad(key) {
  let bitString = localStorage.getItem(key);
  if (bitString) {
    let i = 0;
    checkboxes.forEach((checkbox) => {
      checkbox.checked = bitString[i] === "1";
      i++;
    });
  }
}

function loadSave() {
  if (savesSelect.selectedIndex !== -1) {
    loadScratchPad("scratchpad_" + savesSelect.selectedIndex);
  }
}

function loadSaves() {
  let i = 0;
  while (true) {
    let value = localStorage.getItem("scratchpad_" + i);
    if (value === null) {
      break;
    }

    var opt = document.createElement("option");
    opt.value = i;
    opt.innerHTML = i;
    savesSelect.appendChild(opt);

    i++;
  }
}

function clearState() {
  checkboxes.forEach((checkbox) => {
    checkbox.checked = false;
  });

  saveScratchPad("scratchpad");
}

function saveState() {
  var opt = document.createElement("option");
  opt.value = savesSelect.length;
  opt.innerHTML = savesSelect.length;
  saveScratchPad("scratchpad_" + savesSelect.length);
  savesSelect.appendChild(opt);
}
