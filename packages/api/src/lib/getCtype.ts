export const getFileExt = (fileName: string) => {
  const ext = fileName.slice(((fileName.lastIndexOf(".") - 1) >>> 0) + 2);
  const FileName = fileName.slice(0, -1 * (ext.length + 1));
  return [ext, FileName] as const;
};

export default function getCtype(fileName: string) {
  const [FileExt, Name] = getFileExt(fileName);
  let Ctype = "invalid";
  switch (FileExt) {
    case "jpg":
    case "jpeg":
    case "png":
    case "webp":
    case "svg":
    case "avif":
    case "apng":
    case "gif":
      Ctype = "img";
      break;
    case "mp4":
    case "webm":
    case "avi":
      Ctype = "video";
      break;
    case "mp3":
    case "wav":
      Ctype = "audio";
      break;
    case "txt":
    case "md":
      Ctype = "txt";
      break;
  }
  return [Ctype, FileExt, Name] as const;
}
