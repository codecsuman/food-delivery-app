import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    // Matches the production same-origin layout, so relative `/api/v1`
    // requests work even when no VITE_API_BASE_URL is configured.
    proxy: {
      "/api": { target: "http://localhost:8001", changeOrigin: true },
      "/health": { target: "http://localhost:8001", changeOrigin: true },
      "/socket.io": { target: "http://localhost:8001", ws: true, changeOrigin: true },
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Split large vendor libraries so the main app chunk stays small and
        // browsers can cache these dependencies across deployments.
        manualChunks: {
          "react-vendor": ["react", "react-dom", "react-router-dom"],
          "map-vendor": ["leaflet", "react-leaflet"],
          "ui-vendor": ["framer-motion", "lucide-react", "sonner", "date-fns"],
          "data-vendor": ["axios", "zustand", "socket.io-client", "zod"],
        },
      },
    },
  },
})
