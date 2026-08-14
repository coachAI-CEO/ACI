/** Crop unused canvas chrome so the pitch fills the card.
 * Field is at x=117.92 on an 800-wide canvas; the right gutter is visually
 * eaten by the goal overlay, which is why diagrams look shoved right. */
export const DIAGRAM_FITTED_VIEWBOX = "85 24 630 528";

export function fitDiagramSvgViewBox(svg: string): string {
  if (!/<svg[\s>]/i.test(svg)) return svg;
  return svg.replace(/<svg\b[^>]*>/i, (openTag) => {
    if (/viewBox\s*=/.test(openTag)) {
      return openTag.replace(/viewBox\s*=\s*["'][^"']*["']/i, `viewBox="${DIAGRAM_FITTED_VIEWBOX}"`);
    }
    return openTag.replace(/<svg\b/i, `<svg viewBox="${DIAGRAM_FITTED_VIEWBOX}"`);
  });
}
