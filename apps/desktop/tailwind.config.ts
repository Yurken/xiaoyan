import type { Config } from "tailwindcss";

export default {
  darkMode: ["selector", '[data-theme="dark"]'],
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
          bg:      "rgb(var(--rc-bg-rgb) / <alpha-value>)",
          surface: "rgb(var(--rc-surface-rgb) / <alpha-value>)",
          dark:    "rgb(var(--rc-border-rgb) / <alpha-value>)",
          darker:  "rgb(var(--rc-border-strong-rgb) / <alpha-value>)",
          light:   "rgb(var(--rc-elevated-rgb) / <alpha-value>)",
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
          primary:   "rgb(var(--rc-text-rgb) / <alpha-value>)",
          secondary: "rgb(var(--rc-text-soft-rgb) / <alpha-value>)",
          tertiary:  "rgb(var(--rc-text-muted-rgb) / <alpha-value>)",
        },
      },
      boxShadow: {
        "nm-flat":    "var(--rc-card-flat-shadow)",
        "nm-raised":  "var(--rc-card-raised-shadow)",
        "nm-pressed": "var(--rc-card-inset-shadow)",
        "nm-inset":   "var(--rc-card-inset-shadow)",
        "nm-card":    "var(--rc-card-shadow)",
        "nm-sm":      "var(--rc-card-flat-shadow-sm)",
        "apple-blue": "5px 5px 12px rgba(0,98,204,0.45), -3px -3px 8px rgba(58,155,255,0.30)",
        "apple-blue-pressed": "inset 3px 3px 6px rgba(0,62,128,0.5), inset -2px -2px 5px rgba(58,155,255,0.3)",
      },
      backgroundImage: {
        "nm-card":    "var(--rc-nm-card-bg, linear-gradient(145deg, #171D27, #0E131A))",
        "nm-surface": "var(--rc-nm-surface-bg, linear-gradient(145deg, #1A2230, #0A0E14))",
        "nm-elevated": "var(--rc-nm-elevated-bg, linear-gradient(145deg, #202A3C, #131A26))",
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
