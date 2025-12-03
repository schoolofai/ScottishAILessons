import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      keyframes: {
        "message-glow": {
          "0%": {
            boxShadow: "0 0 0 0 rgba(59, 130, 246, 0)",
            backgroundColor: "rgba(59, 130, 246, 0)",
          },
          "20%": {
            boxShadow: "0 0 20px 4px rgba(59, 130, 246, 0.3)",
            backgroundColor: "rgba(59, 130, 246, 0.05)",
          },
          "50%": {
            boxShadow: "0 0 25px 6px rgba(59, 130, 246, 0.2)",
            backgroundColor: "rgba(59, 130, 246, 0.03)",
          },
          "100%": {
            boxShadow: "0 0 0 0 rgba(59, 130, 246, 0)",
            backgroundColor: "rgba(59, 130, 246, 0)",
          },
        },
      },
      animation: {
        "message-glow": "message-glow 1.5s ease-out forwards",
      },
    },
  },
  plugins: [
    require("@tailwindcss/typography"),
  ],
};

export default config;
