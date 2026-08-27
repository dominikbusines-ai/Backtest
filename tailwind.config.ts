import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#080a0d",
        panel: "#0f1217",
        line: "#252a31",
        lime: "#b7f34b",
      },
      boxShadow: {
        glow: "0 0 40px rgba(183, 243, 75, 0.08)",
      },
    },
  },
  plugins: [],
} satisfies Config;
