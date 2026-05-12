import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#f7f6f2",
        surface: "#ffffff",
        surface2: "#f1efe9",
        ink: "#22201c",
        muted: "#6f6b63",
        line: "#dad6ce",
        accent: "#0f6c73",
        accentSoft: "#dbe9e7",
        danger: "#b3261e",
      },
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
      },
      borderRadius: {
        card: "16px",
      },
      boxShadow: {
        card: "0 10px 30px rgba(0,0,0,.06)",
      },
    },
  },
  plugins: [],
};

export default config;
