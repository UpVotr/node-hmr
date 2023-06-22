const { createRuntime } = require("@upvotr/node-hmr");

const runtime = createRuntime(require);

async function main() {
  const a = await runtime.import("./a.js");

  a.exports.foo();

  runtime.on("update", (moduleId) => {
    if (moduleId === "./a.js") a.exports.foo();
  });
}

main();
