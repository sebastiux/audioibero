import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Rutas relativas: funciona igual en https://<usuario>.github.io/<repo>/ que en local.
  base: "./",
  plugins: [react()],
  // Config inline para no heredar el postcss.config.mjs (Tailwind) de la app Next.js de la raíz.
  css: { postcss: { plugins: [] } },
  test: { include: ["tests/**/*.test.ts"], environment: "node" },
});
