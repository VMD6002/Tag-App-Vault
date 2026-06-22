import { extname, join, parse } from "node:path";
import { readdir, rename, rm } from "node:fs/promises";
import { ORPCError } from "@orpc/server";

export async function rmByBasename(dir: string, basename: string) {
  const files = await readdir(dir);
  const foundFile = files.find((file) => parse(file).name === basename);

  if (!foundFile) {
    throw new ORPCError("NOT_FOUND", {
      message: `No file found with the name: "${basename}"`,
    });
  }

  const filePath = join(dir, foundFile);
  await rm(filePath);

  console.log(`✓ Deleted: ${filePath}`);
}

export async function renameByBasename(
  dir: string,
  targetBasename: string,
  newName: string,
  newDir?: string,
) {
  const files = await readdir(dir);

  // Find the file where the name matches (excluding extension)
  const foundFile = files.find((file) => parse(file).name === targetBasename);

  if (!foundFile) {
    throw new ORPCError("NOT_FOUND", {
      message: `No file found with the name: "${targetBasename}"`,
    });
  }

  const oldPath = join(dir, foundFile);
  const extension = extname(foundFile);
  const newPath = join(newDir ?? dir, `${newName}${extension}`);

  await rename(oldPath, newPath);

  console.log(
    newDir
      ? `✓ Moved: ${dir}/${foundFile} → ${newDir}/${foundFile}`
      : `✓ Renamed: ${foundFile} → ${newName}${extension}`,
  );
}
