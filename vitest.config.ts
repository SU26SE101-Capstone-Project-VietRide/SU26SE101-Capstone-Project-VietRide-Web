import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    // Pinned here, not read from a .env file: .env and .env.* are gitignored, so a
    // fresh clone or a CI runner has neither. Tests assert on the exact request URL,
    // which would collapse to a relative path without this and fail ~29 assertions.
    env: {
      VITE_API_BASE_URL: "https://api.vietride.online",
    },
  },
});
