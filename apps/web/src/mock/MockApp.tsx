import { useEffect, useMemo, useState } from "react";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import AppLayout from "@/AppLayout";
import { buildDb, countTags, mockTagCovers } from "./data";
import MockShell from "./MockShell";
import type { MockPage } from "./pages";
import { configureMock } from "./stubs";
import { useScenario } from "./useScenario";

const MESSAGE_SEND_TAGS = "TAG_APP_INJECT_TAGS";
const MESSAGE_ACK_TAGS = "TAG_APP_TAGS_RECEIVED";

/** Sets a React-controlled input's value the way typing would. */
function typeInto(input: HTMLInputElement, value: string) {
  const set = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )?.set;
  set?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

/**
 * Renders the real app (nav bar + routes) inside an in-memory router, on top of the fake server.
 * The real `App` is still mounted around it, so its tag handshake with the extension runs for real.
 */
export default function MockApp({ page }: { page: MockPage }) {
  const { scenario, extension, setScenario, setExtension } = useScenario();
  const [tagsAck, setTagsAck] = useState(false);

  const location = useMemo(
    () => memoryLocation({ path: page.path(scenario) }),
    [page, scenario],
  );

  // Configure before the first render so the first request already sees the scenario.
  useMemo(() => configureMock(scenario, page.affects), [scenario, page]);

  // react-doctor-disable-next-line react-doctor/effect-needs-cleanup -- false positive: the cleanup below clears the (conditional) timer
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.source === window && e.data?.type === MESSAGE_ACK_TAGS)
        setTagsAck(true);
    };
    window.addEventListener("message", onMessage);
    // Same message the extension's content script sends
    const timer = extension
      ? setTimeout(
          () =>
            window.postMessage(
              {
                type: MESSAGE_SEND_TAGS,
                payload: Object.keys(
                  countTags(
                    buildDb(scenario === "empty" ? "normal" : scenario),
                  ),
                ),
                covers: mockTagCovers(),
              },
              "*",
            ),
          100,
        )
      : undefined;
    return () => {
      window.removeEventListener("message", onMessage);
      clearTimeout(timer);
    };
  }, [extension, scenario]);

  // Scenarios that need a filter to be set: type it in for real.
  useEffect(() => {
    const selector = page.search;
    if (scenario !== "noresults" || !selector) return;
    const timer = setInterval(() => {
      const input = document.querySelector<HTMLInputElement>(selector);
      if (!input) return;
      typeInto(input, "zzzz no match");
      if (page.applySearch)
        input.dispatchEvent(
          new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
        );
      clearInterval(timer);
    }, 200);
    return () => clearInterval(timer);
  }, [scenario, page]);

  return (
    <MockShell
      title={page.title}
      note={page.note}
      scenarios={page.scenarios}
      scenario={scenario}
      onScenario={setScenario}
      extension={extension}
      onExtension={setExtension}
      tagsAck={tagsAck}
    >
      <Router hook={location.hook} searchHook={location.searchHook}>
        <AppLayout />
      </Router>
    </MockShell>
  );
}
