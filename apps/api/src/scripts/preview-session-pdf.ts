import "../config/load-env";
import fs from "fs";
import path from "path";
import { prisma } from "../prisma";
import { generateSessionPdf } from "../services/pdf-export";
import { SESSION_PDF_REVISION } from "../services/pdf-export-revision";
import { pickDrillSvg, rasterizeDiagramSvg } from "../services/pdf-diagram-image";
import { attachStoredDiagramSvgsToDrills } from "../services/session-diagram-hydrate";

/**
 * Render session diagrams + PDF on this machine. Does not call the web app.
 *
 *   pnpm exec ts-node --project tsconfig.json src/scripts/preview-session-pdf.ts --title "Mastering Body Shape"
 */
async function main() {
  const titleArg = process.argv.find((a) => a.startsWith("--title="))?.slice("--title=".length)
    || process.argv[process.argv.indexOf("--title") + 1];
  const title = (titleArg && !titleArg.startsWith("--") ? titleArg : "Mastering Body Shape").trim();
  const outDir = "/tmp/aci-pdf-preview";
  fs.mkdirSync(outDir, { recursive: true });

  const session = await prisma.session.findFirst({
    where: { title: { contains: title, mode: "insensitive" } },
    orderBy: { updatedAt: "desc" },
  });
  if (!session) {
    console.error(`No session matching "${title}"`);
    process.exit(1);
  }

  const json = session.json && typeof session.json === "object" ? (session.json as Record<string, unknown>) : {};
  const drills = await attachStoredDiagramSvgsToDrills(
    Array.isArray(json.drills) ? json.drills : []
  );

  console.log(`Session ${session.id}  ${session.title}`);
  console.log(`Revision ${SESSION_PDF_REVISION}  drills ${drills.length}`);
  console.log(`Writing ${outDir}`);

  drills.forEach((drill, idx) => {
    const record = drill as { title?: string; diagramSvg?: unknown; json?: unknown };
    const svg = pickDrillSvg(record);
    const png = svg ? rasterizeDiagramSvg(svg) : null;
    if (!png) {
      console.log(`  ${idx + 1}. SKIP  ${record.title || "untitled"}`);
      return;
    }
    const file = path.join(outDir, `drill-${idx + 1}.png`);
    fs.writeFileSync(file, png);
    const w = png.readUInt32BE(16);
    const h = png.readUInt32BE(20);
    console.log(`  ${idx + 1}. ${w}x${h}  ${record.title}`);
  });

  const pdf = await generateSessionPdf({
    ...json,
    id: session.id,
    title: session.title,
    drills,
  });
  const pdfPath = path.join(outDir, `session-${SESSION_PDF_REVISION}.pdf`);
  fs.writeFileSync(pdfPath, pdf);
  console.log(`PDF ${pdfPath}  (${pdf.length} bytes)`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
