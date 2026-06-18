import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import Icons from "unplugin-icons/vite";
import { fileURLToPath, URL } from "node:url";
import { readFileSync } from "node:fs";

const packageJson = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf-8"),
) as { version?: string };
const printDesignerVersion = packageJson.version || "0.0.0";

// https://vite.dev/config/
export default defineConfig({
  base: process.env.VITE_BASE ?? "/",
  plugins: [vue(), Icons({ compiler: "vue3" })],
  define: {
    __PRINT_DESIGNER_VERSION__: JSON.stringify(printDesignerVersion),
  },
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
