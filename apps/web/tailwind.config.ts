import type { Config } from "tailwindcss";

// "Sunset dusk": the login page's game-style sky (violet night → crimson →
// ember orange → gold) carried into every page after sign-in.
const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: "#150d16",
        "surface-dim": "#150d16",
        "surface-bright": "#3d2b3b",
        "surface-container-lowest": "#0e080f",
        "surface-container-low": "#1c121d",
        "surface-container": "#231725",
        "surface-container-high": "#2e1f2f",
        "surface-container-highest": "#3a283a",
        "surface-variant": "#3a283a",
        "on-surface": "#fbe9e4",
        "on-surface-variant": "#dcc4c4",
        outline: "#a68b90",
        "outline-variant": "#553d4a",
        primary: "#ffb37a",
        "primary-container": "#f0661f",
        "on-primary": "#4d1a00",
        "on-primary-container": "#2e0e00",
        secondary: "#5fe0a5",
        "secondary-container": "#1b9e66",
        "on-secondary": "#003824",
        "on-secondary-container": "#00311f",
        tertiary: "#ffd36b",
        "tertiary-container": "#d29a1a",
        "on-tertiary": "#472a00",
        "on-tertiary-container": "#3e2400",
        error: "#ffb4ab",
        "error-container": "#93000a",
        "on-error": "#690005",
        "on-error-container": "#ffdad6",
      },
      fontFamily: {
        // Inter has no Thai letters; Thai text falls through to IBM Plex Sans Thai
        // instead of the system's dated Thai font.
        sans: ["Inter", "IBM Plex Sans Thai", "sans-serif"],
        mono: ["JetBrains Mono", "IBM Plex Sans Thai", "monospace"],
        // The exam paper: a modern looped Thai face (the Word file's TH SarabunPSK read as
        // old-fashioned). Not a locally installed font: browsers place some fonts' Thai
        // vowels and tone marks wrongly.
        paper: ["IBM Plex Sans Thai Looped", "IBM Plex Sans Thai", "sans-serif"],
        // Game-title lettering on the login page.
        display: ["Kanit", "IBM Plex Sans Thai", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
