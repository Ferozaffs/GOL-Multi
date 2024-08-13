/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./client/*.{html,js}"],
  theme: {
    extend: {
      gridTemplateColumns: {
        16: "repeat(16, minmax(0, 1fr))",
      },
    },
    screens: {
      sm: "640px",
      md: "940px",
      lg: "1440px",
      land: { raw: "(orientation: landscape)" },
    },
  },
  plugins: [require("@tailwindcss/forms")],
};
