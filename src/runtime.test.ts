import { createModule } from "./createModule";
import { PersistManager } from "./persistManager";
import { Runner } from "./runner";
import { HMRRuntime } from "./runtime";
import { Watcher } from "./watcher";

class TestWatcher extends Watcher {
  watch(id: string): () => void {
    return () => {};
  }

  trigger(id: string) {
    this.emit("update", id);
  }
}

describe("Modules should update automatcally", () => {
  const module = createModule(
    new PersistManager(
      () => ({}),
      () => {}
    ),
    new Runner(
      () => "string 1",
      () => {}
    ),
    false
  );

  const module2 = createModule(
    new PersistManager(
      () => ({}),
      () => {}
    ),
    new Runner(
      () => "string 2",
      () => {}
    ),
    false
  );

  const cache = Object.create(null);
  const mockedRequire: NodeJS.Require = Object.assign(
    jest.fn((id: string) => {
      return cache[id] ?? (cache[id] = module2);
    }),
    {
      cache,
      resolve: require.resolve,
      extensions: require.extensions,
      main: require.main
    }
  );

  cache["module"] = module;

  const watcher = new TestWatcher();
  const runtime = new HMRRuntime(watcher, mockedRequire);

  let imported: { exports: string | undefined };

  test("Modules loads correctly", async () => {
    imported = await runtime.import<string>("module");
    expect(imported.exports).toEqual("string 1");
  });

  test("Module updates correctly", async () => {
    watcher.trigger("module");
    const newImport = await runtime.import<string>("module");
    expect(newImport.exports).toEqual("string 2");
    expect(imported.exports).toEqual("string 2");
    expect(imported).toEqual(newImport);
  });
});
