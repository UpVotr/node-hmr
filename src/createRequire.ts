export default function createRequire(
  req: (id: string) => any,
  realReq: NodeJS.Require
): NodeJS.Require {
  const cache = Object.create(null);
  return Object.assign(
    (id: string) => {
      return cache[id] ?? (cache[id] = req(id));
    },
    {
      cache,
      main: realReq.main,
      extensions: realReq.extensions,
      resolve: realReq.resolve
    }
  );
}
