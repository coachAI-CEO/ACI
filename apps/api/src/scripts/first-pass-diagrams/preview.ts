import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";

/** Render an SVG to PNG via macOS Quick Look. Returns the png path or null. */
export function renderSvgPreview(svgPath: string, outDir: string): string | null {
  fs.mkdirSync(outDir, { recursive: true });
  try {
    execFileSync("qlmanage", ["-t", "-s", "1200", "-o", outDir, svgPath], {
      stdio: "ignore",
      timeout: 15000,
    });
  } catch {
    return null;
  }
  const produced = path.join(outDir, `${path.basename(svgPath)}.png`);
  if (!fs.existsSync(produced)) return null;
  const dest = path.join(outDir, `${path.basename(svgPath, ".svg")}.png`);
  if (produced !== dest) {
    fs.copyFileSync(produced, dest);
    fs.unlinkSync(produced);
  }
  trimPreviewToPitch(dest);
  return dest;
}

/** qlmanage writes a square thumbnail. Equalize left/right gutters around
 * the green pitch so visual QA does not fail a centered card for letterbox. */
function trimPreviewToPitch(pngPath: string): void {
  try {
    execFileSync("python3", [path.join(__dirname, "trim-preview.py"), pngPath], {
      timeout: 15000,
      stdio: "ignore",
    });
  } catch {
    // Keep the untrimmed thumbnail if crop fails.
  }
}
