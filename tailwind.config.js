/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        bluescreen: ["BlueScreen", "sans-serif"],
        dos: ["PerfectDOS", "monospace"],
      },
    },
  },
  plugins: [],
};
