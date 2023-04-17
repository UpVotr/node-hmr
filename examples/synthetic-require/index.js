const createJITIRequire = require("jiti");
const {
  createSyntheticRequire,
  HMRRuntime,
  FSWatcher
} = require("@upvotr/node-hmr");

const jiti = createJITIRequire(__filename);
const syntheticRequire = createSyntheticRequire(
  (id) => jiti(id).default /* The default export is the HMRModule */,
  require,
  jiti.cache
);

const runtime = new HMRRuntime(new FSWatcher(require), syntheticRequire);

async function main() {
  const es = await runtime.import("./esm.mjs");
  const ts = await runtime.import("./typescript.ts");

  runtime.on("update", () => {
    es.exports();
    ts.exports();
  });

  es.exports();
  // Logs "Running from an ES Module!"
  ts.exports();
  // Logs "Running from a TypeScript Module!"
}

main();
