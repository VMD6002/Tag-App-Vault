import { lazy, Suspense, useEffect } from "react";
import { Router, Route, Switch } from "wouter";
import { ThemeProvider } from "@/components/theme-provider";
import NavBar from "@/components/NavBar";
import Spinner from "@/components/craft/Spinner";
import DocProvider from "./routes/contexts/Doc.Context";
import { useHashLocation } from "wouter/use-hash-location";
import { tagsAtom, themeAtom } from "./atom";
import { useAtomValue, useSetAtom } from "jotai";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { ConfirmProvider } from "./components/craft/confirm-dialog";

const PageNotFound = lazy(() => import("./404"));
const Library = lazy(() => import("./routes/"));
const TagPage = lazy(() => import("./routes/tags"));
const ImagePage = lazy(() => import("./routes/img/[id]"));
const VideoPage = lazy(() => import("./routes/video/[id]"));
const GalleryPage = lazy(() => import("./routes/gallery/[id]"));
const TextPage = lazy(() => import("./routes/txt/[id]"));
const AudioPage = lazy(() => import("./routes/audio/[id]"));
const GenerateJSONPage = lazy(() => import("./routes/generateJSON"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      retry: 1,
    },
  },
});

const MESSAGE_TYPE_SEND_TAGS = "TAG_APP_INJECT_TAGS";
const MESSAGE_TYPE_ACK_TAGS = "TAG_APP_TAGS_RECEIVED";

function App() {
  const theme = useAtomValue(themeAtom);
  const setTags = useSetAtom(tagsAtom);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Security: ensure message comes from the current window frame
      if (event.source !== window) return;

      if (event.data?.type === MESSAGE_TYPE_SEND_TAGS) {
        const receivedTags = event.data.payload;

        if (Array.isArray(receivedTags)) {
          setTags(receivedTags);
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
  }, [setTags]);

  return (
    <Router hook={useHashLocation}>
      <ThemeProvider>
        <NavBar />
        <QueryClientProvider client={queryClient}>
          <main className="max-w-5xl w-[calc(100%-4rem)] mx-auto">
            <Suspense fallback={<Spinner />}>
              <Switch>
                <Route path="/">
                  <Library />
                </Route>
                <Route path="/tags">
                  <TagPage />
                </Route>
                <Route path="/generateContentJson">
                  <GenerateJSONPage />
                </Route>
                <DocProvider>
                  <Route path="/img/:id">
                    <ImagePage />
                  </Route>
                  <Route path="/video/:id">
                    <VideoPage />
                  </Route>
                  <Route path="/gallery/:id">
                    <GalleryPage />
                  </Route>
                  <Route path="/txt/:id">
                    <TextPage />
                  </Route>
                  <Route path="/audio/:id">
                    <AudioPage />
                  </Route>
                </DocProvider>
                <Route>
                  <PageNotFound />
                </Route>
              </Switch>
            </Suspense>
          </main>
        </QueryClientProvider>
        <div className="h-12" />
        <Toaster theme={theme} />
        <ConfirmProvider />
      </ThemeProvider>
    </Router>
  );
}

export default App;
