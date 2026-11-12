import {
  parseInjectedGroups,
  parseTagCovers,
  withReservedTags,
} from "@tagapp/utils";
import { useAtomValue, useSetAtom } from "jotai";
import { lazy, Suspense, useEffect } from "react";
import { Toaster } from "sonner";
import { Route, Router, Switch } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import Spinner from "@/components/craft/Spinner";
import { ThemeProvider } from "@/components/theme-provider";
import AppLayout from "./AppLayout";
import { injectedGroupsAtom, tagCoversAtom, tagsAtom, themeAtom } from "./atom";
import { ConfirmProvider } from "./components/craft/confirm-dialog";

// Dev-only mock pages (#/mock); absent from production builds.
const Mock = import.meta.env.DEV ? lazy(() => import("./mock")) : null;

const MESSAGE_TYPE_SEND_TAGS = "TAG_APP_INJECT_TAGS";
const MESSAGE_TYPE_ACK_TAGS = "TAG_APP_TAGS_RECEIVED";

function App() {
  const theme = useAtomValue(themeAtom);
  const setTags = useSetAtom(tagsAtom);
  const setTagCovers = useSetAtom(tagCoversAtom);
  const setInjectedGroups = useSetAtom(injectedGroupsAtom);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Security: ensure message comes from the current window frame
      if (event.source !== window) return;

      if (event.data?.type === MESSAGE_TYPE_SEND_TAGS) {
        const receivedTags = event.data.payload;

        if (Array.isArray(receivedTags)) {
          setTags(withReservedTags(receivedTags));
          setTagCovers(parseTagCovers(event.data.covers));
          setInjectedGroups(parseInjectedGroups(event.data.groups));
          console.log("Tags received and updated in React state.");

          // Send ACK back to content script to stop retries
          window.postMessage({ type: MESSAGE_TYPE_ACK_TAGS }, "*");
        }
      }
    };

    window.addEventListener("message", handleMessage);

    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, [setTags, setTagCovers, setInjectedGroups]);

  return (
    <Router hook={useHashLocation}>
      <ThemeProvider>
        <Switch>
          {Mock && (
            <Route path="/mock" nest>
              <Suspense fallback={<Spinner />}>
                <Mock />
              </Suspense>
            </Route>
          )}
          <Route>
            <AppLayout />
          </Route>
        </Switch>
        <Toaster theme={theme} />
        <ConfirmProvider />
      </ThemeProvider>
    </Router>
  );
}

export default App;
