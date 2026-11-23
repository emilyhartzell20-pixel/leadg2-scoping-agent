import type { Config } from "tailwindcss";

/** LeadG2 brand system v1.1 — leadg2.thecenterforsalesstrategy.com/leadg2-brand-guide */
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: "#1B263B", // headlines + body on light
        midnight: "#0D1B2A", // closing panels, feature bands, the side we recommend
        cream: "#F7F3EE", // hero background
        smoke: "#F4F4F4", // alternate sections
        line: "#E0E1DD", // card borders + dividers
        slate: "#50606D", // card/body copy on light
        mist: "#AEB6C4", // body text on midnight
        steel: "#9DA6B5", // G2 on dark, secondary text on dark
        orange: { DEFAULT: "#E17226", dark: "#C2611C", light: "#F2913F" },
      },
      fontFamily: {
        sans: ["Mulish", "Arial", "sans-serif"], // headlines, UI, labels
        serif: ["Lora", "Georgia", "serif"], // body, leads, accents
      },
      borderRadius: { sm: "6px", DEFAULT: "6px", md: "8px", lg: "12px", xl: "22px" },
      maxWidth: { page: "1240px", read: "900px" },
    },
  },
  plugins: [],
};
export default config;
