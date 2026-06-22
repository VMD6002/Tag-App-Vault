import filenamify from "filenamify";

export const sanitizeStringForFileName = (string: string) =>
  filenamify(string, {
    replacement: "-", // Replaces invalid characters with a dash
    maxLength: 120, // Handles your Windows safe path limits perfectly!
  });

export function applyConstants(
  rawString: string,
  constants: Record<string, string>,
) {
  return rawString.replace(/\$(\w+)/g, (match, key) => {
    return constants[key] ?? match;
  });
}
export function replaceWithConstantKey(
  text: string,
  constants: Record<string, string>,
) {
  let newText = text;
  for (const [key, value] of Object.entries(constants)) {
    newText = newText.replaceAll(value, "$" + key);
  }
  return newText;
}
