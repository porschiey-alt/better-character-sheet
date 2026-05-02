import esbuild from "esbuild";
import { sassPlugin } from "esbuild-sass-plugin";

const isWatch = process.argv.includes("--watch");

const buildOptions = {
  entryPoints: ["src/module.ts"],
  bundle: true,
  outfile: "dist/module.js",
  format: "esm",
  platform: "browser",
  sourcemap: true,
  minify: !isWatch,
  keepNames: true,
  plugins: [
    sassPlugin({
      type: "css",
      cssImports: true,
    }),
  ],
  // Don't bundle Foundry/dnd5e globals — they're available at runtime
  external: [],
  logLevel: "info",
};

// Also build the SCSS separately so module.json can reference the CSS file directly
const cssOptions = {
  entryPoints: ["src/styles/better-character-sheet.scss"],
  bundle: true,
  outfile: "dist/better-character-sheet.css",
  sourcemap: true,
  minify: !isWatch,
  plugins: [sassPlugin({ type: "css" })],
  logLevel: "info",
};

if (isWatch) {
  const jsCtx = await esbuild.context(buildOptions);
  const cssCtx = await esbuild.context(cssOptions);
  await jsCtx.watch();
  await cssCtx.watch();
  console.log("Watching for changes...");
} else {
  await esbuild.build(buildOptions);
  await esbuild.build(cssOptions);
}
