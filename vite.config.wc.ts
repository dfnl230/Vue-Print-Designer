import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import Icons from "unplugin-icons/vite";
import { fileURLToPath, URL } from "node:url";
import { visualizer } from "rollup-plugin-visualizer";

export default defineConfig({
  plugins: [
    vue(),
    Icons({ compiler: "vue3" }),
    visualizer({ filename: "stats-wc.html", open: false }),
  ],
  define: {
    __VUE_PROD_DEVTOOLS__: false,
    __VUE_I18N_FULL_INSTALL__: false,
    __VUE_I18N_LEGACY_API__: false,
    __INTLIFY_PROD_DEVTOOLS__: false,
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "html2canvas": fileURLToPath(new URL("./src/mock/html2canvas.ts", import.meta.url)),
      "canvg": fileURLToPath(new URL("./src/mock/canvg.ts", import.meta.url)),
      "dompurify": fileURLToPath(new URL("./src/mock/dompurify.ts", import.meta.url)),
    },
  },
  build: {
    minify: "terser",
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
    lib: {
      entry: fileURLToPath(new URL("./src/web-component.ts", import.meta.url)),
      name: "PrintDesigner",
      formats: ["es", "umd"],
      fileName: (format) => `print-designer.${format}.js`,
    },
    outDir: "dist-wc",
    rollupOptions: {
      output: {
        minifyInternalExports: true,
        manualChunks: undefined,
        assetFileNames: (assetInfo) => {
          const name = assetInfo.name || "";
          if (name.endsWith(".css")) return "print-designer.css";
          return "assets/[name][extname]";
        },
      },
    },
  },
});
