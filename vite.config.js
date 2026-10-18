import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const apiTarget = `http://localhost:${process.env.PORT || 3000}`;

export default defineConfig({
  root: "client",
  plugins: [react()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  server: {
    proxy: {
      "/api": apiTarget,
      "/socket.io": {
        target: apiTarget,
        ws: true,
      },
    },
  },
});
