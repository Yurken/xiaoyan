const preset = {
  content: [],
  theme: {
    extend: {
      colors: {
        rc: {
          accent: "var(--rc-accent)",
          bg: "var(--rc-bg)",
          surface: "var(--rc-surface)",
          elevated: "var(--rc-elevated)",
          border: "var(--rc-border)",
          text: "var(--rc-text)",
          "text-soft": "var(--rc-text-soft)",
          "text-muted": "var(--rc-text-muted)",
          "card-inset-bg": "var(--rc-card-inset-bg)",
          "chip-bg": "var(--rc-chip-bg)",
          "control-bg": "var(--rc-control-bg)",
        },
      },
      boxShadow: {
        "rc-inset": "var(--rc-inset-shadow)",
        "rc-raised": "var(--rc-raised-shadow)",
        "rc-flat": "var(--rc-flat-shadow)",
        "rc-card": "var(--rc-card-shadow)",
        "rc-card-flat": "var(--rc-card-flat-shadow)",
        "rc-button-primary": "var(--rc-button-primary-shadow)",
      },
      borderRadius: {
        "3xl": "1.5rem",
        "4xl": "2rem",
      },
    },
  },
};

export default preset;
