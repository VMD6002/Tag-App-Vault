/** A FIFO lock: runs `fn` after every earlier call has settled, so the guarded work never overlaps. */
export function createLock() {
  let tail: Promise<unknown> = Promise.resolve();
  return <T>(fn: () => Promise<T>): Promise<T> => {
    const run = tail.then(fn);
    tail = run.catch(() => {});
    return run;
  };
}

/** Scans and syncs never overlap. */
export const withSyncLock = createLock();
