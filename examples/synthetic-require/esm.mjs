import { createModule, PersistManager, Runner } from "@upvotr/node-hmr";

export default createModule(
  new PersistManager(),
  new Runner(() => {
    return () => console.log("Running from an ES Module!");
  }),
  false
);
