import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "#141414",
          2: "#1B1B1B",
          3: "#232323",
        },
        paper: {
          DEFAULT: "#EDE7DA",
          2: "#E2DAC8",
        },
        accent: {
          DEFAULT: "#C89B4A",
          soft: "rgba(200,155,74,.16)",
        },
        line: "rgba(237,231,218,.14)",
        "line-strong": "rgba(237,231,218,.26)",
        muted: "rgba(237,231,218,.60)",
        faint: "rgba(237,231,218,.34)",
      },
      fontFamily: {
        serif: ["var(--font-serif)", "Songti SC", "SimSun", "serif"],
        sans: ["var(--font-sans)", "PingFang SC", "Microsoft YaHei", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      letterSpacing: {
        wider2: ".14em",
        widest2: ".18em",
      },
      maxWidth: {
        prose: "44em",
      },
      transitionTimingFunction: {
        editorial: "cubic-bezier(.22,1,.36,1)",
      },
    },
  },
  plugins: [],
};

export default config;
