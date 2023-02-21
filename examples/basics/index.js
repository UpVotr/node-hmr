import HMRRuntime, { FSWatcher } from "@upvotr/node-hmr";
import { createRequire } from "module";

const runtime = new HMRRuntime(new FSWatcher(), createRequire(import.meta.url));

async function main() {
  const a = await runtime.import("./a.js");

  a.exports.foo();

  runtime.on("update", (moduleId) => {
    if (moduleId === "./a.js") a.exports.foo();
  });
}

main();
