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
