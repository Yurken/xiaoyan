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
          50:  "#EBF4FF",
          100: "#DBEAFE",
          200: "#BAD8FE",
          300: "#7AB8FD",
          400: "#3A9BFF",
          500: "#007AFF",
          600: "#007AFF",
          700: "#0062CC",
        },
        nm: {
          bg:      "#E8ECF0",
          surface: "#F0F4F8",
          dark:    "#C8CDD3",
          darker:  "#B0B8C0",
          light:   "#FFFFFF",
        },
        apple: {
          blue:   "#007AFF",
          orange: "#FF9500",
          green:  "#34C759",
          red:    "#FF3B30",
          purple: "#AF52DE",
          teal:   "#5AC8FA",
        },
        ink: {
          primary:   "#1C1C1E",
          secondary: "#3C3C43",
          tertiary:  "#8E8E93",
        },
      },
      boxShadow: {
        "nm-flat":    "5px 5px 10px #C8CDD3, -5px -5px 10px #FFFFFF",
        "nm-raised":  "8px 8px 16px #C8CDD3, -8px -8px 16px #FFFFFF",
        "nm-pressed": "inset 4px 4px 8px #C8CDD3, inset -4px -4px 8px #FFFFFF",
        "nm-inset":   "inset 2px 2px 5px #C8CDD3, inset -2px -2px 5px #FFFFFF",
        "nm-card":    "6px 6px 12px #C8CDD3, -6px -6px 12px #FFFFFF",
        "nm-sm":      "3px 3px 6px #C8CDD3, -3px -3px 6px #FFFFFF",
        "apple-blue": "5px 5px 12px rgba(0,98,204,0.45), -3px -3px 8px rgba(58,155,255,0.30)",
        "apple-blue-pressed": "inset 3px 3px 6px rgba(0,62,128,0.5), inset -2px -2px 5px rgba(58,155,255,0.3)",
      },
      backgroundImage: {
        "nm-card":    "linear-gradient(145deg, #F2F6FA, #E0E4E8)",
        "nm-surface": "linear-gradient(145deg, #FFFFFF, #E8ECF0)",
        "apple-blue": "linear-gradient(145deg, #1A8AFF, #0062CC)",
        "apple-orange": "linear-gradient(145deg, #FFAA20, #FF7700)",
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.5rem",
        "4xl": "2rem",
      },
      fontFamily: {
        sans: ["-apple-system", "BlinkMacSystemFont", "SF Pro Display", "SF Pro Text", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
} satisfies Config;
