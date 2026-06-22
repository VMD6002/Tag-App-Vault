export default function saveJsonFile(
  JsonString: Record<string, any>,
  FileName: string
) {
  const DownloadDataFile = new Blob([JSON.stringify(JsonString)], {
    type: "application/json",
  });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(DownloadDataFile);
  link.download = `${FileName}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 0);
}
