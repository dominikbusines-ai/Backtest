// Rebuild the browser and iPhone assets from the canonical vector icon.
// Uses sharp, already installed with Next.js. Run: node scripts/generate-icons.mjs
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const app = new URL("../app/", import.meta.url);
const svg = await readFile(new URL("icon.svg", app));
const sizes = [16, 32, 48];
const images = await Promise.all(sizes.map((size) => sharp(svg).resize(size, size).png().toBuffer()));
const header = Buffer.alloc(6 + 16 * sizes.length);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(sizes.length, 4);
let offset = header.length;
images.forEach((png, index) => {
  const entry = 6 + index * 16;
  header[entry] = sizes[index];
  header[entry + 1] = sizes[index];
  header.writeUInt16LE(1, entry + 4);
  header.writeUInt16LE(32, entry + 6);
  header.writeUInt32LE(png.length, entry + 8);
  header.writeUInt32LE(offset, entry + 12);
  offset += png.length;
});
await writeFile(new URL("favicon.ico", app), Buffer.concat([header, ...images]));

// iOS applies its own corner mask; supply an opaque, full-bleed square.
const appleSvg = Buffer.from(svg.toString().replace(' rx="14"', ""));
await sharp(appleSvg).resize(180, 180).png().toFile(fileURLToPath(new URL("apple-icon.png", app)));
console.log("Created favicon.ico (16/32/48 px) and apple-icon.png (180 px).");
