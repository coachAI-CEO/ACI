import PDFDocument from "pdfkit";

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
  goals?: Array<{
    x: number;
    y: number;
    width?: number;
    height?: number;
  }>;
  arrows?: Array<{
    from: { x?: number; y?: number; playerId?: string };
    to: { x?: number; y?: number; playerId?: string };
    type?: string;
    style?: string;
  }>;
};

function drawDiagram(doc: PDFKit.PDFDocument, rawDiagram: any, options?: { width?: number; position?: 'left' | 'center'; startX?: number }): { width: number; height: number; startX: number; startY: number } | null {
  try {
    if (!rawDiagram || typeof rawDiagram !== "object") {
      console.log("[PDF] No diagram object found or invalid type:", typeof rawDiagram);
      return null;
    }
    
    const diagram: DiagramV1 = rawDiagram;
    const players = diagram.players || [];
    const goals = diagram.goals || [];
    const arrows = diagram.arrows || [];
    
    if (!Array.isArray(players) || players.length === 0) {
      console.log("[PDF] Diagram has no players array or it's empty", {
        hasPlayers: !!diagram.players,
        playersLength: players.length,
        diagramKeys: Object.keys(diagram),
        diagramString: JSON.stringify(diagram).substring(0, 200),
      });
      return null;
    }
    console.log(`[PDF] Drawing diagram with ${players.length} players`);

    // Make diagram much smaller to fit on left side
    const margin = 50;
    const diagramWidth = options?.width || 150; // Small width for left side
    const variant = diagram.pitch?.variant || "HALF";
    const orientation = diagram.pitch?.orientation || "HORIZONTAL";
    
    // For horizontal: wider than tall (1.5:1 ratio)
    // For vertical: taller than wide (1:1.5 ratio)
    let boxWidth: number;
    let boxHeight: number;
    
    if (orientation === "VERTICAL") {
      // Vertical: height is the limiting factor
      boxHeight = diagramWidth * 1.5;
      boxWidth = diagramWidth;
    } else {
      // Horizontal: width is the limiting factor
      boxWidth = diagramWidth;
      boxHeight = boxWidth / 1.5; // Maintain 1.5:1 aspect ratio
    }
    
    // Position on left side (use provided startX or default to margin)
    const startX = options?.startX ?? margin;
    let startY = doc.y; // Use current Y position directly (no extra spacing)

    doc.save();
    
    // Match web version: viewBox 0-100, field at x=2, y=5, width=96, height=90
    // Scale factors to convert 0-100 viewBox to PDF coordinates
    const scaleX = boxWidth / 100;
    const scaleY = boxHeight / 100;
    
    // Helper to convert viewBox coords to PDF coords
    const toX = (vx: number) => startX + vx * scaleX;
    const toY = (vy: number) => startY + vy * scaleY;
    
    // Draw field background - darker green like the web version
    doc
      .fillColor("#022c22") // Dark green (matches web pitchBackground)
      .rect(startX, startY, boxWidth, boxHeight)
      .fill();
    
    const lineColor = "#e5e7eb";
    
    // Outer pitch border (matching web: x=2, y=5, width=96, height=90)
    doc
      .lineWidth(0.9)
      .strokeColor(lineColor)
      .rect(toX(2), toY(5), 96 * scaleX, 90 * scaleY)
      .stroke();
    
    // Halfway line (y=50 in viewBox)
    doc
      .lineWidth(0.5)
      .strokeColor(lineColor)
      .opacity(0.7)
      .moveTo(toX(2), toY(50))
      .lineTo(toX(98), toY(50))
      .stroke()
      .opacity(1);
    
    // Penalty box at top (x=30, y=5, width=40, height=18)
    doc
      .lineWidth(0.75)
      .strokeColor(lineColor)
      .rect(toX(30), toY(5), 40 * scaleX, 18 * scaleY)
      .stroke();
    
    // Goal box inside penalty area (x=40, y=5, width=20, height=7)
    doc
      .lineWidth(0.65)
      .strokeColor(lineColor)
      .rect(toX(40), toY(5), 20 * scaleX, 7 * scaleY)
      .stroke();
    
    // Goal line (thicker white line at top center)
    doc
      .lineWidth(1.2)
      .strokeColor(lineColor)
      .moveTo(toX(45), toY(5))
      .lineTo(toX(55), toY(5))
      .stroke();
    
    // Center circle arc (semicircle at y=50)
    const circleRadius = 9 * Math.min(scaleX, scaleY);
    const centerX = toX(50);
    const centerY = toY(50);
    doc
      .lineWidth(0.5)
      .strokeColor(lineColor)
      .opacity(0.6);
    // Draw semicircle arc (top half)
    doc.path(`M ${centerX - circleRadius} ${centerY} A ${circleRadius} ${circleRadius} 0 0 0 ${centerX + circleRadius} ${centerY}`)
      .stroke()
      .opacity(1);

    // Helper to map team -> color (matching web version)
    const teamColor = (team?: DiagramTeamCode): string => {
      if (team === "ATT") return "#2563eb"; // blue (matches web)
      if (team === "DEF") return "#ef4444"; // red (matches web)
      return "#6b7280"; // neutral / gray
    };

    // Calculate player size based on field size (proportional)
    const baseRadius = Math.min(boxWidth, boxHeight) * 0.025; // 2.5% of smaller dimension
    const radius = Math.max(6, Math.min(10, baseRadius)); // Clamp between 6-10 points

    // Draw players as circles with numbers
    players.forEach((p) => {
      if (typeof p.x !== "number" || typeof p.y !== "number") return;

      // Map 0-100 coordinates to field positions
      // For horizontal: x is width, y is height
      // For vertical: x is height, y is width (swapped)
      let px: number, py: number;
      
      if (orientation === "VERTICAL") {
        // Vertical: x maps to height, y maps to width
        px = startX + (Math.min(Math.max(p.y, 0), 100) / 100) * boxWidth;
        py = startY + (Math.min(Math.max(p.x, 0), 100) / 100) * boxHeight;
      } else {
        // Horizontal: x maps to width, y maps to height
        px = startX + (Math.min(Math.max(p.x, 0), 100) / 100) * boxWidth;
        py = startY + (Math.min(Math.max(p.y, 0), 100) / 100) * boxHeight;
      }

      const fill = teamColor(p.team);

      // Player circle - draw fill first, then stroke
      // Use separate operations to ensure proper rendering
      doc
        .lineWidth(1.5)
        .fillColor(fill)
        .circle(px, py, radius)
        .fill();
      
      // Stroke the circle border (white for contrast on dark field)
      doc
        .strokeColor("#e5e7eb")
        .lineWidth(0.7)
        .circle(px, py, radius)
        .stroke();

      // Number or role initial (white text for dark background)
      const label =
        typeof p.number === "number"
          ? String(p.number)
          : p.role
          ? p.role.slice(0, 2).toUpperCase()
          : "";

      if (label) {
        doc
          .fontSize(Math.max(5, radius * 0.6))
          .fillColor("white")
          .text(label, px - radius, py - radius * 0.35, {
            width: radius * 2,
            align: "center",
          });
      }
    });

    // Draw arrows (movements, passes, etc.)
    if (Array.isArray(arrows) && arrows.length > 0) {
      const getPlayerPos = (ref: { x?: number; y?: number; playerId?: string }) => {
        if (typeof ref.x === "number" && typeof ref.y === "number") {
          if (orientation === "VERTICAL") {
            return {
              x: startX + (Math.min(Math.max(ref.y, 0), 100) / 100) * boxWidth,
              y: startY + (Math.min(Math.max(ref.x, 0), 100) / 100) * boxHeight,
            };
          } else {
            return {
              x: startX + (Math.min(Math.max(ref.x, 0), 100) / 100) * boxWidth,
              y: startY + (Math.min(Math.max(ref.y, 0), 100) / 100) * boxHeight,
            };
          }
        }
        // Try to find by playerId
        if (ref.playerId) {
          const player = players.find((p) => p.id === ref.playerId);
          if (player && typeof player.x === "number" && typeof player.y === "number") {
            if (orientation === "VERTICAL") {
              return {
                x: startX + (Math.min(Math.max(player.y, 0), 100) / 100) * boxWidth,
                y: startY + (Math.min(Math.max(player.x, 0), 100) / 100) * boxHeight,
              };
            } else {
              return {
                x: startX + (Math.min(Math.max(player.x, 0), 100) / 100) * boxWidth,
                y: startY + (Math.min(Math.max(player.y, 0), 100) / 100) * boxHeight,
              };
            }
          }
        }
        return null;
      };

      arrows.forEach((arrow) => {
        const from = getPlayerPos(arrow.from);
        const to = getPlayerPos(arrow.to);
        if (!from || !to) return;

        const arrowStyle = arrow.style || "solid";
        const arrowType = arrow.type || "pass";
        
        // Determine color based on arrow type (light colors for dark background)
        let arrowColor = "#e5e7eb"; // white/light default for passes
        if (arrowType === "run") arrowColor = "#22c55e"; // green for runs
        if (arrowType === "press") arrowColor = "#f97316"; // orange for press

        doc
          .lineWidth(arrowStyle === "bold" ? 1.5 : 1)
          .strokeColor(arrowColor);
        
        if (arrowStyle === "dashed") {
          doc.dash(5, { space: 3 });
        } else if (arrowStyle === "dotted") {
          doc.dash(2, { space: 2 });
        }

        doc
          .moveTo(from.x, from.y)
          .lineTo(to.x, to.y)
          .stroke();

        if (arrowStyle !== "solid") {
          doc.undash();
        }
      });
    }

    // Reset all colors before restoring
    doc.fillColor("black");
    doc.strokeColor("black");
    
    doc.restore();
    
    // Ensure text color is reset for subsequent content
    doc.fillColor("black");

    // Return diagram dimensions and position so caller can position text accordingly
    return { width: boxWidth, height: boxHeight, startX, startY };
  } catch (e: any) {
    console.error("[PDF] Error drawing diagram:", e);
    // Continue without diagram rather than breaking the PDF
    doc.moveDown(0.5);
    doc.fontSize(8).fillColor("red").text("(Diagram rendering error)");
    return null;
  }
}

export async function generateSessionPdf(session: any): Promise<Buffer> {
  console.log("[PDF] Generating PDF for session:", {
    title: session.title,
    drillsCount: session.drills?.length,
    drillsWithDiagrams: session.drills?.filter((d: any) => d.diagram || d.diagramV1).length,
    sessionKeys: Object.keys(session || {}),
    firstDrillSample: session.drills?.[0] ? {
      title: session.drills[0].title,
      keys: Object.keys(session.drills[0]),
      hasDiagram: !!(session.drills[0].diagram || session.drills[0].diagramV1),
    } : 'no drills',
  });
  const doc = new PDFDocument({ size: "A4", margin: 50 });
  const chunks: Buffer[] = [];

  doc.on("data", (chunk) => chunks.push(chunk));

  doc.fontSize(20).fillColor("black").text(session.title || "Training Session", {
    align: "left",
  });
  doc.moveDown(0.5);
  doc
    .fontSize(10)
    .fillColor("gray")
    .text(
      `${session.gameModelId || ""}${
        session.ageGroup ? " • " + session.ageGroup : ""
      }`,
      { align: "left" }
    );
  doc.moveDown();

  if (session.summary) {
    doc.fontSize(12).fillColor("black").text("Summary", { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10).text(session.summary, { align: "left" });
    doc.moveDown();
  }

  // Store skill focus for later (will be rendered after drills)
  const skillFocus = session.skillFocus || session.json?.skillFocus;

  if (Array.isArray(session.drills)) {
    doc.fontSize(12).fillColor("black").font("Helvetica-Bold").text("Drills", { underline: true });
    doc.moveDown(0.5);
    
    session.drills.forEach((drill: any, idx: number) => {
      const margin = 50;
      const pageWidth = doc.page.width - margin * 2;
      const diagramWidth = 160; // Slightly smaller diagram
      const textColumnWidth = pageWidth - diagramWidth - 15; // Gap of 15
      const textColumnX = margin + diagramWidth + 15;
      
      // Only add page break if very close to bottom (leave room for title + minimal content)
      const minRemainingSpace = 120;
      if (doc.y > doc.page.height - margin - minRemainingSpace) {
        doc.addPage();
      }
      
      // Minimal spacing between drills
      if (idx > 0) {
        doc.moveDown(0.5);
      }
      
      // Drill title
      doc
        .fontSize(12)
        .fillColor("black")
        .font("Helvetica-Bold")
        .text(`${idx + 1}. ${drill.title || drill.drillType || "Drill"}`, margin);
      doc
        .fontSize(9)
        .fillColor("gray")
        .font("Helvetica")
        .text(`Type: ${drill.drillType || "N/A"} • Duration: ${drill.duration || drill.durationMin || "?"} min`, margin);
      
      doc.moveDown(0.5);
      
      // Record the Y position where content will start
      const contentStartY = doc.y;
      
      // Check for diagram
      const rawDiagram = drill.diagram || drill.diagramV1;
      let diagramEndY = contentStartY;
      let textStartY = contentStartY; // Where text should start
      
      // Draw diagram on the left
      if (rawDiagram) {
        const diagramInfo = drawDiagram(doc, rawDiagram, { 
          width: diagramWidth, 
          position: 'left',
          startX: margin
        });
        if (diagramInfo) {
          diagramEndY = diagramInfo.startY + diagramInfo.height;
          textStartY = diagramInfo.startY; // Text starts at same Y as diagram
        }
      }
      
      // Now draw text content on the right, starting at textStartY
      doc.x = textColumnX;
      doc.y = textStartY;
      
      // Organisation section
      let organizationText = "";
      const org = drill.organization || drill.json?.organization;
      
      if (typeof org === "string") {
        organizationText = org;
      } else if (typeof org === "object" && org !== null) {
        const parts: string[] = [];
        if (Array.isArray(org.setupSteps) && org.setupSteps.length > 0) {
          parts.push(...org.setupSteps);
        }
        if (org.area) {
          const areaParts: string[] = [];
          if (org.area.lengthYards && org.area.widthYards) {
            areaParts.push(`${org.area.lengthYards} x ${org.area.widthYards} yards`);
          }
          if (org.area.notes) areaParts.push(org.area.notes);
          if (areaParts.length > 0) parts.push(`Area: ${areaParts.join(", ")}`);
        }
        if (org.rotation) parts.push(`Rotation: ${org.rotation}`);
        if (org.restarts) parts.push(`Restarts: ${org.restarts}`);
        if (org.scoring) parts.push(`Scoring: ${org.scoring}`);
        organizationText = parts.join(". ") + (parts.length > 0 ? "." : "");
      }
      
      if (!organizationText && drill.description) {
        organizationText = drill.description;
      }
      
      if (organizationText) {
        doc.fontSize(10).fillColor("black").font("Helvetica-Bold").text("Organisation", textColumnX, doc.y);
        doc.moveDown(0.2);
        doc.fontSize(9).fillColor("black").font("Helvetica").text(organizationText, textColumnX, doc.y, {
          width: textColumnWidth,
          lineGap: 1
        });
        doc.moveDown(0.4);
      }
      
      // Key Coaching Points
      const coachingPoints = drill.coachingPoints || drill.json?.coachingPoints || [];
      if (Array.isArray(coachingPoints) && coachingPoints.length > 0) {
        doc.fontSize(10).fillColor("black").font("Helvetica-Bold").text("Key Coaching Points", textColumnX, doc.y);
        doc.moveDown(0.2);
        coachingPoints.forEach((point: string, i: number) => {
          doc.fontSize(9).fillColor("black").font("Helvetica").text(`${i + 1}. ${point}`, textColumnX, doc.y, {
            width: textColumnWidth,
            lineGap: 1
          });
        });
        doc.moveDown(0.4);
      }
      
      // Progressions
      const progressions = drill.progressions || drill.json?.progressions || [];
      if (Array.isArray(progressions) && progressions.length > 0) {
        doc.fontSize(10).fillColor("black").font("Helvetica-Bold").text("Progressions", textColumnX, doc.y);
        doc.moveDown(0.2);
        progressions.forEach((progression: string, i: number) => {
          doc.fontSize(9).fillColor("black").font("Helvetica").text(`${i + 1}. ${progression}`, textColumnX, doc.y, {
            width: textColumnWidth,
            lineGap: 1
          });
        });
        doc.moveDown(0.4);
      }
      
      // Get text end Y
      const textEndY = doc.y;
      
      // Move to below whichever is taller (diagram or text)
      // Add minimal spacing - just enough to separate drills
      const sectionEndY = Math.max(diagramEndY, textEndY) + 5;
      doc.x = margin;
      doc.y = sectionEndY;
      
      // Add a thin separator line between drills (except for the last one)
      if (idx < session.drills.length - 1) {
        doc.strokeColor("#cccccc").lineWidth(0.5);
        doc.moveTo(margin, doc.y).lineTo(doc.page.width - margin, doc.y).stroke();
        doc.moveDown(0.3);
      }
    });
  }

  // Skill Focus section (if available) - placed after drills
  if (skillFocus) {
    // Check if we need a new page
    if (doc.y > doc.page.height - 250) {
      doc.addPage();
    }
    
    doc.moveDown(1);
    doc.fontSize(12).fillColor("black").text("Skill Focus", { underline: true });
    doc.moveDown(0.5);
    
    // Title
    if (skillFocus.title) {
      doc
        .fontSize(11)
        .fillColor("black")
        .font("Helvetica-Bold")
        .text(skillFocus.title, { align: "left" });
      doc.moveDown(0.3);
    }
    
    // Summary
    if (skillFocus.summary) {
      doc
        .fontSize(10)
        .fillColor("black")
        .font("Helvetica")
        .text(skillFocus.summary, { align: "left", lineGap: 2 });
      doc.moveDown(0.5);
    }
    
    // Key Skills
    if (Array.isArray(skillFocus.keySkills) && skillFocus.keySkills.length > 0) {
      doc
        .fontSize(10)
        .fillColor("black")
        .font("Helvetica-Bold")
        .text("Key Skills", { align: "left" });
      doc.moveDown(0.3);
      skillFocus.keySkills.forEach((skill: string, i: number) => {
        doc
          .fontSize(9)
          .fillColor("black")
          .font("Helvetica")
          .text(`${i + 1}. ${skill}`, {
            align: "left",
            lineGap: 1.5
          });
      });
      doc.moveDown(0.5);
    }
    
    // Coaching Points
    if (Array.isArray(skillFocus.coachingPoints) && skillFocus.coachingPoints.length > 0) {
      doc
        .fontSize(10)
        .fillColor("black")
        .font("Helvetica-Bold")
        .text("Coaching Points", { align: "left" });
      doc.moveDown(0.3);
      skillFocus.coachingPoints.forEach((point: string, i: number) => {
        doc
          .fontSize(9)
          .fillColor("black")
          .font("Helvetica")
          .text(`${i + 1}. ${point}`, {
            align: "left",
            lineGap: 1.5
          });
      });
      doc.moveDown(0.5);
    }
    
    // Psychology
    if (skillFocus.psychology) {
      const hasGood = Array.isArray(skillFocus.psychology.good) && skillFocus.psychology.good.length > 0;
      const hasBad = Array.isArray(skillFocus.psychology.bad) && skillFocus.psychology.bad.length > 0;
      
      if (hasGood || hasBad) {
        doc
          .fontSize(10)
          .fillColor("black")
          .font("Helvetica-Bold")
          .text("Psychology", { align: "left" });
        doc.moveDown(0.3);
        
        if (hasGood) {
          doc
            .fontSize(9)
            .fillColor("black")
            .font("Helvetica-Bold")
            .text("Positive Behaviors:", { align: "left" });
          doc.moveDown(0.2);
          skillFocus.psychology.good.forEach((item: string, i: number) => {
            doc
              .fontSize(9)
              .fillColor("black")
              .font("Helvetica")
              .text(`• ${item}`, {
                align: "left",
                lineGap: 1.5
              });
          });
          doc.moveDown(0.3);
        }
        
        if (hasBad) {
          doc
            .fontSize(9)
            .fillColor("black")
            .font("Helvetica-Bold")
            .text("Areas for Improvement:", { align: "left" });
          doc.moveDown(0.2);
          skillFocus.psychology.bad.forEach((item: string, i: number) => {
            doc
              .fontSize(9)
              .fillColor("black")
              .font("Helvetica")
              .text(`• ${item}`, {
                align: "left",
                lineGap: 1.5
              });
          });
          doc.moveDown(0.3);
        }
      }
    }
    
    // Section Phrases as compact cards (matching UI layout - 2-column grid, no diagrams)
    if (skillFocus.sectionPhrases && typeof skillFocus.sectionPhrases === "object") {
      doc.fontSize(10).fillColor("black").font("Helvetica-Bold").text("Section Phrases", { align: "left" });
      doc.moveDown(0.5);
      
      const margin = 50;
      const pageWidth = doc.page.width - margin * 2;
      const cardWidth = (pageWidth - 20) / 2; // 2 columns with 20pt gap
      
      // Section labels
      const sectionLabels: Record<string, string> = {
        warmup: "WARMUP",
        technical: "TECHNICAL",
        tactical: "TACTICAL",
        conditioned_game: "CONDITIONED GAME",
        cooldown: "COOLDOWN",
      };
      
      // Convert to array for 2-column layout
      const sections = Object.entries(skillFocus.sectionPhrases).filter(
        ([_, phrases]: [string, any]) => phrases && typeof phrases === "object"
      );
      
      // Process sections in pairs (2-column grid)
      for (let i = 0; i < sections.length; i += 2) {
        // Check for page break
        if (doc.y > doc.page.height - 150) {
          doc.addPage();
        }
        
        const rowStartY = doc.y;
        const leftSection = sections[i];
        const rightSection = sections[i + 1];
        
        // Calculate heights first by measuring content
        const measureCard = (sectionEntry: [string, any]): number => {
          const [section, phrases] = sectionEntry;
          let height = 20; // Section title
          if (Array.isArray(phrases.encourage) && phrases.encourage.length > 0) {
            height += 15 + phrases.encourage.length * 12;
          }
          if (Array.isArray(phrases.correct) && phrases.correct.length > 0) {
            height += 15 + phrases.correct.length * 12;
          }
          return height + 10; // padding
        };
        
        const leftHeight = measureCard(leftSection);
        const rightHeight = rightSection ? measureCard(rightSection) : 0;
        const rowHeight = Math.max(leftHeight, rightHeight);
        
        // Draw left card
        const drawCard = (sectionEntry: [string, any], cardX: number, cardY: number, height: number) => {
          const [section, phrases] = sectionEntry;
          const sectionLabel = sectionLabels[section.toLowerCase()] || section.toUpperCase().replace(/_/g, " ");
          
          // Card background
          doc.save();
          doc.fillColor("#f5f5f5").rect(cardX, cardY, cardWidth, height).fill();
          doc.strokeColor("#d0d0d0").lineWidth(0.5).rect(cardX, cardY, cardWidth, height).stroke();
          doc.restore();
          
          let textY = cardY + 8;
          
          // Section title
          doc.fontSize(9).fillColor("black").font("Helvetica-Bold");
          doc.text(sectionLabel, cardX + 10, textY, { width: cardWidth - 20 });
          textY += 14;
          
          // Encourage
          if (Array.isArray(phrases.encourage) && phrases.encourage.length > 0) {
            doc.fontSize(8).fillColor("#059669").font("Helvetica-Bold");
            doc.text("ENCOURAGE", cardX + 10, textY, { width: cardWidth - 20 });
            textY += 11;
            doc.fontSize(8).fillColor("#333333").font("Helvetica");
            phrases.encourage.forEach((phrase: string) => {
              doc.text(`• ${phrase}`, cardX + 10, textY, { width: cardWidth - 20 });
              textY += 11;
            });
            textY += 4;
          }
          
          // Correct
          if (Array.isArray(phrases.correct) && phrases.correct.length > 0) {
            doc.fontSize(8).fillColor("#dc2626").font("Helvetica-Bold");
            doc.text("CORRECT", cardX + 10, textY, { width: cardWidth - 20 });
            textY += 11;
            doc.fontSize(8).fillColor("#333333").font("Helvetica");
            phrases.correct.forEach((phrase: string) => {
              doc.text(`• ${phrase}`, cardX + 10, textY, { width: cardWidth - 20 });
              textY += 11;
            });
          }
        };
        
        // Draw left card
        drawCard(leftSection, margin, rowStartY, rowHeight);
        
        // Draw right card if exists
        if (rightSection) {
          drawCard(rightSection, margin + cardWidth + 20, rowStartY, rowHeight);
        }
        
        // Move to next row
        doc.y = rowStartY + rowHeight + 10;
      }
      
      doc.x = margin;
    }
    
    doc.moveDown();
  }

  doc.end();

  return await new Promise((resolve) => {
    doc.on("end", () => {
      resolve(Buffer.concat(chunks));
    });
  });
}

export async function generateDrillPdf(drill: any): Promise<Buffer> {
  console.log("[PDF] Generating PDF for drill:", {
    title: drill.title,
    hasDiagram: !!(drill.diagram || drill.diagramV1 || drill.json?.diagram || drill.json?.diagramV1),
    drillKeys: Object.keys(drill || {}),
  });
  
  const doc = new PDFDocument({ size: "A4", margin: 50 });
  const chunks: Buffer[] = [];

  doc.on("data", (chunk) => chunks.push(chunk));

  return new Promise((resolve, reject) => {
    doc.on("error", reject);

    // Title
    doc.fontSize(20).fillColor("black").text(drill.title || drill.json?.title || "Training Drill", {
      align: "left",
    });
    doc.moveDown(0.5);
    
    // Metadata
    const meta = drill.json || drill;
    const gameModel = drill.gameModelId || meta.gameModelId || "";
    const ageGroup = drill.ageGroup || meta.ageGroup || "";
    const phase = drill.phase || meta.phase || "";
    const zone = drill.zone || meta.zone || "";
    
    doc
      .fontSize(10)
      .fillColor("gray")
      .text(
        `${gameModel}${ageGroup ? " • " + ageGroup : ""}${phase ? " • " + phase : ""}${zone ? " • " + zone : ""}`,
        { align: "left" }
      );
    doc.moveDown();

    // Description
    if (meta.description) {
      doc.fontSize(12).fillColor("black").font("Helvetica-Bold").text("Description", { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(10).fillColor("black").font("Helvetica").text(meta.description, { align: "left" });
      doc.moveDown();
    }

    // Diagram
    const rawDiagram = drill.diagram || drill.diagramV1 || meta.diagram || meta.diagramV1;
    if (rawDiagram) {
      // Check if we need a new page for diagram
      if (doc.y > doc.page.height - 250) {
        doc.addPage();
      }
      
      doc.fontSize(12).fillColor("black").font("Helvetica-Bold").text("Diagram", { underline: true });
      doc.moveDown(0.5);
      
      const diagramInfo = drawDiagram(doc, rawDiagram, { 
        width: 200, 
        position: 'center',
      });
      
      if (diagramInfo) {
        doc.moveDown(1);
      }
    }

    // Organisation
    let organizationText = "";
    const org = meta.organization;
    
    if (typeof org === "string") {
      organizationText = org;
    } else if (typeof org === "object" && org !== null) {
      const parts: string[] = [];
      if (Array.isArray(org.setupSteps) && org.setupSteps.length > 0) {
        parts.push(...org.setupSteps);
      }
      if (org.area) {
        const areaParts: string[] = [];
        if (org.area.lengthYards && org.area.widthYards) {
          areaParts.push(`${org.area.lengthYards} x ${org.area.widthYards} yards`);
        }
        if (org.area.notes) areaParts.push(org.area.notes);
        if (areaParts.length > 0) parts.push(`Area: ${areaParts.join(", ")}`);
      }
      if (org.rotation) parts.push(`Rotation: ${org.rotation}`);
      if (org.restarts) parts.push(`Restarts: ${org.restarts}`);
      if (org.scoring) parts.push(`Scoring: ${org.scoring}`);
      organizationText = parts.join(". ") + (parts.length > 0 ? "." : "");
    }
    
    if (organizationText) {
      if (doc.y > doc.page.height - 150) {
        doc.addPage();
      }
      doc.fontSize(12).fillColor("black").font("Helvetica-Bold").text("Organisation", { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(10).fillColor("black").font("Helvetica").text(organizationText, {
        align: "left",
        lineGap: 2
      });
      doc.moveDown();
    }

    // Coaching Points
    const coachingPoints = meta.coachingPoints || [];
    if (Array.isArray(coachingPoints) && coachingPoints.length > 0) {
      if (doc.y > doc.page.height - 100) {
        doc.addPage();
      }
      doc.fontSize(12).fillColor("black").font("Helvetica-Bold").text("Key Coaching Points", { underline: true });
      doc.moveDown(0.5);
      coachingPoints.forEach((point: string, i: number) => {
        doc.fontSize(10).fillColor("black").font("Helvetica").text(`${i + 1}. ${point}`, {
          align: "left",
          lineGap: 2
        });
      });
      doc.moveDown();
    }

    // Progressions
    const progressions = meta.progressions || [];
    if (Array.isArray(progressions) && progressions.length > 0) {
      if (doc.y > doc.page.height - 100) {
        doc.addPage();
      }
      doc.fontSize(12).fillColor("black").font("Helvetica-Bold").text("Progressions", { underline: true });
      doc.moveDown(0.5);
      progressions.forEach((progression: string, i: number) => {
        doc.fontSize(10).fillColor("black").font("Helvetica").text(`${i + 1}. ${progression}`, {
          align: "left",
          lineGap: 2
        });
      });
    }

    doc.end();

    doc.on("end", () => {
      resolve(Buffer.concat(chunks));
    });
  });
}

export async function generatePlayerPlanPdf(plan: any): Promise<Buffer> {
  console.log("[PDF] Generating PDF for player plan:", {
    title: plan.title,
    drillsCount: plan.json?.drills?.length,
  });
  
  const doc = new PDFDocument({ size: "A4", margin: 50 });
  const chunks: Buffer[] = [];

  doc.on("data", (chunk) => chunks.push(chunk));

  return new Promise((resolve, reject) => {
    doc.on("error", reject);

    // Title
    doc.fontSize(20).fillColor("black").text(plan.title || "Player Training Plan", {
      align: "left",
    });
    doc.moveDown(0.5);
    
    // Metadata
    const metadata: string[] = [];
    if (plan.ageGroup) metadata.push(plan.ageGroup);
    if (plan.playerLevel) metadata.push(plan.playerLevel);
    if (plan.durationMin) metadata.push(`${plan.durationMin} min`);
    if (plan.refCode) metadata.push(plan.refCode);
    
    if (metadata.length > 0) {
      doc
        .fontSize(10)
        .fillColor("gray")
        .text(metadata.join(" • "), { align: "left" });
      doc.moveDown();
    }

    // Objectives
    if (plan.objectives) {
      doc.fontSize(12).fillColor("black").font("Helvetica-Bold").text("Objectives", { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(10).fillColor("black").font("Helvetica").text(plan.objectives, { align: "left" });
      doc.moveDown();
    }

    // Equipment
    if (plan.equipment && Array.isArray(plan.equipment) && plan.equipment.length > 0) {
      doc.fontSize(12).fillColor("black").font("Helvetica-Bold").text("Equipment Needed", { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(10).fillColor("black").font("Helvetica").text(plan.equipment.join(", "), { align: "left" });
      doc.moveDown();
    }

    // Exercises
    const drills = plan.json?.drills || [];
    if (drills.length > 0) {
      doc.fontSize(12).fillColor("black").font("Helvetica-Bold").text("Exercises", { underline: true });
      doc.moveDown(0.5);
      
      drills.forEach((drill: any, idx: number) => {
        // Check if we need a new page
        if (doc.y > doc.page.height - 200) {
          doc.addPage();
        }

        // Drill title and type
        const drillType = drill.drillType || "TECHNICAL";
        doc.fontSize(11).fillColor("black").font("Helvetica-Bold").text(`${idx + 1}. ${drill.title || `Exercise ${idx + 1}`}`, {
          align: "left",
        });
        doc.fontSize(9).fillColor("gray").text(`Type: ${drillType}`, { align: "left" });
        if (drill.durationMin) {
          doc.fontSize(9).fillColor("gray").text(`Duration: ${drill.durationMin} min`, { align: "left" });
        }
        doc.moveDown(0.3);

        // Description
        if (drill.description) {
          doc.fontSize(10).fillColor("black").font("Helvetica").text(drill.description, {
            align: "left",
            lineGap: 2,
          });
          doc.moveDown(0.3);
        }

        // Setup Steps
        if (drill.organization?.setupSteps && Array.isArray(drill.organization.setupSteps)) {
          doc.fontSize(10).fillColor("black").font("Helvetica-Bold").text("Setup & Instructions:", { align: "left" });
          drill.organization.setupSteps.forEach((step: string, i: number) => {
            doc.fontSize(9).fillColor("black").font("Helvetica").text(`${i + 1}. ${step}`, {
              align: "left",
              indent: 10,
              lineGap: 1,
            });
          });
          doc.moveDown(0.3);
        }

        // Area & Equipment
        const areaInfo: string[] = [];
        if (drill.organization?.area) {
          if (drill.organization.area.lengthYards && drill.organization.area.widthYards) {
            areaInfo.push(`Area: ${drill.organization.area.lengthYards} x ${drill.organization.area.widthYards} yards`);
          }
          if (drill.organization.area.notes) {
            areaInfo.push(drill.organization.area.notes);
          }
        }
        if (drill.organization?.equipment && Array.isArray(drill.organization.equipment) && drill.organization.equipment.length > 0) {
          areaInfo.push(`Equipment: ${drill.organization.equipment.join(", ")}`);
        }
        if (areaInfo.length > 0) {
          doc.fontSize(9).fillColor("gray").text(areaInfo.join(" • "), { align: "left" });
          doc.moveDown(0.3);
        }

        // Reps & Rest
        if (drill.organization?.reps || drill.organization?.rest) {
          const repsInfo: string[] = [];
          if (drill.organization.reps) repsInfo.push(`Reps: ${drill.organization.reps}`);
          if (drill.organization.rest) repsInfo.push(`Rest: ${drill.organization.rest}`);
          if (repsInfo.length > 0) {
            doc.fontSize(9).fillColor("black").font("Helvetica-Bold").text(repsInfo.join(" • "), { align: "left" });
            doc.moveDown(0.3);
          }
        }

        // Coaching Points
        if (drill.coachingPoints && Array.isArray(drill.coachingPoints) && drill.coachingPoints.length > 0) {
          doc.fontSize(10).fillColor("black").font("Helvetica-Bold").text("Self-Coaching Points:", { align: "left" });
          drill.coachingPoints.forEach((point: string) => {
            doc.fontSize(9).fillColor("black").font("Helvetica").text(`• ${point}`, {
              align: "left",
              indent: 10,
              lineGap: 1,
            });
          });
          doc.moveDown(0.3);
        }

        // Progressions
        if (drill.progressions && Array.isArray(drill.progressions) && drill.progressions.length > 0) {
          doc.fontSize(10).fillColor("black").font("Helvetica-Bold").text("Progressions:", { align: "left" });
          drill.progressions.forEach((prog: string, i: number) => {
            doc.fontSize(9).fillColor("black").font("Helvetica").text(`${i + 1}. ${prog}`, {
              align: "left",
              indent: 10,
              lineGap: 1,
            });
          });
        }

        doc.moveDown(0.8);
      });
    }

    doc.end();

    doc.on("end", () => {
      resolve(Buffer.concat(chunks));
    });
  });
}

/**
 * Generate a PDF for a weekly summary (parent communication)
 */
export async function generateWeeklySummaryPdf(summary: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "LETTER" });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("error", reject);

    const { weekStart, weekEnd, events, totalSessions, totalMinutes, ageGroups, gameModels } = summary;

    const formatDate = (date: Date) => {
      return date.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      });
    };

    const formatTime = (date: Date) => {
      return date.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    };

    // Header
    doc.fontSize(20).fillColor("black").font("Helvetica-Bold").text("Weekly Training Schedule", { align: "center" });
    doc.moveDown(0.5);
    doc.fontSize(14).fillColor("gray").font("Helvetica").text(`Week of ${formatDate(weekStart)} - ${formatDate(weekEnd)}`, { align: "center" });
    doc.moveDown(1);

    // Summary Statistics
    doc.fontSize(12).fillColor("black").font("Helvetica-Bold").text("Summary", { align: "left" });
    doc.moveDown(0.3);
    doc.fontSize(10).fillColor("black").font("Helvetica").text(`Total Sessions: ${totalSessions}`, { align: "left" });
    doc.moveDown(0.2);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    doc.fontSize(10).fillColor("black").font("Helvetica").text(`Total Training Time: ${hours} hours ${minutes} minutes`, { align: "left" });
    
    if (ageGroups.length > 0) {
      doc.moveDown(0.2);
      doc.fontSize(10).fillColor("black").font("Helvetica").text(`Age Groups: ${ageGroups.join(", ")}`, { align: "left" });
    }
    
    if (gameModels.length > 0) {
      const gameModelLabels: Record<string, string> = {
        POSSESSION: "Possession",
        PRESSING: "Pressing",
        TRANSITION: "Transition",
        COACHAI: "Balanced",
      };
      doc.moveDown(0.2);
      doc.fontSize(10).fillColor("black").font("Helvetica").text(`Focus Areas: ${gameModels.map((gm: string) => gameModelLabels[gm] || gm).join(", ")}`, { align: "left" });
    }

    doc.moveDown(1);

    // Group events by date
    const eventsByDate: Record<string, any[]> = {};
    events.forEach((event: any) => {
      const dateKey = new Date(event.scheduledDate).toISOString().split("T")[0];
      if (!eventsByDate[dateKey]) {
        eventsByDate[dateKey] = [];
      }
      eventsByDate[dateKey].push(event);
    });

    // Format each day
    Object.keys(eventsByDate)
      .sort()
      .forEach((dateKey) => {
        const dayEvents = eventsByDate[dateKey];
        const date = new Date(dateKey);

        // Check if we need a new page
        if (doc.y > 700) {
          doc.addPage();
        }

        // Day header
        doc.fontSize(14).fillColor("black").font("Helvetica-Bold").text(formatDate(date), { align: "left" });
        doc.moveDown(0.3);
        doc.moveTo(50, doc.y).lineTo(562, doc.y).strokeColor("gray").lineWidth(0.5).stroke();
        doc.moveDown(0.5);

        dayEvents.forEach((event) => {
          // Check if we need a new page
          if (doc.y > 700) {
            doc.addPage();
          }

          // Session title
          doc.fontSize(11).fillColor("black").font("Helvetica-Bold").text(event.session?.title || "Untitled Session", { align: "left" });
          doc.moveDown(0.2);

          // Time and duration
          doc.fontSize(9).fillColor("black").font("Helvetica").text(`Time: ${formatTime(new Date(event.scheduledDate))}`, { align: "left" });
          doc.moveDown(0.1);
          doc.fontSize(9).fillColor("black").font("Helvetica").text(`Duration: ${event.durationMin} minutes`, { align: "left" });

          // Optional fields
          if (event.location) {
            doc.moveDown(0.1);
            doc.fontSize(9).fillColor("black").font("Helvetica").text(`Location: ${event.location}`, { align: "left" });
          }
          if (event.teamName) {
            doc.moveDown(0.1);
            doc.fontSize(9).fillColor("black").font("Helvetica").text(`Team: ${event.teamName}`, { align: "left" });
          }
          if (event.session?.ageGroup) {
            doc.moveDown(0.1);
            doc.fontSize(9).fillColor("black").font("Helvetica").text(`Age Group: ${event.session.ageGroup}`, { align: "left" });
          }
          if (event.notes) {
            doc.moveDown(0.1);
            doc.fontSize(9).fillColor("gray").font("Helvetica").text(`Notes: ${event.notes}`, { align: "left" });
          }
          if (event.sessionRefCode) {
            doc.moveDown(0.1);
            doc.fontSize(8).fillColor("gray").font("Helvetica").text(`Reference: ${event.sessionRefCode}`, { align: "left" });
          }

          doc.moveDown(0.5);
        });

        doc.moveDown(0.5);
      });

    doc.end();

    doc.on("end", () => {
      resolve(Buffer.concat(chunks));
    });
  });
}
