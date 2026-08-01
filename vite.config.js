import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: process.env.PORT ? parseInt(process.env.PORT) : 5199,
    strictPort: false,
  },
  build: {
    rollupOptions: {
      input: {
        main: "index.html",
        admin: "admin.html",
      },
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/@firebase/firestore") || id.includes("node_modules/firebase/firestore")) return "fb-firestore";
          if (id.includes("node_modules/@firebase/auth") || id.includes("node_modules/firebase/auth")) return "fb-auth";
          if (id.includes("node_modules/@firebase/messaging") || id.includes("node_modules/firebase/messaging")) return "fb-messaging";
          if (id.includes("node_modules/firebase/") || id.includes("node_modules/@firebase/")) return "fb-core";
          if (id.includes("node_modules/idb")) return "fb-core";
        },
      },
    },
  },
  test: {
    environment: "node",
    setupFiles: ["fake-indexeddb/auto"],
  },
});
