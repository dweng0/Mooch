// electron.vite.config.ts
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "path";
var __electron_vite_injected_dirname = "/home/jay/projects/interview_co_pilot/electron";
var electron_vite_config_default = defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    define: {
      "process.env.WASP_API_URL": JSON.stringify(process.env.WASP_API_URL),
      "process.env.WEBSITE_URL": JSON.stringify(process.env.WEBSITE_URL)
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    plugins: [react(), tailwindcss()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__electron_vite_injected_dirname, "src/renderer/index.html"),
          "area-selector": resolve(__electron_vite_injected_dirname, "src/renderer/area-selector.html")
        }
      }
    }
  }
});
export {
  electron_vite_config_default as default
};
