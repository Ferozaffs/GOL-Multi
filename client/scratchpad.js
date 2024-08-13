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
    }
  }
});
