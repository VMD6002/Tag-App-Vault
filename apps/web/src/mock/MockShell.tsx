import type { ReactNode } from "react";
import { Link } from "wouter";
import { SCENARIOS } from "./useScenario";

/** Dev-only strip above every mock page: way back, what it shows, scenario and extension switches. */
export default function MockShell({
  title,
  note,
  scenarios,
  scenario,
  onScenario,
  extension,
  onExtension,
  tagsAck,
  children,
}: {
  title: string;
  note: string;
  scenarios: string[];
  scenario: string;
  onScenario: (id: string) => void;
  extension: boolean;
  onExtension: (on: boolean) => void;
  /** Whether the app answered the injected tags with TAG_APP_TAGS_RECEIVED. */
  tagsAck: boolean;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <div className="relative z-[60] flex flex-wrap items-center gap-x-4 gap-y-2 border-b-2 border-dashed border-amber-500/70 bg-amber-500/10 px-4 py-2 text-xs backdrop-blur">
        <Link href="/" className="underline">
          ← mock index
        </Link>
        <strong>{title}</strong>
        <span className="hidden text-muted-foreground lg:inline">{note}</span>
        <div className="ml-auto flex flex-wrap items-center gap-1">
          <span className="text-muted-foreground">scenario:</span>
          {SCENARIOS.filter((s) => scenarios.includes(s.id)).map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => onScenario(s.id)}
              aria-pressed={scenario === s.id}
              className={`cursor-pointer border px-2 py-0.5 ${scenario === s.id ? "bg-foreground text-background" : "hover:bg-muted"}`}
            >
              {s.label}
            </button>
          ))}
          <label
            className="ml-3 flex cursor-pointer items-center gap-1"
            title="Posts the tag list to the page the way the browser extension does. Off = the app has no extension, so edit/remove/sync controls are hidden."
          >
            <input
              type="checkbox"
              checked={extension}
              onChange={(e) => onExtension(e.target.checked)}
            />
            extension connected
            {extension && (
              <span className="text-muted-foreground">
                ({tagsAck ? "tags acknowledged" : "waiting for ack"})
              </span>
            )}
          </label>
        </div>
      </div>
      {children}
    </div>
  );
}
