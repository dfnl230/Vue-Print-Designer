import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import Icons from "unplugin-icons/vite";
import { fileURLToPath, URL } from "node:url";

// https://vite.dev/config/
export default defineConfig({
  base: process.env.VITE_BASE ?? "/",
  plugins: [vue(), Icons({ compiler: "vue3" })],
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
        secure: false,
      },
    },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["vue", "pinia"],
          monaco: ["@guolao/vue-monaco-editor"],
          utils: ["lodash"],
          barcode: ["jsbarcode", "qrcode"],
        },
      },
    },
  },
});
