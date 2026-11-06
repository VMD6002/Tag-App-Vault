// Dev-only mock pages (#/mock). Loaded lazily from App.tsx behind import.meta.env.DEV, so none of
// this is part of `vite build`. Each page renders the real app on top of a fake server.
import { Component, type ReactNode, useEffect } from "react";
import { Link, useRoute } from "wouter";
import MockApp from "./MockApp";
import { MOCK_PAGES } from "./pages";
import { installMock } from "./stubs";

// Patch fetch and media URLs before any mock page renders.
installMock();

/** Shows a render error on screen instead of leaving a blank page. */
class MockErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    return this.state.error ? (
      <pre className="m-6 whitespace-pre-wrap border border-destructive p-4 text-xs">
        {this.state.error.stack ?? String(this.state.error)}
      </pre>
    ) : (
      this.props.children
    );
  }
}

export default function Mock() {
  const [match, params] = useRoute("/:page");
  const page = match
    ? MOCK_PAGES.find((p) => p.slug === params.page.split("?")[0])
    : undefined;

  // Mock pages must not touch the network: block image requests to other origins.
  useEffect(() => {
    const meta = document.createElement("meta");
    meta.httpEquiv = "Content-Security-Policy";
    meta.content = "img-src 'self' data: blob:";
    document.head.append(meta);
    return () => meta.remove();
  }, []);

  // Pages hold module-level state (atoms, fake server data); a clean load per change is the simple fix.
  useEffect(() => {
    const reload = () => location.reload();
    window.addEventListener("hashchange", reload);
    return () => window.removeEventListener("hashchange", reload);
  }, []);

  if (page)
    return (
      <MockErrorBoundary>
        <MockApp page={page} />
      </MockErrorBoundary>
    );

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-xl font-semibold">Mock pages</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Dev only. Each page renders the real app on top of a fake server with
        invented data. They are not part of the production build.
      </p>
      <ul className="mt-6 divide-y border">
        {MOCK_PAGES.map((p) => (
          <li key={p.slug}>
            <Link
              href={`/${p.slug}`}
              className="block px-4 py-3 hover:bg-muted/60"
            >
              <span className="font-medium">{p.title}</span>
              <span className="block text-xs text-muted-foreground">
                {p.note}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
