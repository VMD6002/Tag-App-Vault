import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { lazy, Suspense } from "react";
import { Route, Switch } from "wouter";
import Spinner from "@/components/craft/Spinner";
import NavBar from "@/components/NavBar";
import DocProvider from "./routes/contexts/Doc.Context";

const PageNotFound = lazy(() => import("./404"));
const Library = lazy(() => import("./routes/"));
const SyncPage = lazy(() => import("./routes/sync"));
const DownloadsPage = lazy(() => import("./routes/downloads"));
const TagPage = lazy(() => import("./routes/tags"));
const ImagePage = lazy(() => import("./routes/img/[id]"));
const VideoPage = lazy(() => import("./routes/video/[id]"));
const GalleryPage = lazy(() => import("./routes/gallery/[id]"));
const TextPage = lazy(() => import("./routes/txt/[id]"));
const AudioPage = lazy(() => import("./routes/audio/[id]"));
const SettingsPage = lazy(() => import("./routes/settings"));
const GroupsPage = lazy(() => import("./routes/group"));
const GroupPage = lazy(() => import("./routes/group/[id]"));
const ReferencePage = lazy(() => import("./routes/reference"));

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      retry: 1,
    },
  },
});

const DOC_ROUTE = /^\/(img|video|gallery|txt|audio)\/[^/]+$/;

/** Nav bar plus every page. Shared by the real app and the dev-only #/mock pages. */
export default function AppLayout() {
  return (
    <>
      <NavBar />
      <QueryClientProvider client={queryClient}>
        <main className="mx-auto w-[calc(100%-2rem)] max-w-6xl sm:w-[calc(100%-4rem)]">
          <Suspense fallback={<Spinner />}>
            <Switch>
              <Route path="/">
                <Library />
              </Route>
              <Route path="/sync">
                <SyncPage />
              </Route>
              <Route path="/downloads">
                <DownloadsPage />
              </Route>
              <Route path="/tags">
                <TagPage />
              </Route>
              <Route path="/settings">
                <SettingsPage />
              </Route>
              <Route path="/group">
                <GroupsPage />
              </Route>
              <Route path="/group/:id">
                <GroupPage />
              </Route>
              <Route path="/reference">
                <ReferencePage />
              </Route>
              {/* DocProvider has no path, so it must sit inside a Route or Switch would match it for every URL and the 404 would never render */}
              <Route path={DOC_ROUTE}>
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
              </Route>
              <Route>
                <PageNotFound />
              </Route>
            </Switch>
          </Suspense>
        </main>
      </QueryClientProvider>
      <div className="h-12" />
    </>
  );
}
