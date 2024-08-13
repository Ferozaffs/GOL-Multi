let checkboxes = [];

document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("scratchpad");

  for (let i = 0; i < 16; i++) {
    for (let j = 0; j < 16; j++) {
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.id = `checkbox-${i}-${j}`;
      checkbox.className =
        "w-3 h-3 md:w-5 md:h-5 text-gray-600 bg-gray-400 focus:ring-0 focus:ring-offset-0";
      container.appendChild(checkbox);

      checkboxes.push(checkbox);
    }
  }
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
export function setCooldownText(cooldown) {}
