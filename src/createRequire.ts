export function createSyntheticRequire(
  req: (id: string) => any,
  realReq: NodeJS.Require,
  cache?: any,
  resolve?: (id: string) => string
): NodeJS.Require {
  const _cache = cache || Object.create(null);
  const _resolve = resolve || realReq.resolve;
  return Object.assign(
    cache
      ? (id: string) => req(id)
      : (id: string) => (id in _cache ? _cache[id] : (_cache[id] = req(id))),
    {
      cache: _cache,
      main: realReq.main,
      extensions: realReq.extensions,
      resolve: _resolve as NodeJS.RequireResolve
    }
  );
}
