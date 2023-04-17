const { Router } = require("express");
const { createModule, PersistManager, Runner } = require("@upvotr/node-hmr");

module.exports = createModule(
  new PersistManager(),
  new Runner(() => {
    const router = Router();

    router.get("/", (req, res) => {
      res.send("foo!");
    });

    return router;
  }),
  false
);
