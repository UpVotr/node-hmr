const { createModule, PersistManager, Runner } = require("@upvotr/node-hmr");

module.exports = createModule(
  new PersistManager(),
  new Runner(() => ({ bar: () => console.log("bar") })),
  false
);
