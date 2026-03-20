import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#fef2f2",
          100: "#fee2e2",
          300: "#fca5a5",
          500: "#ef4444",
          600: "#dc2626",
          700: "#b91c1c",
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
