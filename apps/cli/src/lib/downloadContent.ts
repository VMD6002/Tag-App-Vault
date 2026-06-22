import { USER_AGENT } from "./constants";
import { writeFileSync } from "node:fs";

export async function downloadContent(url: string, filePath: string) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
    },
  });
  const buffer = Buffer.from(await response.arrayBuffer());
  writeFileSync(filePath, buffer);
}
