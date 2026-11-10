export const USAGE = `Usage: bun index.js [options]

Downloads every item queued in tmp.json into ./tmp, then moves the finished
files into ../Sync (the server syncs them into the library).

Options:
  -r, --retry [N]  When tasks fail, wait retryDelayMinutes (config.json) and run
                   the remaining queue again. N = max retries (positive integer);
                   without N, retry forever.
  -h, --help       Show this help.

Files (relative to the current directory):
  tmp.json     download queue (read; finished items are removed)
  ./tmp        scratch dir; kept between runs so partial downloads resume
  ../Sync      finished downloads
  error.log    failure messages (appended)
  cookies/     <Site>.txt cookie files for items tagged meta:yt-cookie
  config.json  userAgent and retryDelayMinutes (created with defaults if missing)
`;

export interface Args {
  help: boolean;
  /** Max retries after the first run; 0 = none, Infinity = until the queue is empty. */
  retries: number;
}

/** Throws an Error with a user-facing message on invalid input. */
export function parseArgs(argv: string[]): Args {
  let retries = 0;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] as string;
    if (a === "-h" || a === "--help") return { help: true, retries };
    if (a === "-r" || a === "--retry") {
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("-")) retries = Infinity;
      else {
        retries = Number(next);
        if (!/^\d+$/.test(next) || retries < 1)
          throw new Error(
            `Invalid retry count "${next}": expected a positive integer`,
          );
        i++;
      }
    } else throw new Error(`Unknown argument: ${a}`);
  }
  return { help: false, retries };
}
