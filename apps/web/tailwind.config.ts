import type { Config } from "tailwindcss";

// Color tokens lifted from the provided Stitch design template
// (stitch_network_security_learning_platform) so the app matches
// the approved visual design out of the box.
const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: "#0b1326",
        "surface-dim": "#0b1326",
        "surface-bright": "#31394d",
        "surface-container-lowest": "#060e20",
        "surface-container-low": "#131b2e",
        "surface-container": "#171f33",
        "surface-container-high": "#222a3d",
        "surface-container-highest": "#2d3449",
        "surface-variant": "#2d3449",
        "on-surface": "#dae2fd",
        "on-surface-variant": "#c2c6d6",
        outline: "#8c909f",
        "outline-variant": "#424754",
        primary: "#adc6ff",
        "primary-container": "#4d8eff",
        "on-primary": "#002e6a",
        "on-primary-container": "#00285d",
        secondary: "#4edea3",
        "secondary-container": "#00a572",
        "on-secondary": "#003824",
        "on-secondary-container": "#00311f",
        tertiary: "#ffb95f",
        "tertiary-container": "#ca8100",
        "on-tertiary": "#472a00",
        "on-tertiary-container": "#3e2400",
        error: "#ffb4ab",
        "error-container": "#93000a",
        "on-error": "#690005",
        "on-error-container": "#ffdad6",
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
