import PDFDocument from "pdfkit";

// ─── Types ────────────────────────────────────────────────────────────────────

type DiagramTeamCode = "ATT" | "DEF" | "NEUTRAL";

type DiagramV1 = {
  pitch?: {
    variant?: "FULL" | "HALF";
    orientation?: "HORIZONTAL" | "VERTICAL";
    showZones?: boolean;
  };
  players?: Array<{
    id?: string;
    number?: number;
    team?: DiagramTeamCode;
    role?: string;
    x: number;
    y: number;
  }>;
  goals?: Array<{ x: number; y: number; width?: number; height?: number }>;
  arrows?: Array<{
    from: { x?: number; y?: number; playerId?: string };
    to: { x?: number; y?: number; playerId?: string };
    type?: string;
    style?: string;
  }>;
};

// ─── Design System ────────────────────────────────────────────────────────────

const BRAND = {
  navy:      "#0f172a",
  blue:      "#2563eb",
  surface:   "#f8fafc",
  separator: "#e2e8f0",
  muted:     "#64748b",
  white:     "#ffffff",
  black:     "#000000",
};

interface DrillTypeStyle {
  border: string;
  bg: string;
  badgeBg: string;
  badgeText: string;
  label: string;
}

const DRILL_TYPE_CONFIG: Record<string, DrillTypeStyle> = {
  WARMUP:           { border: "#f97316", bg: "#fff7ed", badgeBg: "#ffedd5", badgeText: "#c2410c", label: "Warmup" },
  TECHNICAL:        { border: "#7c3aed", bg: "#f5f3ff", badgeBg: "#ede9fe", badgeText: "#5b21b6", label: "Technical" },
  TACTICAL:         { border: "#2563eb", bg: "#eff6ff", badgeBg: "#dbeafe", badgeText: "#1e40af", label: "Tactical" },
  CONDITIONED_GAME: { border: "#059669", bg: "#f0fdf4", badgeBg: "#dcfce7", badgeText: "#166534", label: "Cond. Game" },
  FULL_GAME:        { border: "#0ea5e9", bg: "#f0f9ff", badgeBg: "#e0f2fe", badgeText: "#0c4a6e", label: "Full Game" },
  COOLDOWN:         { border: "#64748b", bg: "#f8fafc", badgeBg: "#f1f5f9", badgeText: "#334155", label: "Cooldown" },
};

const SECTION_PHRASE_COLORS: Record<string, string> = {
  warmup:           "#f97316",
  technical:        "#7c3aed",
  tactical:         "#2563eb",
  conditioned_game: "#059669",
  cooldown:         "#64748b",
};

const GAME_MODEL_LABELS: Record<string, string> = {
  POSSESSION: "Possession",
  PRESSING:   "Pressing",
  TRANSITION: "Transition",
  COACHAI:    "Balanced model",
  TACTICAL:   "Tactical",
};

const PHASE_LABELS: Record<string, string> = {
  ATTACKING:  "Attacking phase",
  DEFENDING:  "Defending phase",
  TRANSITION: "Transition phase",
};

const ZONE_LABELS: Record<string, string> = {
  DEFENSIVE_THIRD: "Defensive third",
  MIDDLE_THIRD:    "Middle third",
  ATTACKING_THIRD: "Attacking third",
};

const COACH_LEVEL_LABELS: Record<string, string> = {
  GRASSROOTS:   "Grassroots",
  USSF_C:       "USSF C",
  USSF_B_PLUS:  "USSF B+",
};

// Returns { label, color } for the "Language" badge derived from coachLevel
function getLanguageBadge(coachLevel?: string): { label: string; color: string } {
  const key = String(coachLevel || "").toUpperCase();
  if (key === "GRASSROOTS") return { label: "Language: Grassroots", color: "#059669" };
  if (key === "USSF_C")     return { label: "Language: USSF C",     color: "#0ea5e9" };
  if (key === "USSF_B_PLUS") return { label: "Language: USSF B+",   color: "#7c3aed" };
  return { label: "Language: Standard", color: "#64748b" };
}

function getDrillConfig(drillType?: string): DrillTypeStyle {
  return DRILL_TYPE_CONFIG[(drillType || "").toUpperCase()] || DRILL_TYPE_CONFIG.TACTICAL;
}

// ─── Data Normalization ───────────────────────────────────────────────────────

function normalizeDrill(drill: any) {
  const json = drill.json || {};
  return {
    title:          drill.title          || json.title          || "Drill",
    drillType:      drill.drillType      || json.drillType      || "N/A",
    duration:       drill.duration       ?? drill.durationMin   ?? json.durationMin ?? json.duration ?? "?",
    description:    drill.description    || json.description    || "",
    organization:   drill.organization   || json.organization,
    coachingPoints: drill.coachingPoints || json.coachingPoints || [],
    progressions:   drill.progressions   || json.progressions   || [],
    diagram:        drill.diagram || drill.diagramV1 || json.diagram || json.diagramV1 || null,
  };
}

function buildOrgText(org: any): string[] {
  if (!org) return [];
  if (typeof org === "string") return [org];
  const lines: string[] = [];
  if (Array.isArray(org.setupSteps) && org.setupSteps.length > 0) {
    lines.push(...org.setupSteps);
  }
  if (org.area) {
    if (org.area.lengthYards && org.area.widthYards) {
      lines.push(`Area: ${org.area.lengthYards} x ${org.area.widthYards} yards`);
    }
    if (org.area.notes) lines.push(org.area.notes);
  }
  if (org.rotation) lines.push(`Rotation: ${org.rotation}`);
  if (org.restarts) lines.push(`Restarts: ${org.restarts}`);
  if (org.scoring)  lines.push(`Scoring: ${org.scoring}`);
  return lines;
}

/**
 * Splits org data into setup steps (numbered) and constraints (compact info line).
 * Used by the session drill blocks for better visual hierarchy.
 */
function buildOrgSections(org: any): { setupSteps: string[]; constraints: string[] } {
  if (!org) return { setupSteps: [], constraints: [] };
  if (typeof org === "string") return { setupSteps: [org], constraints: [] };
  const setupSteps: string[] = Array.isArray(org.setupSteps) ? org.setupSteps : [];
  const constraints: string[] = [];
  if (org.area) {
    if (org.area.lengthYards && org.area.widthYards)
      constraints.push(`${org.area.lengthYards} x ${org.area.widthYards} yards`);
    if (org.area.notes) constraints.push(org.area.notes);
  }
  if (org.rotation) constraints.push(`Rotation: ${org.rotation}`);
  if (org.restarts) constraints.push(`Restarts: ${org.restarts}`);
  if (org.scoring)  constraints.push(`Scoring: ${org.scoring}`);
  return { setupSteps, constraints };
}

/**
 * Strips leading Unicode symbols / arrows / bullets that don't render correctly
 * in PDFKit's built-in Helvetica (WinAnsi encoding). Applies to AI-generated
 * progression text which often starts with → ⚡ ! or similar characters.
 */
function cleanText(text: string): string {
  return String(text || "").replace(/^[^a-zA-Z0-9"'([\-]+/, "").trim();
}

// ─── Low-Level Drawing Helpers ────────────────────────────────────────────────

/**
 * Draw a filled rounded-rectangle badge and return its width so the caller
 * can chain multiple badges horizontally.
 */
function drawBadge(
  doc: PDFKit.PDFDocument,
  text: string,
  x: number,
  y: number,
  opts: { bgColor: string; textColor: string; fontSize?: number; padX?: number; padY?: number; borderColor?: string }
): number {
  const fontSize = opts.fontSize ?? 7.5;
  const padX = opts.padX ?? 7;
  const padY = opts.padY ?? 3;
  doc.font("Helvetica-Bold").fontSize(fontSize);
  const tw = doc.widthOfString(text);
  const bw = tw + padX * 2;
  const bh = fontSize + padY * 2;
  doc.save();
  doc.roundedRect(x, y, bw, bh, 3).fill(opts.bgColor);
  if (opts.borderColor) {
    doc.roundedRect(x, y, bw, bh, 3).lineWidth(0.75).stroke(opts.borderColor);
  }
  doc.fillColor(opts.textColor).text(text, x + padX, y + padY, { lineBreak: false });
  doc.restore();
  return bw;
}

/**
 * Footer: thin separator line + "TacticalEdge · <title>" left, "Page N" right.
 * Temporarily zeroes doc.page.margins.bottom so PDFKit does not auto-add a new
 * page while we draw in the footer zone (below the normal content boundary).
 */
function drawPageDecor(
  doc: PDFKit.PDFDocument,
  title: string,
  pageNum: number
): void {
  const { width, height } = doc.page;
  const margin = 45;
  const footerY = height - 28;
  const savedX = doc.x;
  const savedY = doc.y;

  const pageMargins = (doc.page as any).margins;
  const savedBottom = pageMargins.bottom;
  pageMargins.bottom = 0;

  doc.save();

  doc.strokeColor(BRAND.separator).lineWidth(0.4)
    .moveTo(margin, footerY - 6).lineTo(width - margin, footerY - 6).stroke();

  doc.font("Helvetica").fontSize(7).fillColor("#94a3b8");
  doc.text(`TacticalEdge  ·  ${title}`, margin, footerY, {
    width: (width - margin * 2) * 0.65,
    align: "left",
    lineBreak: false,
  });
  doc.text(`Page ${pageNum}`, margin, footerY, {
    width: width - margin * 2,
    align: "right",
    lineBreak: false,
  });

  doc.restore();
  pageMargins.bottom = savedBottom;
  doc.x = savedX;
  doc.y = savedY;
}

/**
 * Section heading with a 3pt coloured left accent bar.
 * Reads and advances doc.y — caller should not pass explicit y.
 */
function drawSectionHeader(
  doc: PDFKit.PDFDocument,
  title: string,
  x: number,
  color: string = BRAND.blue
): void {
  doc.fillColor(color).rect(x, doc.y, 3, 16).fill();
  doc.fontSize(13).fillColor(BRAND.navy).font("Helvetica-Bold")
    .text(title, x + 10, doc.y, { lineBreak: false });
  doc.moveDown(1.1);
}

// ─── Diagram Renderer ─────────────────────────────────────────────────────────

/**
 * Render a DiagramV1 onto the current page.
 *
 * IMPORTANT: doc.page.margins.bottom is zeroed for the entire call to prevent
 * PDFKit's auto-page-break from firing when player labels at low y-values
 * (near the top of the pitch) cause the cursor to appear to go "backwards".
 */
function drawDiagram(
  doc: PDFKit.PDFDocument,
  rawDiagram: any,
  options?: {
    width?: number;
    position?: "left" | "center";
    startX?: number;
    /** Scale player circle radius (default 1.0). Pass 0.5 for compact layouts. */
    playerScale?: number;
    /** Scale arrowhead size and line weight (default 1.0). Pass 0.5 for compact layouts. */
    arrowScale?: number;
  }
): { width: number; height: number; startX: number; startY: number } | null {
  const pageMargins = (doc.page as any).margins;
  const savedBottom = pageMargins.bottom;
  pageMargins.bottom = 0;

  try {
    if (!rawDiagram || typeof rawDiagram !== "object") return null;

    const diagram: DiagramV1 = rawDiagram;
    const players = diagram.players || [];
    const arrows  = diagram.arrows  || [];

    if (!Array.isArray(players) || players.length === 0) return null;

    const margin      = 45;
    const diagramWidth = options?.width || 160;
    const orientation  = diagram.pitch?.orientation || "HORIZONTAL";

    let boxWidth: number;
    let boxHeight: number;
    if (orientation === "VERTICAL") {
      boxHeight = diagramWidth * 1.5;
      boxWidth  = diagramWidth;
    } else {
      boxWidth  = diagramWidth;
      boxHeight = boxWidth / 1.5;
    }

    let startX: number;
    if (options?.startX !== undefined) {
      startX = options.startX;
    } else if (options?.position === "center") {
      startX = (doc.page.width - boxWidth) / 2;
    } else {
      startX = margin;
    }

    const startY = doc.y;
    doc.save();

    const scaleX = boxWidth  / 100;
    const scaleY = boxHeight / 100;
    const toX = (vx: number) => startX + vx * scaleX;
    const toY = (vy: number) => startY + vy * scaleY;

    // Pitch background
    doc.fillColor("#064e3b").rect(startX, startY, boxWidth, boxHeight).fill();

    const lc = "#94a3b8"; // pitch line color

    // Outer border
    doc.lineWidth(1).strokeColor(lc)
      .rect(toX(2), toY(5), 96 * scaleX, 90 * scaleY).stroke();

    // Halfway line
    doc.lineWidth(0.5).strokeColor(lc).opacity(0.65)
      .moveTo(toX(2), toY(50)).lineTo(toX(98), toY(50)).stroke().opacity(1);

    // Penalty boxes (top + bottom)
    doc.lineWidth(0.75).strokeColor(lc)
      .rect(toX(30), toY(5),  40 * scaleX, 18 * scaleY).stroke()
      .rect(toX(30), toY(77), 40 * scaleX, 18 * scaleY).stroke();

    // Goal boxes (top + bottom)
    doc.lineWidth(0.6).strokeColor(lc)
      .rect(toX(40), toY(5),  20 * scaleX, 7 * scaleY).stroke()
      .rect(toX(40), toY(88), 20 * scaleX, 7 * scaleY).stroke();

    // Goal lines (bright white, top + bottom)
    doc.lineWidth(1.8).strokeColor("#ffffff").opacity(0.9)
      .moveTo(toX(45), toY(4)).lineTo(toX(55), toY(4)).stroke()
      .moveTo(toX(45), toY(96)).lineTo(toX(55), toY(96)).stroke()
      .opacity(1);

    // Center circle
    const cr = 10 * Math.min(scaleX, scaleY);
    doc.lineWidth(0.5).strokeColor(lc).opacity(0.6)
      .circle(toX(50), toY(50), cr).stroke().opacity(1);

    // Center spot + penalty spots
    doc.fillColor(lc).opacity(0.8)
      .circle(toX(50), toY(50), 1.5).fill()
      .circle(toX(50), toY(17), 1.5).fill()
      .circle(toX(50), toY(83), 1.5).fill()
      .opacity(1);

    // Corner arcs
    const cR = 3 * Math.min(scaleX, scaleY);
    doc.lineWidth(0.5).strokeColor(lc).opacity(0.5);
    [
      [toX(2),  toY(5),  1,  1],
      [toX(98), toY(5),  -1, 1],
      [toX(98), toY(95), -1, -1],
      [toX(2),  toY(95), 1,  -1],
    ].forEach(([px, py, dx, dy]) => {
      doc.path(
        `M ${px + dx * cR} ${py} A ${cR} ${cR} 0 0 ${dx * dy > 0 ? 1 : 0} ${px} ${py + dy * cR}`
      ).stroke();
    });
    doc.opacity(1);

    // ── Players ──────────────────────────────────────────────────────────────
    const teamColor = (team?: DiagramTeamCode): string => {
      if (team === "ATT") return "#3b82f6";
      if (team === "DEF") return "#ef4444";
      return "#9ca3af";
    };

    const playerScale = options?.playerScale ?? 1;
    const arrowScale  = options?.arrowScale  ?? 1;
    const baseRadius  = Math.min(boxWidth, boxHeight) * 0.03;
    const radius      = Math.max(3, Math.max(7, Math.min(11, baseRadius)) * playerScale);

    const toPdf = (vx: number, vy: number): { x: number; y: number } => {
      if (orientation === "VERTICAL") {
        return {
          x: startX + (Math.min(Math.max(vy, 0), 100) / 100) * boxWidth,
          y: startY + (Math.min(Math.max(vx, 0), 100) / 100) * boxHeight,
        };
      }
      return {
        x: startX + (Math.min(Math.max(vx, 0), 100) / 100) * boxWidth,
        y: startY + (Math.min(Math.max(vy, 0), 100) / 100) * boxHeight,
      };
    };

    players.forEach((p) => {
      if (typeof p.x !== "number" || typeof p.y !== "number") return;
      const { x: px, y: py } = toPdf(p.x, p.y);
      const fill = teamColor(p.team);

      // Drop shadow
      doc.save().opacity(0.25).fillColor("#000000")
        .circle(px + 1, py + 1.5, radius).fill().restore();

      // Player circle
      doc.lineWidth(1.5).fillColor(fill).circle(px, py, radius).fill();
      doc.strokeColor("#ffffff").lineWidth(0.9).circle(px, py, radius).stroke();

      // Number / role label
      const label =
        typeof p.number === "number"
          ? String(p.number)
          : p.role ? p.role.slice(0, 2).toUpperCase() : "";

      if (label) {
        doc.fontSize(Math.max(5.5, radius * 0.65))
          .fillColor(BRAND.white).font("Helvetica-Bold")
          .text(label, px - radius, py - radius * 0.4, {
            width: radius * 2,
            align: "center",
          });
      }
    });

    // ── Arrows ───────────────────────────────────────────────────────────────
    if (Array.isArray(arrows) && arrows.length > 0) {
      const getPos = (
        ref: { x?: number; y?: number; playerId?: string } | null | undefined
      ): { x: number; y: number } | null => {
        if (!ref) return null;
        if (typeof ref.x === "number" && typeof ref.y === "number")
          return toPdf(ref.x, ref.y);
        if (ref.playerId) {
          const player = players.find((p) => p.id === ref.playerId);
          if (player && typeof player.x === "number" && typeof player.y === "number")
            return toPdf(player.x, player.y);
        }
        return null;
      };

      arrows.forEach((arrow) => {
        if (!arrow || !arrow.from || !arrow.to) return;
        const from = getPos(arrow.from);
        const to   = getPos(arrow.to);
        if (!from || !to) return;

        const arrowStyle = arrow.style || "solid";
        const arrowType  = arrow.type  || "pass";

        let arrowColor = "#e2e8f0";
        if (arrowType === "run")   arrowColor = "#22c55e";
        if (arrowType === "press") arrowColor = "#f97316";

        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len < 1) return;

        const aLen = Math.min(8, len * 0.3) * arrowScale;
        const aHW  = aLen * 0.45;
        const ux = dx / len;
        const uy = dy / len;
        const bMx = to.x - ux * aLen;
        const bMy = to.y - uy * aLen;

        const lw = (arrowStyle === "bold" ? 1.8 : 1) * arrowScale;
        doc.lineWidth(lw).strokeColor(arrowColor).fillColor(arrowColor);

        if (arrowStyle === "dashed") doc.dash(5, { space: 3 });
        else if (arrowStyle === "dotted") doc.dash(2, { space: 2 });

        doc.moveTo(from.x, from.y).lineTo(bMx, bMy).stroke();
        if (arrowStyle !== "solid") doc.undash();

        // Filled arrowhead triangle
        const perpX = -uy;
        const perpY =  ux;
        doc.moveTo(to.x, to.y)
          .lineTo(bMx + perpX * aHW, bMy + perpY * aHW)
          .lineTo(bMx - perpX * aHW, bMy - perpY * aHW)
          .closePath().fill();
      });
    }

    doc.fillColor(BRAND.black).strokeColor(BRAND.black);
    doc.restore();
    pageMargins.bottom = savedBottom;
    return { width: boxWidth, height: boxHeight, startX, startY };

  } catch (e: any) {
    console.error("[PDF] Error drawing diagram:", e);
    pageMargins.bottom = savedBottom;
    doc.moveDown(0.5);
    doc.fontSize(8).fillColor("red").text("(Diagram rendering error)");
    return null;
  }
}

// ─── Coaching Emphasis Section ────────────────────────────────────────────────

/**
 * Renders the skill focus / coaching emphasis block.
 * Shared between generateSessionPdf and any other future export that needs it.
 */
function drawCoachingEmphasis(
  doc: PDFKit.PDFDocument,
  skillFocus: any,
  margin: number
): void {
  if (!skillFocus) return;

  const pageW   = doc.page.width - margin * 2;
  const halfW   = (pageW - 16) / 2;
  const rightX  = margin + halfW + 16;

  // Section header (purple accent — coaching/skills tone)
  drawSectionHeader(doc, "Coaching Emphasis", margin, "#7c3aed");

  // Title
  if (skillFocus.title) {
    doc.fontSize(12).fillColor(BRAND.navy).font("Helvetica-Bold")
      .text(skillFocus.title, margin, doc.y);
    doc.moveDown(0.5);
  }

  // Summary — light blue tinted box
  if (skillFocus.summary) {
    const boxY = doc.y;
    doc.fontSize(9).fillColor(BRAND.muted).font("Helvetica")
      .text(skillFocus.summary, margin + 10, boxY + 6, {
        width: pageW - 20,
        lineGap: 2,
      });
    const boxH = doc.y - boxY + 8;
    // Draw border over the text (drawn last so it's above background)
    doc.save();
    const pm = (doc.page as any).margins;
    const sb = pm.bottom;
    pm.bottom = 0;
    doc.fillColor("#eff6ff").rect(margin, boxY, pageW, boxH).fill();
    doc.strokeColor("#93c5fd").lineWidth(0.5).rect(margin, boxY, pageW, boxH).stroke();
    pm.bottom = sb;
    doc.restore();
    // Redraw text on top of box
    doc.fontSize(9).fillColor(BRAND.muted).font("Helvetica")
      .text(skillFocus.summary, margin + 10, boxY + 6, {
        width: pageW - 20,
        lineGap: 2,
      });
    doc.y = boxY + boxH + 10;
  }

  // Key Skills — pill tags
  const keySkills: string[] = Array.isArray(skillFocus.keySkills) ? skillFocus.keySkills : [];
  if (keySkills.length > 0) {
    doc.fontSize(9).fillColor(BRAND.navy).font("Helvetica-Bold")
      .text("Key Skills", margin, doc.y);
    doc.moveDown(0.4);

    let pillX = margin;
    const pillY = doc.y;
    keySkills.forEach((skill: string) => {
      const bw = drawBadge(doc, skill, pillX, pillY, {
        bgColor: "#dbeafe",
        textColor: "#1e40af",
        fontSize: 8,
        padX: 8,
        padY: 3.5,
      });
      pillX += bw + 6;
      // Wrap to next row if needed
      if (pillX > doc.page.width - margin - 80) {
        pillX = margin;
        doc.y = pillY + 20;
      }
    });
    doc.y = pillY + 20;
    doc.moveDown(0.5);
  }

  // Coaching Points
  const coachingPoints: string[] = Array.isArray(skillFocus.coachingPoints) ? skillFocus.coachingPoints : [];
  if (coachingPoints.length > 0) {
    doc.fontSize(9).fillColor(BRAND.navy).font("Helvetica-Bold")
      .text("Coaching Points", margin, doc.y);
    doc.moveDown(0.3);
    coachingPoints.forEach((pt: string, i: number) => {
      doc.fontSize(9).fillColor(BRAND.black).font("Helvetica")
        .text(`${i + 1}.  ${pt}`, margin, doc.y, { width: pageW, lineGap: 1.5 });
    });
    doc.moveDown(0.5);
  }

  // Psychology — two-column layout (positive left, corrective right)
  const psych = skillFocus.psychology;
  if (psych) {
    const good: string[] = Array.isArray(psych.positiveBehaviors) ? psych.positiveBehaviors
      : Array.isArray(psych.good) ? psych.good : [];
    const bad: string[]  = Array.isArray(psych.areasToImprove) ? psych.areasToImprove
      : Array.isArray(psych.bad)  ? psych.bad  : [];

    if (good.length > 0 || bad.length > 0) {
      doc.fontSize(9).fillColor(BRAND.navy).font("Helvetica-Bold")
        .text("Psychology", margin, doc.y);
      doc.moveDown(0.4);

      const colStartY = doc.y;
      let leftCurY  = colStartY;
      let rightCurY = colStartY;

      // Left column: Positive Behaviors
      if (good.length > 0) {
        doc.fontSize(8.5).fillColor("#059669").font("Helvetica-Bold")
          .text("\u2713  Positive Behaviors", margin, leftCurY, { width: halfW });
        leftCurY += doc.heightOfString("\u2713  Positive Behaviors", { width: halfW }) + 4;
        doc.font("Helvetica").fillColor(BRAND.black);
        good.forEach((item: string) => {
          const h = doc.heightOfString(`\u2022  ${item}`, { width: halfW });
          doc.fontSize(8.5).text(`\u2022  ${item}`, margin, leftCurY, { width: halfW, lineGap: 0.5 });
          leftCurY += h + 1.5;
        });
      }

      // Right column: Areas to Improve
      if (bad.length > 0) {
        doc.fontSize(8.5).fillColor("#dc2626").font("Helvetica-Bold")
          .text("\u2717  Areas to Improve", rightX, rightCurY, { width: halfW });
        rightCurY += doc.heightOfString("\u2717  Areas to Improve", { width: halfW }) + 4;
        doc.font("Helvetica").fillColor(BRAND.black);
        bad.forEach((item: string) => {
          const h = doc.heightOfString(`\u2022  ${item}`, { width: halfW });
          doc.fontSize(8.5).text(`\u2022  ${item}`, rightX, rightCurY, { width: halfW, lineGap: 0.5 });
          rightCurY += h + 1.5;
        });
      }

      doc.y = Math.max(leftCurY, rightCurY) + 8;
      doc.x = margin;
      doc.moveDown(0.5);
    }
  }

  // Coaching Phrases — flat two-column layout matching the web UI:
  // all ENCOURAGE phrases (left) | all CORRECT phrases (right),
  // combining every section's phrases into the two shared columns.
  const sectionPhrases = skillFocus.sectionPhrases;
  if (sectionPhrases && typeof sectionPhrases === "object") {
    // Flatten all encourage + correct phrases across every section
    const allEncourage: string[] = [];
    const allCorrect:   string[] = [];

    Object.values(sectionPhrases).forEach((v: any) => {
      if (!v || typeof v !== "object") return;
      if (Array.isArray(v.encourage)) allEncourage.push(...v.encourage);
      if (Array.isArray(v.correct))   allCorrect.push(...v.correct);
    });

    if (allEncourage.length > 0 || allCorrect.length > 0) {
      const colW   = (pageW - 14) / 2;
      const innerW = colW - 18;
      const rightX = margin + colW + 14;

      // Measure column heights BEFORE deciding whether to page-break
      doc.font("Helvetica").fontSize(8.5);
      const measureCol = (phrases: string[]): number => {
        let h = 14 + 6; // label row + gap
        phrases.forEach((p) => { h += doc.heightOfString(`\u2022  ${p}`, { width: innerW, lineGap: 1 }) + 2; });
        return h + 14; // bottom padding
      };
      const lh   = allEncourage.length > 0 ? measureCol(allEncourage) : 0;
      const rh   = allCorrect.length   > 0 ? measureCol(allCorrect)   : 0;
      const colH = Math.max(lh, rh, 40);

      // Page-break if the columns won't fit — use actual colH, not a fixed guess
      const labelH = 22; // "Coaching Phrases" label + moveDown
      if (doc.y + labelH + colH > doc.page.height - margin) doc.addPage();

      doc.fontSize(9).fillColor(BRAND.navy).font("Helvetica-Bold")
        .text("Coaching Phrases", margin, doc.y);
      doc.moveDown(0.5);

      const colY = doc.y;

      // Suppress PDFKit auto-page-break while rendering explicitly-positioned
      // text: without this, lines whose y > (page.height - margins.bottom)
      // trigger phantom page additions, producing dozens of blank pages.
      const pm = (doc.page as any).margins;
      const savedBottom = pm.bottom;
      pm.bottom = 0;

      // Left column — ENCOURAGE
      doc.fillColor(BRAND.surface).rect(margin,  colY, colW, colH).fill();
      doc.strokeColor(BRAND.separator).lineWidth(0.4).rect(margin, colY, colW, colH).stroke();

      // Right column — CORRECT
      doc.fillColor(BRAND.surface).rect(rightX, colY, colW, colH).fill();
      doc.strokeColor(BRAND.separator).lineWidth(0.4).rect(rightX, colY, colW, colH).stroke();

      let leftCurY  = colY + 10;
      let rightCurY = colY + 10;

      if (allEncourage.length > 0) {
        doc.fontSize(8).fillColor("#059669").font("Helvetica-Bold")
          .text("ENCOURAGE", margin + 10, leftCurY, { width: innerW });
        leftCurY += 14;
        doc.font("Helvetica").fillColor(BRAND.black);
        allEncourage.forEach((p) => {
          const h = doc.heightOfString(`\u2022  ${p}`, { width: innerW, lineGap: 1 });
          doc.fontSize(8.5).text(`\u2022  ${p}`, margin + 10, leftCurY, { width: innerW, lineGap: 1 });
          leftCurY += h + 2;
        });
      }

      if (allCorrect.length > 0) {
        doc.fontSize(8).fillColor("#dc2626").font("Helvetica-Bold")
          .text("CORRECT", rightX + 10, rightCurY, { width: innerW });
        rightCurY += 14;
        doc.font("Helvetica").fillColor(BRAND.black);
        allCorrect.forEach((p) => {
          const h = doc.heightOfString(`\u2022  ${p}`, { width: innerW, lineGap: 1 });
          doc.fontSize(8.5).text(`\u2022  ${p}`, rightX + 10, rightCurY, { width: innerW, lineGap: 1 });
          rightCurY += h + 2;
        });
      }

      pm.bottom = savedBottom;

      doc.y = colY + colH + 10;
      doc.x = margin;
    }
  }
}

// ─── generateSessionPdf ───────────────────────────────────────────────────────

export async function generateSessionPdf(session: any): Promise<Buffer> {
  console.log("[PDF] Generating session PDF:", {
    title: session.title,
    drillsCount: session.drills?.length,
  });

  return new Promise((resolve, reject) => {
    const doc          = new PDFDocument({ size: "A4", margin: 45 });
    const chunks: Buffer[] = [];
    const margin       = 45;
    const sessionTitle = session.title || "Training Session";
    let pageNum        = 1;
    let drawingDecor   = false;

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("error", reject);
    doc.on("end", () => resolve(Buffer.concat(chunks)));

    doc.on("pageAdded", () => {
      if (drawingDecor) return;
      pageNum++;
      drawingDecor = true;
      drawPageDecor(doc, sessionTitle, pageNum);
      drawingDecor = false;
      doc.x = margin;
      doc.y = margin;
    });

    // Page 1 footer
    drawPageDecor(doc, sessionTitle, pageNum);

    // ── Header block (dark navy, full-bleed) ────────────────────────────────
    {
      const headerH = 100;
      const { width } = doc.page;

      // Background rect
      doc.fillColor(BRAND.navy).rect(0, 0, width, headerH).fill();
      // Blue accent bar at the bottom
      doc.fillColor(BRAND.blue).rect(0, headerH - 4, width, 4).fill();

      // Brand label
      doc.fontSize(7.5).fillColor("#94a3b8").font("Helvetica")
        .text("TACTICALEDGE", margin, 9, { lineBreak: false });

      // ── Row 1: Title + refCode badge + Language badge ──────────────────────
      const titleY = 21;
      // Measure how wide the title text is so we can place badges inline
      const titleStr = sessionTitle;
      doc.fontSize(18).font("Helvetica-Bold");
      const titleTextW = doc.widthOfString(titleStr);
      const maxTitleW  = width - margin * 2 - 10;

      doc.fillColor(BRAND.white)
        .text(titleStr, margin, titleY, { width: maxTitleW, lineBreak: false });

      // refCode badge — placed to the right of the title on the same line
      let badgeX = margin + Math.min(titleTextW, maxTitleW) + 10;
      const badgeY = titleY + 2;
      if (session.refCode) {
        badgeX += drawBadge(doc, session.refCode, badgeX, badgeY, {
          bgColor: "#1e293b", textColor: "#94a3b8", fontSize: 7.5,
        }) + 6;
      }
      // Language badge (derived from coachLevel)
      if (session.coachLevel) {
        const lb = getLanguageBadge(session.coachLevel);
        // Use a slightly transparent version of the language color as bg
        drawBadge(doc, lb.label, badgeX, badgeY, {
          bgColor: lb.color + "33", textColor: lb.color, fontSize: 7.5,
          borderColor: lb.color,
        });
      }

      // ── Row 2: Created by ──────────────────────────────────────────────────
      const creatorName = session.creator?.name || session.creator?.email || session.generatedByName || null;
      if (creatorName) {
        const createdY = titleY + 20;
        doc.fontSize(8).fillColor("#64748b").font("Helvetica")
          .text("Created by: ", margin, createdY, { continued: true, lineBreak: false });
        doc.fillColor("#94a3b8")
          .text(creatorName, { lineBreak: false });
      }

      // ── Row 3: Meta chips (Game Model · Phase · Zone · Coach Level · Duration) ──
      const chipY = headerH - 34;
      let cx = margin;
      const chipBg   = "#1e293b";
      const chipText = "#94a3b8";
      const chipFs   = 7.5;

      if (session.ageGroup) {
        cx += drawBadge(doc, session.ageGroup, cx, chipY, {
          bgColor: chipBg, textColor: chipText, fontSize: chipFs,
        }) + 5;
      }
      if (session.gameModelId) {
        const label = GAME_MODEL_LABELS[session.gameModelId] || session.gameModelId;
        cx += drawBadge(doc, `Game Model: ${label}`, cx, chipY, {
          bgColor: chipBg, textColor: chipText, fontSize: chipFs,
        }) + 5;
      }
      if (session.phase) {
        const label = PHASE_LABELS[session.phase] || session.phase;
        cx += drawBadge(doc, `Phase: ${label}`, cx, chipY, {
          bgColor: chipBg, textColor: chipText, fontSize: chipFs,
        }) + 5;
      }
      if (session.zone) {
        const label = ZONE_LABELS[session.zone] || session.zone;
        cx += drawBadge(doc, `Zone: ${label}`, cx, chipY, {
          bgColor: chipBg, textColor: chipText, fontSize: chipFs,
        }) + 5;
      }
      if (session.coachLevel) {
        const label = COACH_LEVEL_LABELS[session.coachLevel] || session.coachLevel;
        cx += drawBadge(doc, `Coach Level: ${label}`, cx, chipY, {
          bgColor: chipBg, textColor: chipText, fontSize: chipFs,
        }) + 5;
      }
      // Duration: prefer session.durationMin over summed drill durations
      const sessionDuration = session.durationMin
        ?? (Array.isArray(session.drills)
          ? session.drills.reduce((s: number, d: any) => s + (parseInt(d.duration ?? d.durationMin ?? 0) || 0), 0)
          : 0);
      if (sessionDuration > 0) {
        drawBadge(doc, `Duration: ${sessionDuration} min`, cx, chipY, {
          bgColor: chipBg, textColor: chipText, fontSize: chipFs,
        });
      }

      doc.y = headerH + 14;
      doc.x = margin;
    }

    // ── Session Overview table ───────────────────────────────────────────────
    if (Array.isArray(session.drills) && session.drills.length > 0) {
      drawSectionHeader(doc, "Session Overview", margin);

      const tableTop = doc.y;
      const tableW   = doc.page.width - margin * 2;
      // col widths: # | name | type | duration
      const colW = [26, tableW - 26 - 130 - 65, 130, 65] as const;
      const rowH = 18;
      const headers = ["#", "Drill", "Type", "Duration"];

      // Header row
      doc.fillColor(BRAND.navy).rect(margin, tableTop, tableW, rowH).fill();
      let cx = margin;
      headers.forEach((h, i) => {
        doc.fontSize(7.5).fillColor(BRAND.white).font("Helvetica-Bold")
          .text(h, cx + 5, tableTop + 5, {
            width: colW[i] - 8,
            lineBreak: false,
            align: i === 3 ? "right" : "left",
          });
        cx += colW[i];
      });

      // Data rows
      session.drills.forEach((drill: any, idx: number) => {
        const norm = normalizeDrill(drill);
        const cfg  = getDrillConfig(norm.drillType);
        const rowY = tableTop + rowH + idx * rowH;

        if (idx % 2 === 0) {
          doc.fillColor(BRAND.surface).rect(margin, rowY, tableW, rowH).fill();
        }
        // Type-colour left indicator
        doc.fillColor(cfg.border).rect(margin, rowY, 3, rowH).fill();

        cx = margin;
        doc.fontSize(8).fillColor(BRAND.muted).font("Helvetica-Bold")
          .text(String(idx + 1), cx + 6, rowY + 5, { width: colW[0] - 8, lineBreak: false });
        cx += colW[0];

        doc.fontSize(8).fillColor(BRAND.black).font("Helvetica")
          .text(norm.title, cx + 4, rowY + 5, { width: colW[1] - 8, lineBreak: false });
        cx += colW[1];

        drawBadge(doc, cfg.label.toUpperCase(), cx + 4, rowY + 4, {
          bgColor: cfg.badgeBg, textColor: cfg.badgeText, fontSize: 7, padX: 6, padY: 2,
        });
        cx += colW[2];

        doc.fontSize(8).fillColor(BRAND.muted).font("Helvetica")
          .text(`${norm.duration} min`, cx, rowY + 5, {
            width: colW[3] - 8, lineBreak: false, align: "right",
          });
      });

      const tableBottom = tableTop + rowH + session.drills.length * rowH;
      doc.strokeColor(BRAND.separator).lineWidth(0.5)
        .moveTo(margin, tableBottom).lineTo(margin + tableW, tableBottom).stroke();

      doc.y = tableBottom + 18;
    }

    // ── About This Session ───────────────────────────────────────────────────
    if (session.summary) {
      drawSectionHeader(doc, "About This Session", margin);
      doc.fontSize(9).fillColor(BRAND.muted).font("Helvetica")
        .text(session.summary, margin, doc.y, {
          width: doc.page.width - margin * 2,
          lineGap: 2,
        });
      doc.moveDown(1.2);
    }

    // ── Drills ───────────────────────────────────────────────────────────────
    const skillFocus = session.skillFocus || session.json?.skillFocus;

    if (Array.isArray(session.drills) && session.drills.length > 0) {
      // Need room for: section header (~26pt) + first drill header (~25pt) +
      // minimum diagram height (~133pt) + buffers = ~300pt.  A4 is 841pt tall.
      if (doc.y > doc.page.height - margin - 300) doc.addPage();
      drawSectionHeader(doc, "Drills", margin);

      const diagramWidth = 200;
      const pageW        = doc.page.width - margin * 2;
      const textColW     = pageW - diagramWidth - 14;
      const textColX     = margin + diagramWidth + 14;

      session.drills.forEach((rawDrill: any, idx: number) => {
        const drill = normalizeDrill(rawDrill);
        const cfg   = getDrillConfig(drill.drillType);

        // Dynamic page-break threshold — vertical diagrams are 1.5× taller than horizontal
        const diagOrientation = drill.diagram?.pitch?.orientation || "HORIZONTAL";
        const estimatedDiagH  = diagOrientation === "VERTICAL" ? diagramWidth * 1.5 : Math.round(diagramWidth / 1.5);
        const pageBreakBuffer = estimatedDiagH + 80; // 80pt for header row + spacing
        if (doc.y > doc.page.height - margin - pageBreakBuffer) doc.addPage();
        if (idx > 0) doc.moveDown(0.6);

        const drillBlockTopY = doc.y;

        // ── Drill header row ──
        {
          const circX = margin + 11;
          const circY = doc.y + 1;

          // Number circle
          doc.fillColor(cfg.border).circle(circX, circY + 8, 10).fill();
          doc.fontSize(8).fillColor(BRAND.white).font("Helvetica-Bold")
            .text(String(idx + 1), circX - 10, circY + 4, { width: 20, align: "center", lineBreak: false });

          // Title
          doc.fontSize(11.5).fillColor(BRAND.black).font("Helvetica-Bold")
            .text(drill.title, margin + 26, doc.y, { lineBreak: false });

          // Type badge + duration chip
          const titleEndX = margin + 26 + doc.widthOfString(drill.title) + 10;
          const badgeTopY = doc.y - 1;
          const bw = drawBadge(doc, cfg.label.toUpperCase(), titleEndX, badgeTopY, {
            bgColor: cfg.badgeBg, textColor: cfg.badgeText, fontSize: 7.5,
          });
          drawBadge(doc, `${drill.duration} min`, titleEndX + bw + 6, badgeTopY, {
            bgColor: BRAND.surface, textColor: BRAND.muted, fontSize: 7.5,
          });

          doc.moveDown(1);
        }

        const contentStartY   = doc.y;
        const pageNumAtContent = pageNum;
        let diagramEndY = contentStartY;

        // ── Diagram (left column) ──
        if (drill.diagram) {
          const di = drawDiagram(doc, drill.diagram, { width: diagramWidth, startX: margin });
          if (di) diagramEndY = di.startY + di.height;
        }

        // ── Text (right column) ──
        doc.x = textColX;
        doc.y = contentStartY;

        // Organisation — numbered setup steps + compact constraint line
        const { setupSteps, constraints } = buildOrgSections(drill.organization);
        const hasOrg = setupSteps.length > 0 || constraints.length > 0;
        const fallbackLines = !hasOrg && drill.description ? [drill.description] : [];

        if (hasOrg || fallbackLines.length > 0) {
          doc.fontSize(8.5).fillColor(BRAND.navy).font("Helvetica-Bold")
            .text("Organisation", textColX, doc.y);
          doc.moveDown(0.25);

          if (fallbackLines.length > 0) {
            fallbackLines.forEach((line) => {
              doc.fontSize(8.5).fillColor(BRAND.black).font("Helvetica")
                .text(`·  ${line}`, textColX, doc.y, { width: textColW, lineGap: 0.5 });
            });
          } else {
            // Numbered setup steps
            setupSteps.forEach((step, i) => {
              doc.fontSize(8.5).fillColor(BRAND.black).font("Helvetica")
                .text(`${i + 1}.  ${step}`, textColX, doc.y, { width: textColW, lineGap: 0.5 });
            });
            // Constraints as compact muted info line (visually distinct from setup)
            if (constraints.length > 0) {
              if (setupSteps.length > 0) doc.moveDown(0.3);
              doc.fontSize(7.5).fillColor(BRAND.muted).font("Helvetica")
                .text(constraints.join("  ·  "), textColX, doc.y, { width: textColW });
            }
          }
          doc.moveDown(0.5);
        }

        // Coaching Points
        if (Array.isArray(drill.coachingPoints) && drill.coachingPoints.length > 0) {
          doc.fontSize(8.5).fillColor(BRAND.navy).font("Helvetica-Bold")
            .text("Coaching Points", textColX, doc.y);
          doc.moveDown(0.25);
          drill.coachingPoints.forEach((pt: string, i: number) => {
            doc.fontSize(8.5).fillColor(BRAND.black).font("Helvetica")
              .text(`${i + 1}.  ${pt}`, textColX, doc.y, { width: textColW, lineGap: 0.5 });
          });
          doc.moveDown(0.5);
        }

        // Progressions
        if (Array.isArray(drill.progressions) && drill.progressions.length > 0) {
          doc.fontSize(8.5).fillColor(BRAND.navy).font("Helvetica-Bold")
            .text("Progressions", textColX, doc.y);
          doc.moveDown(0.25);
          drill.progressions.forEach((prog: string, i: number) => {
            doc.fontSize(8.5).fillColor(cfg.badgeText).font("Helvetica")
              .text(`${i + 1}.  ${cleanText(prog)}`, textColX, doc.y, { width: textColW, lineGap: 0.5 });
          });
          doc.moveDown(0.4);
        }

        const textEndY  = doc.y;
        // If the right-column text overflowed to a new page, diagramEndY is a
        // y-value from the previous page and must NOT be used in Math.max —
        // doing so would push doc.y to ~650pt (near bottom of new page).
        const blockEndY = pageNum === pageNumAtContent
          ? Math.max(diagramEndY, textEndY) + 6
          : textEndY + 6;

        // Draw left border (type colour) — only when entire block is on same page
        if (pageNum === pageNumAtContent) {
          const pm = (doc.page as any).margins;
          const sb = pm.bottom;
          pm.bottom = 0;
          doc.fillColor(cfg.border).rect(margin, drillBlockTopY, 3.5, blockEndY - drillBlockTopY).fill();
          pm.bottom = sb;
        }

        doc.x = margin;
        doc.y = blockEndY;

        // Separator between drills
        if (idx < session.drills.length - 1) {
          doc.strokeColor(cfg.border).lineWidth(0.3).opacity(0.35)
            .moveTo(margin, doc.y).lineTo(doc.page.width - margin, doc.y)
            .stroke().opacity(1);
          doc.moveDown(0.5);
        }
      });
    }

    // ── Coaching Emphasis ────────────────────────────────────────────────────
    if (skillFocus) {
      if (doc.y > doc.page.height - margin - 260) doc.addPage();
      doc.moveDown(1);
      drawCoachingEmphasis(doc, skillFocus, margin);
    }

    doc.end();
  });
}

// ─── generateCompactSessionPdf ────────────────────────────────────────────────
// "Coach's Sheet" — landscape A4, single page.
//
// Layout
// ┌───────────────────────────────────────────────────────────────────────────┐
// │  HEADER  dark navy — session title + meta chips                  48 pt   │
// ├──────────┬──────────┬──────────┬──────────────────────────────────────────┤
// │  Drill 1 │  Drill 2 │  Drill 3 │  Drill 4   (non-cooldown, max 4)        │
// │  [type]  │  [type]  │  [type]  │  [type]    colored top bar              │
// │  diagram │  diagram │  diagram │  diagram   fit column width             │
// │  org     │  org     │  org     │  org       6.5 pt muted                 │
// │  points  │  points  │  points  │  points    7.5 pt numbered              │
// ├──────────┴──────────┴──────────┴──────────────────────────────────────────┤
// │  COOLDOWN strip — badge · title · coaching points inline           55 pt  │
// └───────────────────────────────────────────────────────────────────────────┘

export async function generateCompactSessionPdf(session: any): Promise<Buffer> {
  console.log("[PDF] Generating compact session PDF:", {
    title: session.title,
    drillsCount: session.drills?.length,
  });

  return new Promise((resolve, reject) => {
    const margin = 22;
    // Landscape A4: 841.89 × 595.28 pt
    const doc = new PDFDocument({ size: "A4", layout: "landscape", margin });
    const chunks: Buffer[] = [];
    const sessionTitle = session.title || "Training Session";

    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end",  () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageW = doc.page.width;    // 841.89
    const pageH = doc.page.height;   // 595.28
    const contentW = pageW - margin * 2;

    // Partition drills: up to 4 main columns + optional cooldown strip
    const allDrills: any[] = (Array.isArray(session.drills) ? session.drills : []).map(normalizeDrill);
    const cooldownDrill = allDrills.find((d: any) => d.drillType === "COOLDOWN") ?? null;
    const mainDrills    = allDrills.filter((d: any) => d.drillType !== "COOLDOWN").slice(0, 4);

    // Suppress PDFKit auto-page-breaks while we draw in the lower zone
    const pm = (doc.page as any).margins;
    pm.bottom = 0;

    // ── Header (full width, dark navy, 48 pt) ────────────────────────────────
    const headerH = 48;
    doc.fillColor(BRAND.navy).rect(0, 0, pageW, headerH).fill();
    doc.fillColor(BRAND.blue).rect(0, headerH - 3, pageW, 3).fill();

    doc.fontSize(6).fillColor("#94a3b8").font("Helvetica")
      .text("TACTICALEDGE  ·  COACH'S SHEET", margin, 8, { lineBreak: false });

    // Title (left 60% of header)
    const maxTitleW = contentW * 0.62;
    doc.fontSize(11).fillColor(BRAND.white).font("Helvetica-Bold")
      .text(sessionTitle, margin, 17, { width: maxTitleW, lineBreak: false });

    // Meta chips (right portion of header, y=20)
    {
      const chipOpts = { bgColor: "#1e293b", textColor: "#94a3b8", fontSize: 6.5, padX: 5, padY: 2 };
      const chipY = 21;
      let cx = margin + maxTitleW + 16;
      if (session.refCode)  cx += drawBadge(doc, session.refCode, cx, chipY, chipOpts) + 5;
      if (session.ageGroup) cx += drawBadge(doc, session.ageGroup, cx, chipY, chipOpts) + 5;
      if (session.phase) {
        const lbl = PHASE_LABELS[session.phase] || session.phase;
        cx += drawBadge(doc, lbl, cx, chipY, chipOpts) + 5;
      }
      if (session.zone) {
        const lbl = ZONE_LABELS[session.zone] || session.zone;
        cx += drawBadge(doc, lbl, cx, chipY, chipOpts) + 5;
      }
      const dur = session.durationMin
        ?? allDrills.reduce((s: number, d: any) => s + (parseInt(d.duration ?? d.durationMin ?? 0) || 0), 0);
      if (dur > 0) drawBadge(doc, `${dur} min`, cx, chipY, chipOpts);
    }

    // ── Cooldown strip (bottom, 55 pt) ───────────────────────────────────────
    const cooldownH = 55;
    const cooldownY = pageH - margin - cooldownH;

    if (cooldownDrill) {
      const cdCfg = getDrillConfig(cooldownDrill.drillType);

      // Background + top border in type color
      doc.fillColor(cdCfg.bg).rect(margin, cooldownY, contentW, cooldownH).fill();
      doc.fillColor(cdCfg.border).rect(margin, cooldownY, contentW, 3).fill();

      // Badge + title + duration — single row
      let cdX = margin + 8;
      const cdBw = drawBadge(doc, cdCfg.label.toUpperCase(), cdX, cooldownY + 9, {
        bgColor: cdCfg.badgeBg, textColor: cdCfg.badgeText, fontSize: 6.5,
      });
      cdX += cdBw + 6;

      doc.fontSize(8.5).font("Helvetica-Bold").fillColor(BRAND.black);
      const cdTitleW = doc.widthOfString(cooldownDrill.title);
      doc.text(cooldownDrill.title, cdX, cooldownY + 8, { lineBreak: false });
      cdX += cdTitleW + 6;

      drawBadge(doc, `${cooldownDrill.duration} min`, cdX, cooldownY + 9, {
        bgColor: BRAND.surface, textColor: BRAND.muted, fontSize: 6.5,
      });

      // Coaching points — first 3, inline as numbered list
      const cdPts = (cooldownDrill.coachingPoints || []).slice(0, 3) as string[];
      if (cdPts.length > 0) {
        const ptsText = cdPts.map((p: string, i: number) => `${i + 1}.  ${p}`).join("     ");
        doc.fontSize(7.5).fillColor(BRAND.black).font("Helvetica")
          .text(ptsText, margin + 8, cooldownY + 26, { width: contentW - 16, lineBreak: false });
      }

      // Org summary
      const { setupSteps, constraints } = buildOrgSections(cooldownDrill.organization);
      const orgText = constraints[0] || setupSteps[0];
      if (orgText) {
        doc.fontSize(6.5).fillColor(BRAND.muted).font("Helvetica")
          .text(orgText, margin + 8, cooldownY + 40, { width: contentW - 16, lineBreak: false });
      }
    }

    // ── 4 Main Drill Columns ──────────────────────────────────────────────────
    const nCols   = Math.max(mainDrills.length, 1);
    const colGap  = 7;
    const colW    = (contentW - colGap * (nCols - 1)) / nCols;
    const colTop  = headerH + 7;
    const colBot  = cooldownY - 7;
    const colH    = colBot - colTop;

    mainDrills.forEach((drill: any, idx: number) => {
      const colX   = margin + idx * (colW + colGap);
      const cfg    = getDrillConfig(drill.drillType);
      const innerW = colW - 10;  // 5 pt padding each side
      const innerX = colX + 5;

      // Column background (very light drill-type tint)
      doc.fillColor(cfg.bg).rect(colX, colTop, colW, colH).fill();
      // Top colored bar
      doc.fillColor(cfg.border).rect(colX, colTop, colW, 4).fill();
      // Thin outer border
      doc.strokeColor(cfg.border).lineWidth(0.4)
        .rect(colX, colTop, colW, colH).stroke();

      // ── Row 1: type badge + duration (right-aligned) ──────────────────────
      const badgeY = colTop + 8;
      drawBadge(doc, cfg.label.toUpperCase(), innerX, badgeY, {
        bgColor: cfg.badgeBg, textColor: cfg.badgeText, fontSize: 6,
      });

      // Duration — right-aligned inside column
      doc.fontSize(6.5).fillColor(BRAND.muted).font("Helvetica-Bold");
      const durStr = `${drill.duration} min`;
      const durW   = doc.widthOfString(durStr);
      doc.text(durStr, colX + colW - 6 - durW, badgeY + 1, { lineBreak: false });

      // ── Row 2: drill title ────────────────────────────────────────────────
      const titleY = badgeY + 15;
      doc.fontSize(7.5).fillColor(BRAND.black).font("Helvetica-Bold")
        .text(drill.title, innerX, titleY, { width: innerW, lineBreak: true });
      let rowY = doc.y + 3;

      // ── Diagram ───────────────────────────────────────────────────────────
      if (drill.diagram) {
        // Horizontal: full inner width. Vertical: cap height at 125 pt → width = 125/1.5 ≈ 83 pt
        const orientation = drill.diagram?.pitch?.orientation || "HORIZONTAL";
        const diagW = orientation === "VERTICAL"
          ? Math.round(125 / 1.5)   // 83 pt wide → 125 pt tall
          : innerW;                  // full width → innerW / 1.5 tall
        // Center vertical (narrower) diagrams in the column
        const diagStartX = orientation === "VERTICAL"
          ? colX + (colW - diagW) / 2
          : innerX;

        doc.y = rowY;
        const di = drawDiagram(doc, drill.diagram, {
          width: diagW, startX: diagStartX,
          playerScale: 0.5, arrowScale: 0.55,
        });
        rowY = di ? di.startY + di.height + 5 : rowY + 5;
      }

      // Helper: small bold section label (e.g. "ORGANISATION")
      const drawColLabel = (label: string, y: number): number => {
        doc.fontSize(5.5).fillColor(cfg.border).font("Helvetica-Bold")
          .text(label, innerX, y, { lineBreak: false });
        return y + 8;  // label height + gap
      };

      // ── Organisation ──────────────────────────────────────────────────────
      const { setupSteps, constraints } = buildOrgSections(drill.organization);
      const orgText = constraints[0] || setupSteps[0];
      if (orgText && rowY + 10 < colBot - 4) {
        rowY = drawColLabel("ORGANISATION", rowY);
        doc.fontSize(6).fillColor(BRAND.muted).font("Helvetica")
          .text(orgText, innerX, rowY, { width: innerW });
        rowY = doc.y + 3;
      }

      // ── Description ───────────────────────────────────────────────────────
      if (drill.description && rowY + 14 < colBot - 4) {
        rowY = drawColLabel("DESCRIPTION", rowY);
        doc.fontSize(6.5).fillColor("#334155").font("Helvetica")
          .text(drill.description, innerX, rowY, { width: innerW, lineGap: 0.3 });
        rowY = doc.y + 3;
      }

      // ── Key Coaching Points ───────────────────────────────────────────────
      const pts = (drill.coachingPoints || []) as string[];
      if (pts.length > 0 && rowY + 14 < colBot - 4) {
        rowY = drawColLabel("KEY POINTS", rowY);
        pts.forEach((pt: string, i: number) => {
          if (rowY + 8 > colBot - 4) return;
          doc.fontSize(7).fillColor(BRAND.black).font("Helvetica")
            .text(`${i + 1}.  ${pt}`, innerX, rowY, { width: innerW, lineGap: 0.3 });
          rowY = doc.y;
        });
        rowY += 2;
      }

      // ── Progressions ──────────────────────────────────────────────────────
      const progs = (drill.progressions || []) as string[];
      if (progs.length > 0 && rowY + 14 < colBot - 4) {
        rowY = drawColLabel("PROGRESSIONS", rowY);
        progs.forEach((prog: string, i: number) => {
          if (rowY + 8 > colBot - 4) return;
          doc.fontSize(7).fillColor(BRAND.black).font("Helvetica")
            .text(`${i + 1}.  ${prog}`, innerX, rowY, { width: innerW, lineGap: 0.3 });
          rowY = doc.y;
        });
      }
    });

    doc.end();
  });
}

// ─── generateDrillPdf ─────────────────────────────────────────────────────────

export async function generateDrillPdf(drill: any): Promise<Buffer> {
  console.log("[PDF] Generating drill PDF:", { title: drill.title });

  return new Promise((resolve, reject) => {
    const doc        = new PDFDocument({ size: "A4", margin: 45 });
    const chunks: Buffer[] = [];
    const margin     = 45;
    const meta       = drill.json || drill;
    const drillTitle = drill.title || meta.title || "Training Drill";
    const drillType  = drill.drillType || meta.drillType || "TECHNICAL";
    const cfg        = getDrillConfig(drillType);
    let pageNum      = 1;
    let drawingDecor = false;

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("error", reject);
    doc.on("end", () => resolve(Buffer.concat(chunks)));

    doc.on("pageAdded", () => {
      if (drawingDecor) return;
      pageNum++;
      drawingDecor = true;
      drawPageDecor(doc, drillTitle, pageNum);
      drawingDecor = false;
      doc.x = margin;
      doc.y = margin;
    });

    drawPageDecor(doc, drillTitle, pageNum);

    // ── Header block ─────────────────────────────────────────────────────────
    {
      const headerH = 95;
      const { width } = doc.page;

      doc.fillColor(BRAND.navy).rect(0, 0, width, headerH).fill();
      doc.fillColor(cfg.border).rect(0, headerH - 4, width, 4).fill();

      doc.fontSize(7.5).fillColor("#94a3b8").font("Helvetica")
        .text("TACTICALEDGE  ·  DRILL", margin, 13, { lineBreak: false });

      doc.fontSize(19).fillColor(BRAND.white).font("Helvetica-Bold")
        .text(drillTitle, margin, 25, { width: width - margin * 2 - 10 });

      // Metadata badges
      let bx = margin;
      const by = headerH - 30;
      const gameModel = drill.gameModelId || meta.gameModelId;
      const ageGroup  = drill.ageGroup    || meta.ageGroup;
      const phase     = drill.phase       || meta.phase;

      if (ageGroup) {
        bx += drawBadge(doc, ageGroup, bx, by, {
          bgColor: "#1e3a5f", textColor: "#93c5fd", fontSize: 7.5,
        }) + 6;
      }
      if (gameModel) {
        bx += drawBadge(doc, GAME_MODEL_LABELS[gameModel] || gameModel, bx, by, {
          bgColor: "#1e3a5f", textColor: "#93c5fd", fontSize: 7.5,
        }) + 6;
      }
      if (phase) {
        bx += drawBadge(doc, phase.replace(/_/g, " "), bx, by, {
          bgColor: "#1e3a5f", textColor: "#93c5fd", fontSize: 7.5,
        }) + 6;
      }
      drawBadge(doc, cfg.label.toUpperCase(), bx, by, {
        bgColor: cfg.badgeBg, textColor: cfg.badgeText, fontSize: 7.5,
      });

      doc.y = headerH + 18;
      doc.x = margin;
    }

    const pageW = doc.page.width - margin * 2;

    // ── Description ──────────────────────────────────────────────────────────
    if (meta.description) {
      drawSectionHeader(doc, "Description", margin);
      doc.fontSize(9.5).fillColor(BRAND.black).font("Helvetica")
        .text(meta.description, margin, doc.y, { width: pageW, lineGap: 2 });
      doc.moveDown(1);
    }

    // ── Diagram ──────────────────────────────────────────────────────────────
    const rawDiagram = drill.diagram || drill.diagramV1 || meta.diagram || meta.diagramV1;
    if (rawDiagram) {
      if (doc.y > doc.page.height - margin - 250) doc.addPage();
      drawSectionHeader(doc, "Diagram", margin, cfg.border);
      const di = drawDiagram(doc, rawDiagram, { width: 240, position: "center" });
      if (di) {
        doc.y = di.startY + di.height;
        doc.moveDown(1.2);
      }
    }

    // ── Organisation ─────────────────────────────────────────────────────────
    const orgLines = buildOrgText(meta.organization);
    if (orgLines.length > 0) {
      if (doc.y > doc.page.height - margin - 150) doc.addPage();
      drawSectionHeader(doc, "Organisation", margin);
      orgLines.forEach((line) => {
        doc.fontSize(9.5).fillColor(BRAND.black).font("Helvetica")
          .text(`·  ${line}`, margin, doc.y, { width: pageW, lineGap: 1.5 });
      });
      doc.moveDown(1);
    }

    // ── Coaching Points ───────────────────────────────────────────────────────
    const coachingPoints: string[] = Array.isArray(meta.coachingPoints) ? meta.coachingPoints : [];
    if (coachingPoints.length > 0) {
      if (doc.y > doc.page.height - margin - 100) doc.addPage();
      drawSectionHeader(doc, "Key Coaching Points", margin);
      coachingPoints.forEach((pt: string, i: number) => {
        doc.fontSize(9.5).fillColor(BRAND.black).font("Helvetica")
          .text(`${i + 1}.  ${pt}`, margin, doc.y, { width: pageW, lineGap: 2 });
      });
      doc.moveDown(1);
    }

    // ── Progressions ──────────────────────────────────────────────────────────
    const progressions: string[] = Array.isArray(meta.progressions) ? meta.progressions : [];
    if (progressions.length > 0) {
      if (doc.y > doc.page.height - margin - 100) doc.addPage();
      drawSectionHeader(doc, "Progressions", margin, cfg.border);
      progressions.forEach((prog: string, i: number) => {
        doc.fontSize(9.5).fillColor(BRAND.black).font("Helvetica")
          .text(`${i + 1}.  ${prog}`, margin, doc.y, { width: pageW, lineGap: 2 });
      });
    }

    doc.end();
  });
}

// ─── generatePlayerPlanPdf ────────────────────────────────────────────────────

export async function generatePlayerPlanPdf(plan: any): Promise<Buffer> {
  console.log("[PDF] Generating player plan PDF:", { title: plan.title });

  return new Promise((resolve, reject) => {
    const doc        = new PDFDocument({ size: "A4", margin: 45 });
    const chunks: Buffer[] = [];
    const margin     = 45;
    const planTitle  = plan.title || "Player Training Plan";
    let pageNum      = 1;
    let drawingDecor = false;

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("error", reject);
    doc.on("end", () => resolve(Buffer.concat(chunks)));

    doc.on("pageAdded", () => {
      if (drawingDecor) return;
      pageNum++;
      drawingDecor = true;
      drawPageDecor(doc, planTitle, pageNum);
      drawingDecor = false;
      doc.x = margin;
      doc.y = margin;
    });

    drawPageDecor(doc, planTitle, pageNum);

    // ── Header block ─────────────────────────────────────────────────────────
    {
      const headerH = 115;
      const { width } = doc.page;

      doc.fillColor(BRAND.navy).rect(0, 0, width, headerH).fill();
      doc.fillColor("#059669").rect(0, headerH - 4, width, 4).fill();

      doc.fontSize(7.5).fillColor("#94a3b8").font("Helvetica")
        .text("TACTICALEDGE  ·  PLAYER PLAN", margin, 12, { lineBreak: false });

      doc.fontSize(18).fillColor(BRAND.white).font("Helvetica-Bold")
        .text(planTitle, margin, 26, { width: width - margin * 2 - 10, lineBreak: false });

      // Chips row (same dark slate style as session PDF)
      const chipY = headerH - 34;
      let bx = margin;
      const chipBg   = "#1e293b";
      const chipText = "#94a3b8";
      const chipFs   = 7.5;

      if (plan.ageGroup) {
        bx += drawBadge(doc, plan.ageGroup, bx, chipY, {
          bgColor: chipBg, textColor: chipText, fontSize: chipFs,
        }) + 5;
      }
      if (plan.playerLevel) {
        bx += drawBadge(doc, `Level: ${plan.playerLevel}`, bx, chipY, {
          bgColor: chipBg, textColor: chipText, fontSize: chipFs,
        }) + 5;
      }
      if (plan.durationMin) {
        drawBadge(doc, `Duration: ${plan.durationMin} min`, bx, chipY, {
          bgColor: chipBg, textColor: chipText, fontSize: chipFs,
        });
      }

      doc.y = headerH + 18;
      doc.x = margin;
    }

    const pageW = doc.page.width - margin * 2;

    // ── Objectives ───────────────────────────────────────────────────────────
    if (plan.objectives) {
      drawSectionHeader(doc, "Objectives", margin, "#059669");
      doc.fontSize(9.5).fillColor(BRAND.black).font("Helvetica")
        .text(plan.objectives, margin, doc.y, { width: pageW, lineGap: 2 });
      doc.moveDown(1);
    }

    // ── Equipment ────────────────────────────────────────────────────────────
    if (Array.isArray(plan.equipment) && plan.equipment.length > 0) {
      drawSectionHeader(doc, "Equipment", margin, "#059669");
      let eqX = margin;
      const eqY = doc.y;
      plan.equipment.forEach((item: string) => {
        const bw = drawBadge(doc, item, eqX, eqY, {
          bgColor: BRAND.surface, textColor: BRAND.navy,
          fontSize: 8.5, padX: 9, padY: 3.5,
          borderColor: BRAND.separator,
        });
        eqX += bw + 6;
        if (eqX > doc.page.width - margin - 80) eqX = margin;
      });
      doc.y = eqY + 22;
      doc.moveDown(0.8);
    }

    // ── Exercises ─────────────────────────────────────────────────────────────
    const drills = plan.json?.drills || [];
    if (drills.length > 0) {
      drawSectionHeader(doc, "Exercises", margin, "#059669");

      drills.forEach((ex: any, idx: number) => {
        if (doc.y > doc.page.height - margin - 200) doc.addPage();

        const exType = ex.drillType || "TECHNICAL";
        const cfg    = getDrillConfig(exType);
        const blockTopY = doc.y;

        // Number circle
        const circX = margin + 11;
        doc.fillColor(cfg.border).circle(circX, doc.y + 8, 10).fill();
        doc.fontSize(8).fillColor(BRAND.white).font("Helvetica-Bold")
          .text(String(idx + 1), circX - 10, doc.y + 4, { width: 20, align: "center", lineBreak: false });

        // Exercise title + badges
        doc.fontSize(11).fillColor(BRAND.black).font("Helvetica-Bold")
          .text(ex.title || `Exercise ${idx + 1}`, margin + 26, doc.y, { lineBreak: false });

        const titleEndX = margin + 26 + doc.widthOfString(ex.title || `Exercise ${idx + 1}`) + 10;
        const by = doc.y - 1;
        const bw = drawBadge(doc, cfg.label.toUpperCase(), titleEndX, by, {
          bgColor: cfg.badgeBg, textColor: cfg.badgeText, fontSize: 7.5,
        });
        if (ex.durationMin) {
          drawBadge(doc, `${ex.durationMin} min`, titleEndX + bw + 6, by, {
            bgColor: BRAND.surface, textColor: BRAND.muted, fontSize: 7.5,
          });
        }
        doc.moveDown(0.8);

        // Indent all body content from the left border
        const bodyX = margin + 16;
        const bodyW = pageW - 16;

        if (ex.description) {
          doc.fontSize(9).fillColor(BRAND.black).font("Helvetica")
            .text(ex.description, bodyX, doc.y, { width: bodyW, lineGap: 2 });
          doc.moveDown(0.4);
        }

        if (Array.isArray(ex.organization?.setupSteps) && ex.organization.setupSteps.length > 0) {
          doc.fontSize(9).fillColor(BRAND.navy).font("Helvetica-Bold")
            .text("Setup & Instructions", bodyX, doc.y);
          doc.moveDown(0.2);
          ex.organization.setupSteps.forEach((step: string, i: number) => {
            doc.fontSize(9).fillColor(BRAND.black).font("Helvetica")
              .text(`${i + 1}.  ${step}`, bodyX, doc.y, { width: bodyW, lineGap: 1 });
          });
          doc.moveDown(0.3);
        }

        const areaInfo: string[] = [];
        if (ex.organization?.area?.lengthYards && ex.organization.area.widthYards) {
          areaInfo.push(`${ex.organization.area.lengthYards} x ${ex.organization.area.widthYards} yards`);
        }
        if (ex.organization?.area?.notes) areaInfo.push(ex.organization.area.notes);
        if (Array.isArray(ex.organization?.equipment) && ex.organization.equipment.length > 0) {
          areaInfo.push(`Equipment: ${ex.organization.equipment.join(", ")}`);
        }
        if (areaInfo.length > 0) {
          doc.fontSize(8).fillColor(BRAND.muted).font("Helvetica")
            .text(areaInfo.join("  ·  "), bodyX, doc.y, { width: bodyW });
          doc.moveDown(0.3);
        }

        if (ex.organization?.reps || ex.organization?.rest) {
          const reps = [
            ex.organization.reps ? `Reps: ${ex.organization.reps}` : "",
            ex.organization.rest ? `Rest: ${ex.organization.rest}` : "",
          ].filter(Boolean).join("  ·  ");
          doc.fontSize(9).fillColor(BRAND.navy).font("Helvetica-Bold")
            .text(reps, bodyX, doc.y, { width: bodyW });
          doc.moveDown(0.3);
        }

        if (Array.isArray(ex.coachingPoints) && ex.coachingPoints.length > 0) {
          doc.fontSize(9).fillColor(BRAND.navy).font("Helvetica-Bold")
            .text("Self-Coaching Points", bodyX, doc.y);
          doc.moveDown(0.2);
          ex.coachingPoints.forEach((pt: string) => {
            doc.fontSize(9).fillColor(BRAND.black).font("Helvetica")
              .text(`\u2022  ${pt}`, bodyX, doc.y, { width: bodyW, lineGap: 1 });
          });
          doc.moveDown(0.3);
        }

        if (Array.isArray(ex.progressions) && ex.progressions.length > 0) {
          doc.fontSize(9).fillColor(BRAND.navy).font("Helvetica-Bold")
            .text("Progressions", bodyX, doc.y);
          doc.moveDown(0.2);
          ex.progressions.forEach((prog: string, i: number) => {
            doc.fontSize(9).fillColor(cfg.badgeText).font("Helvetica")
              .text(`${i + 1}.  ${cleanText(prog)}`, bodyX, doc.y, { width: bodyW, lineGap: 1 });
          });
          doc.moveDown(0.3);
        }

        const blockEndY = doc.y + 4;

        // Left border
        {
          const pm = (doc.page as any).margins;
          const sb = pm.bottom;
          pm.bottom = 0;
          doc.fillColor(cfg.border).rect(margin, blockTopY, 3.5, blockEndY - blockTopY).fill();
          pm.bottom = sb;
        }

        doc.x = margin;
        doc.y = blockEndY;

        if (idx < drills.length - 1) {
          doc.strokeColor(BRAND.separator).lineWidth(0.4)
            .moveTo(margin, doc.y).lineTo(doc.page.width - margin, doc.y).stroke();
          doc.moveDown(0.5);
        }
      });
    }

    doc.end();
  });
}

// ─── generateWeeklySummaryPdf ─────────────────────────────────────────────────

export async function generateWeeklySummaryPdf(summary: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc        = new PDFDocument({ margin: 45, size: "LETTER" });
    const chunks: Buffer[] = [];
    const margin     = 45;
    const docTitle   = "Weekly Training Schedule";
    let pageNum      = 1;
    let drawingDecor = false;

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("error", reject);
    doc.on("end", () => resolve(Buffer.concat(chunks)));

    doc.on("pageAdded", () => {
      if (drawingDecor) return;
      pageNum++;
      drawingDecor = true;
      drawPageDecor(doc, docTitle, pageNum);
      drawingDecor = false;
      doc.x = margin;
      doc.y = margin;
    });

    drawPageDecor(doc, docTitle, pageNum);

    const {
      weekStart,
      weekEnd,
      events,
      totalSessions,
      totalMinutes,
      ageGroups,
      gameModels,
      aiSummary,
    } = summary;

    const formatDate = (date: Date) =>
      date.toLocaleDateString("en-US", {
        weekday: "long", month: "long", day: "numeric", year: "numeric",
      });

    const formatTime = (date: Date) =>
      date.toLocaleTimeString("en-US", {
        hour: "numeric", minute: "2-digit", hour12: true,
      });

    const pageW = doc.page.width - margin * 2;

    // ── Header block ─────────────────────────────────────────────────────────
    {
      const headerH = 100;
      const { width } = doc.page;

      doc.fillColor(BRAND.navy).rect(0, 0, width, headerH).fill();
      doc.fillColor(BRAND.blue).rect(0, headerH - 4, width, 4).fill();

      doc.fontSize(7.5).fillColor("#94a3b8").font("Helvetica")
        .text("TACTICALEDGE  ·  WEEKLY SCHEDULE", margin, 13, { lineBreak: false });

      doc.fontSize(20).fillColor(BRAND.white).font("Helvetica-Bold")
        .text(docTitle, margin, 26, { width: width - margin * 2 - 10 });

      doc.fontSize(8.5).fillColor("#94a3b8").font("Helvetica")
        .text(
          `${formatDate(weekStart)}  –  ${formatDate(weekEnd)}`,
          margin, 56, { width: width - margin * 2, lineBreak: false }
        );

      doc.y = headerH + 18;
      doc.x = margin;
    }

    // ── Stats summary strip ──────────────────────────────────────────────────
    {
      const hours   = Math.floor(totalMinutes / 60);
      const mins    = totalMinutes % 60;
      const stats   = [
        { label: "Sessions",       value: String(totalSessions) },
        { label: "Training Time",  value: `${hours}h ${mins}m` },
        { label: "Age Groups",     value: (ageGroups || []).join(", ") || "—" },
        { label: "Focus Areas",
          value: (gameModels || []).map((gm: string) => GAME_MODEL_LABELS[gm] || gm).join(", ") || "—" },
      ];

      const stripY = doc.y;
      const statW  = pageW / stats.length;
      const stripH = 42;

      doc.fillColor(BRAND.surface).rect(margin, stripY, pageW, stripH).fill();
      doc.strokeColor(BRAND.separator).lineWidth(0.4).rect(margin, stripY, pageW, stripH).stroke();

      stats.forEach((s, i) => {
        const sx = margin + i * statW;
        doc.fontSize(14).fillColor(BRAND.navy).font("Helvetica-Bold")
          .text(s.value, sx + 8, stripY + 8, { width: statW - 16, lineBreak: false });
        doc.fontSize(7.5).fillColor(BRAND.muted).font("Helvetica")
          .text(s.label, sx + 8, stripY + 26, { width: statW - 16, lineBreak: false });
        if (i > 0) {
          doc.strokeColor(BRAND.separator).lineWidth(0.4)
            .moveTo(sx, stripY + 8).lineTo(sx, stripY + stripH - 8).stroke();
        }
      });

      doc.y = stripY + stripH + 16;
    }

    // ── AI summary ──────────────────────────────────────────────────────────
    if (aiSummary) {
      drawSectionHeader(doc, "Parent Communication Summary", margin);
      doc.fontSize(9.5).fillColor(BRAND.black).font("Helvetica")
        .text(aiSummary, margin, doc.y, { width: pageW, lineGap: 2 });
      doc.moveDown(1.2);
    }

    // ── Schedule by date ─────────────────────────────────────────────────────
    drawSectionHeader(doc, "Schedule", margin);

    const eventsByDate: Record<string, any[]> = {};
    (events || []).forEach((event: any) => {
      const key = new Date(event.scheduledDate).toISOString().split("T")[0];
      if (!eventsByDate[key]) eventsByDate[key] = [];
      eventsByDate[key].push(event);
    });

    const threshold = doc.page.height - margin - 80;

    Object.keys(eventsByDate).sort().forEach((dateKey) => {
      const dayEvents = eventsByDate[dateKey];
      const date      = new Date(dateKey);

      if (doc.y > threshold) doc.addPage();

      // Day header
      doc.fillColor(BRAND.navy).rect(margin, doc.y, pageW, 20).fill();
      doc.fontSize(9).fillColor(BRAND.white).font("Helvetica-Bold")
        .text(formatDate(date), margin + 8, doc.y + 6, { width: pageW - 16, lineBreak: false });
      doc.y += 24;

      dayEvents.forEach((event) => {
        if (doc.y > threshold) doc.addPage();

        const eventTopY = doc.y;

        // Session title
        doc.fontSize(10.5).fillColor(BRAND.black).font("Helvetica-Bold")
          .text(event.session?.title || "Untitled Session", margin + 8, doc.y);
        doc.moveDown(0.2);

        // Time + duration
        const timeLine = [
          formatTime(new Date(event.scheduledDate)),
          event.durationMin ? `${event.durationMin} min` : null,
          event.location || null,
          event.teamName ? `Team: ${event.teamName}` : null,
          event.session?.ageGroup || null,
        ].filter(Boolean).join("  ·  ");

        doc.fontSize(8.5).fillColor(BRAND.muted).font("Helvetica")
          .text(timeLine, margin + 8, doc.y, { width: pageW - 16, lineGap: 1 });
        doc.moveDown(0.2);

        if (event.notes) {
          doc.fontSize(8.5).fillColor(BRAND.muted).font("Helvetica")
            .text(`Notes: ${event.notes}`, margin + 8, doc.y, { width: pageW - 16 });
          doc.moveDown(0.2);
        }

        if (event.sessionRefCode) {
          doc.fontSize(8).fillColor(BRAND.muted).font("Helvetica")
            .text(`Ref: ${event.sessionRefCode}`, margin + 8, doc.y, { width: pageW - 16 });
          doc.moveDown(0.2);
        }

        const eventEndY = doc.y + 6;

        // Left accent bar (blue for schedule events)
        {
          const pm = (doc.page as any).margins;
          const sb = pm.bottom;
          pm.bottom = 0;
          doc.fillColor(BRAND.blue).rect(margin, eventTopY, 3, eventEndY - eventTopY).fill();
          pm.bottom = sb;
        }

        doc.y = eventEndY;
        doc.x = margin;

        // Thin separator between events
        doc.strokeColor(BRAND.separator).lineWidth(0.3)
          .moveTo(margin, doc.y).lineTo(margin + pageW, doc.y).stroke();
        doc.moveDown(0.5);
      });

      doc.moveDown(0.3);
    });

    doc.end();
  });
}
