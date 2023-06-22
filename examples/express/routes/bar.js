const { Router } = require("express");
const { hmr, createRunner } = require("@upvotr/node-hmr");

module.exports = hmr(
  null,
  createRunner(() => {
    const router = Router();

    router.get("/", (req, res) => {
      res.send("bar!");
    });

    return router;
  })
);
