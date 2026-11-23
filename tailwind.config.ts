import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        midnight: "#0D1B2A",
        navy: "#1B263B",
        "navy-2": "#243149",
        orange: { DEFAULT: "#E17226", hover: "#C9611B", soft: "#E1722626" },
        smoke: "#F7F7F5",
        steel: "#8892A0",
        line: "#2C3A52",
      },
      fontFamily: {
        heading: ["Mulish", "system-ui", "sans-serif"],
        serif: ["Lora", "Georgia", "serif"],
        sans: ["Inter", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
      },
      borderRadius: { DEFAULT: "6px", sm: "4px", md: "6px", lg: "8px" },
      letterSpacing: { tightest: "-0.03em" },
    },
  },
  plugins: [],
};
export default config;
