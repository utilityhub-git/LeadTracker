/** Serialize MongoDB bulk writes (avoids "collection dropped" under concurrent imports). */
let tail = Promise.resolve();

export function serializeImportWrite<T>(fn: () => Promise<T>): Promise<T> {
  const run = tail.then(fn);
  tail = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}
