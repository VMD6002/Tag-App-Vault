let tail: Promise<unknown> = Promise.resolve();

/** Runs `fn` after every earlier call has settled, so scans and syncs never overlap. */
export function withSyncLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = tail.then(fn);
  tail = run.catch(() => {});
  return run;
}
