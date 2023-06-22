import { createRunner, hmr } from "@upvotr/node-hmr";

export default hmr(
  null,
  createRunner(() => {
    return () => console.log("Running from an ES Module!");
  })
);
