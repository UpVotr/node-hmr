import HMRRuntime from "@upvotr/node-hmr";

const runtime = new HMRRuntime();

async function main() {
  const a = await runtime.import("./a.js");

  a.exports.foo();

  runtime.on("update", (moduleId) => {
    if (moduleId === "./a.js") a.exports.foo();
  });
}
