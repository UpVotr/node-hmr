const { hmr, createRunner } = require("@upvotr/node-hmr");

module.exports = hmr(
  null,
  createRunner(() => ({ bar: () => console.log("bar") }))
);
