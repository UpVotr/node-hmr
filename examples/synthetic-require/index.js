const createJITIRequire = require("jiti");
const { synthetic, createRuntime } = require("@upvotr/node-hmr");

const jiti = createJITIRequire(__filename);
const syntheticRequire = synthetic(
  (id) => jiti(id).default /* The default export is the HMRModule */,
  require,
  jiti.cache
);

const runtime = createRuntime(syntheticRequire);

async function main() {
  const es = await runtime.import("./esm.mjs");
  const ts = await runtime.import("./typescript.ts");

  runtime.on("update", () => {
    es.exports();
    ts.exports();
  });

  // Logs "Running from an ES Module!"
  es.exports();
  // Logs "Running from a TypeScript Module!"
  ts.exports();
}

main();
