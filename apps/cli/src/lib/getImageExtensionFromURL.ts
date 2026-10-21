export function getImageExtensionFromURL(url: string) {
  const { searchParams, pathname } = new URL(url);
  const ext = searchParams.get("ext") ?? /\.([a-z0-9]+)$/i.exec(pathname)?.[1];
  if (!ext) throw new Error(`Cannot extract extension from URL: ${url}`);
  return ext.toLowerCase();
}
