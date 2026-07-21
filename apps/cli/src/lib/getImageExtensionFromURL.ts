export function getImageExtensionFromURL(url: string) {
  const tmp = new URL(url);
  const ext = tmp.searchParams.get("ext");
  if (ext) return ext;

  const segments = tmp.pathname.split("/").filter(Boolean);
  const filename = segments.pop();
  if (!filename) throw new Error(`Cannot extract extension from URL: ${url}`);

  const dotParts = filename.split(".");
  const extension = dotParts.pop();
  if (!extension) throw new Error(`No file extension found in URL: ${url}`);

  return extension;
}
