import PDFDocument from "pdfkit";
import { STAT_ROWS, barWidth, type MatchRecap, type StatKey } from "./match-recap";

const NAVY = "#002147";
const NAVY_DEEP = "#001529";
const STEEL = "#8fb7d9";
const BLUE = "#1d4e89";
const RED = "#c45c4a";
const INK = "#0b1c2c";
const MUTED = "#64748b";
const PAPER = "#eef2f6";

type RecapPdfInput = {
  teamName: string;
  clubName: string;
  ageGroup: string;
  matchDate: Date;
  opponent?: string | null;
  venue?: string | null;
  competition?: string | null;
  recap: MatchRecap;
};

function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export async function generateMatchRecapPdf(input: RecapPdfInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 0, size: "LETTER" });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("error", reject);
    doc.on("end", () => resolve(Buffer.concat(chunks)));

    const pageW = doc.page.width;
    const recap = input.recap;
    const club = input.clubName || "Club";
    const opponent = recap.opponentLabel || input.opponent || "Opponent";
    const competition = input.competition || "Match day";
    const subtitle = [input.ageGroup, input.teamName.replace(new RegExp(`^${club}\\s*`, "i"), "")]
      .filter(Boolean)
      .join("  ·  ");

    doc.rect(0, 0, pageW, 132).fill(NAVY);

    doc.save();
    doc.moveTo(36, 18).lineTo(68, 26).lineTo(64, 66).lineTo(52, 78).lineTo(40, 66).lineTo(36, 26).closePath().fill("#0b4a7a");
    doc.restore();
    const initials = club.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase() || "FC";
    doc.font("Helvetica-Bold").fontSize(9).fillColor("#ffffff")
      .text(initials, 36, 38, { width: 32, align: "center" });

    doc.font("Helvetica").fontSize(8).fillColor(STEEL)
      .text("MATCH RECAP", 78, 22, { lineBreak: false });
    doc.font("Helvetica-Bold").fontSize(16).fillColor("#9ec5e8")
      .text(club.toUpperCase(), 78, 34, { width: 340, lineBreak: false });
    doc.font("Helvetica").fontSize(8).fillColor("#ffffff")
      .text((subtitle || input.teamName).toUpperCase(), 78, 54, { width: 340, lineBreak: false });

    doc.roundedRect(pageW - 118, 20, 82, 44, 2).lineWidth(0.8).strokeColor("#ffffff").fillAndStroke(NAVY_DEEP, "#ffffff");
    doc.font("Helvetica-Bold").fontSize(18).fillColor("#ffffff")
      .text(`${recap.usScore}  –  ${recap.themScore}`, pageW - 118, 28, { width: 82, align: "center" });
    doc.font("Helvetica-Bold").fontSize(7).fillColor(STEEL)
      .text("FINAL", pageW - 118, 50, { width: 82, align: "center" });

    doc.font("Helvetica-Bold").fontSize(26).fillColor("#ffffff")
      .text("MATCH RECAP", 0, 78, { width: pageW, align: "center" });
    doc.save();
    doc.transform(1, 0, -0.35, 1, 0, 0);
    doc.rect(268, 106, 120, 6).fill("#0a3a6b");
    doc.restore();

    doc.save();
    doc.moveTo(48, 120).lineTo(pageW - 36, 120).lineTo(pageW - 48, 148).lineTo(36, 148).closePath().fill(NAVY_DEEP);
    doc.restore();
    doc.font("Helvetica-Bold").fontSize(9).fillColor("#ffffff")
      .text(competition.toUpperCase(), 48, 126, { width: pageW - 96, align: "center" });
    doc.font("Helvetica").fontSize(8).fillColor(STEEL)
      .text((recap.caption || "").toUpperCase(), 48, 138, { width: pageW - 96, align: "center" });

    doc.rect(0, 148, pageW, doc.page.height - 148).fill(PAPER);

    let y = 164;
    doc.font("Helvetica-Bold").fontSize(14).fillColor(NAVY)
      .text(recap.headline.toUpperCase(), 36, y, { width: 250 });
    y = doc.y + 6;
    doc.font("Helvetica").fontSize(9).fillColor(MUTED)
      .text(recap.summary, 36, y, { width: 250, lineGap: 2 });
    y = doc.y + 8;
    doc.font("Helvetica").fontSize(8).fillColor(INK);
    doc.text(`Tournament  ·  ${competition}`, 36, y, { width: 250 });
    doc.text(`Location  ·  ${recap.location || input.venue || "TBD"}`, 36, y + 12, { width: 250 });
    doc.text(`Date  ·  ${fmtDate(input.matchDate)}`, 36, y + 24, { width: 250 });

    const pillarTop = 164;
    const pillarW = 70;
    const pillarGap = 8;
    const pillarStart = 300;
    recap.pillars.forEach((pillar, i) => {
      const x = pillarStart + i * (pillarW + pillarGap);
      doc.circle(x + pillarW / 2, pillarTop + 10, 8).fill(NAVY);
      doc.font("Helvetica-Bold").fontSize(7).fillColor(NAVY)
        .text(pillar.title.toUpperCase(), x, pillarTop + 24, { width: pillarW, align: "center" });
      doc.font("Helvetica").fontSize(7).fillColor(MUTED)
        .text(pillar.body, x, pillarTop + 46, { width: pillarW, align: "center" });
    });

    y = 278;
    doc.rect(0, y, pageW, 248).fill("#ffffff");
    y += 10;
    doc.font("Helvetica-Bold").fontSize(8).fillColor(BLUE)
      .text(club.toUpperCase(), 36, y, { width: 160 });
    doc.font("Helvetica-Bold").fontSize(11).fillColor(NAVY)
      .text("MATCH STATS", 0, y - 1, { width: pageW, align: "center" });
    doc.font("Helvetica-Bold").fontSize(8).fillColor(RED)
      .text(opponent.toUpperCase(), pageW - 196, y, { width: 160, align: "right" });

    y += 18;
    const centerW = 88;
    const centerX = (pageW - centerW) / 2;
    const barMax = 150;

    STAT_ROWS.forEach((row) => {
      const stat = recap.stats[row.key as StatKey];
      const width = barWidth(stat.us, stat.them, row.key as StatKey);
      doc.font("Helvetica-Bold").fontSize(8).fillColor(NAVY)
        .text(String(stat.us), 36, y, { width: 28, align: "right" });
      const usBarW = (width.us / 100) * barMax;
      doc.rect(centerX - 8 - usBarW, y + 3, usBarW, 7).fill(BLUE);
      doc.rect(centerX, y, centerW, 14).fill(NAVY);
      doc.font("Helvetica-Bold").fontSize(6).fillColor(STEEL)
        .text(row.label.toUpperCase(), centerX, y + 4, { width: centerW, align: "center" });
      const themBarW = (width.them / 100) * barMax;
      doc.rect(centerX + centerW + 8, y + 3, themBarW, 7).fill(RED);
      doc.font("Helvetica-Bold").fontSize(8).fillColor(RED)
        .text(String(stat.them), pageW - 64, y, { width: 28, align: "left" });
      y += 18;
    });

    y = 536;
    const colW = 170;
    const cols = [36, 221, 406];

    doc.font("Helvetica-Bold").fontSize(10).fillColor(NAVY).text("KEY TAKEAWAYS", cols[0], y);
    let ty = y + 16;
    recap.takeaways.forEach((item) => {
      doc.circle(cols[0] + 4, ty + 4, 3).fill(BLUE);
      doc.font("Helvetica-Bold").fontSize(8).fillColor(NAVY)
        .text(item.title, cols[0] + 12, ty, { width: colW - 12 });
      ty = doc.y;
      doc.font("Helvetica").fontSize(7).fillColor(MUTED)
        .text(item.body, cols[0] + 12, ty, { width: colW - 12 });
      ty = doc.y + 6;
    });

    doc.font("Helvetica-Bold").fontSize(10).fillColor(NAVY)
      .text("NEXT UP", cols[1], y, { width: colW, align: "center" });
    let ny = y + 16;
    recap.nextUp.forEach((item) => {
      doc.font("Helvetica").fontSize(8).fillColor(INK)
        .text(item, cols[1], ny, { width: colW, align: "center" });
      ny = doc.y + 2;
    });
    doc.font("Helvetica-Bold").fontSize(8).fillColor(NAVY)
      .text(recap.proudOf.toUpperCase(), cols[1], ny + 8, { width: colW, align: "center" });
    doc.font("Times-BoldItalic").fontSize(13).fillColor(BLUE)
      .text(recap.keepBuilding, cols[1], ny + 24, { width: colW, align: "center" });

    doc.font("Helvetica-Bold").fontSize(10).fillColor(NAVY).text("WHAT THIS MEANS", cols[2], y);
    let my = y + 16;
    recap.meaning.forEach((item) => {
      doc.font("Helvetica-Bold").fontSize(8).fillColor(NAVY)
        .text(item.title, cols[2], my, { width: colW });
      my = doc.y;
      doc.font("Helvetica").fontSize(7).fillColor(MUTED)
        .text(item.body, cols[2], my, { width: colW });
      my = doc.y + 6;
    });
    doc.roundedRect(cols[2], my + 2, colW, 28, 3).lineWidth(0.8).strokeColor(BLUE).stroke();
    doc.font("Helvetica-Bold").fontSize(7).fillColor(NAVY)
      .text(recap.thankYou.toUpperCase(), cols[2] + 6, my + 8, { width: colW - 12, align: "center" });

    const footerY = 760;
    doc.rect(0, footerY, pageW, 32).fill(NAVY);
    doc.font("Helvetica-Bold").fontSize(7).fillColor(STEEL)
      .text(recap.mottos.map((m) => m.toUpperCase()).join("   ·   "), 24, footerY + 12, {
        width: pageW - 48,
        align: "center",
      });

    doc.end();
  });
}
