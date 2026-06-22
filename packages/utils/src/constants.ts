export const CTypeDir: Record<(typeof contentTypes)[number], string> = {
  img: "Images",
  video: "Videos",
  audio: "Audios",
  txt: "Texts", // Simply here to fix a type error
  gallery: "Galleries",
};

export const contentTypes = [
  "img",
  "video",
  "audio",
  "txt",
  "gallery",
] as const;
