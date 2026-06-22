export function getImageExtensionFromURL(url: string) {
  const tmp = new URL(url);
  return tmp.pathname.split("/").pop()!.split(".").pop();
}
