import { createModule, createRunner } from "@upvotr/node-hmr";

export default createModule(
  null,
  createRunner(() => {
    return () => console.log("Running from a TypeScript Module!" as string);
  })
);
