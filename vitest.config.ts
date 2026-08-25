import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    testTimeout: 15_000,
    // Pinned here, not read from a .env file: .env and .env.* are gitignored, so a
    // fresh clone or a CI runner has neither.
    env: {
      // Tests assert on the exact request URL, which would collapse to a relative
      // path without this and fail ~29 assertions.
      VITE_API_BASE_URL: "https://api.vietride.online",

      // `src/config/firebase.ts` THROWS at import time when any of these is
      // missing, so every suite whose component tree reaches EvidenceUploader →
      // firebaseImageUpload → config/firebase fails to even load on a machine
      // without .env (CI). Values are dummies: no test talks to Firebase for
      // real — the ones that exercise it mock `firebase/*` or `config/firebase`.
      VITE_FIREBASE_API_KEY: "test-firebase-api-key",
      VITE_FIREBASE_APP_ID: "1:0:web:test",
      VITE_FIREBASE_AUTH_DOMAIN: "vietride-test.firebaseapp.com",
      VITE_FIREBASE_PROJECT_ID: "vietride-test",
      VITE_FIREBASE_STORAGE_BUCKET: "vietride-test.appspot.com",
    },
  },
});
