/** @type {import(tailwindcss).Config} */
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "brand": "#007AFF",
        "nm-bg": "#f0f2f5",
        "nm-surface": "#ffffff",
        "nm-dark": "#8e8e93",
      },
      boxShadow: {
        "nm": "8px 8px 16px #e0e2e5, -8px -8px 16px #ffffff",
        "nm-inset": "inset 4px 4px 8px #e0e2e5, inset -4px -4px 8px #ffffff",
      }
    },
  },
  plugins: [],
}
