import { build } from "esbuild";
import { copyFileSync, mkdirSync } from "fs";

// Bundle plugin main thread code
await build({
  entryPoints: ["src/code.ts"],
  bundle: true,
  outfile: "build/code.js",
  format: "iife",
  target: "es2017",
  platform: "browser",
});

// Copy UI HTML (the WebSocket bridge iframe)
mkdirSync("build", { recursive: true });
copyFileSync("src/ui.html", "build/ui.html");

console.log("Plugin build complete: build/code.js + build/ui.html");
