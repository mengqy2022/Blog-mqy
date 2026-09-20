/* Regenerate all favicon sizes from a single square source image.
 *
 * Usage:
 *   node scripts/generate-favicons.mjs <path-to-source-image>
 *
 * The source image should be a square PNG (e.g. 512x512 or larger).
 * It writes the 8 files used by the site (light/dark x 32/128/180/192)
 * into public/favicon/:
 *   favicon-light-32.png  favicon-dark-32.png
 *   favicon-light-128.png favicon-dark-128.png
 *   favicon-light-180.png favicon-dark-180.png
 *   favicon-light-192.png favicon-dark-192.png
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const outputDir = path.join(projectRoot, "public", "favicon");

const source = process.argv[2];
if (!source) {
  console.error("Error: no source image provided.");
  console.error('Usage: node scripts/generate-favicons.mjs <path-to-source-image>');
  process.exit(1);
}

const sizes = [32, 128, 180, 192];

// --- Inspect the source image ---
const image = sharp(source);
const meta = await image.metadata();
console.log(`Source: ${source}`);
console.log(`Size: ${meta.width}x${meta.height} | Format: ${meta.format} | Has alpha: ${meta.hasAlpha}`);

const { data, info } = await image
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
const pixel = (x, y) => {
  const i = (y * info.width + x) * 4;
  return `rgba(${data[i]}, ${data[i + 1]}, ${data[i + 2]}, ${(data[i + 3] / 255).toFixed(2)})`;
};
console.log(`Top-left pixel: ${pixel(0, 0)}`);
console.log(`Center pixel:   ${pixel(Math.floor(info.width / 2), Math.floor(info.height / 2))}`);
console.log(`Bottom-right:   ${pixel(info.width - 1, info.height - 1)}`);
if (meta.hasAlpha) {
  console.log("Note: image has transparency — it works in both light and dark mode.");
} else {
  console.log("Note: image has NO transparency (opaque background). The favicon will show as a solid square.");
}

// --- Generate the favicon files ---
await fs.mkdir(outputDir, { recursive: true });
for (const size of sizes) {
  for (const theme of ["light", "dark"]) {
    const file = path.join(outputDir, `favicon-${theme}-${size}.png`);
    await sharp(source)
      .resize(size, size, { fit: "cover", withoutEnlargement: false })
      .png()
      .toFile(file);
    console.log(`Generated: public/favicon/favicon-${theme}-${size}.png`);
  }
}
console.log("\nDone. All 8 favicons regenerated.");
