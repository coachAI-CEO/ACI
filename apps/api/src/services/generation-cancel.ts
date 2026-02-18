const cancelledGenerations = new Map<string, number>();
const TTL_MS = 15 * 60 * 1000;

function cleanupExpired(now: number) {
  for (const [id, ts] of cancelledGenerations.entries()) {
    if (now - ts > TTL_MS) {
      cancelledGenerations.delete(id);
    }
  }
}

export function markGenerationCancelled(generationId: string) {
  const id = String(generationId || "").trim();
  if (!id) return;
  const now = Date.now();
  cleanupExpired(now);
  cancelledGenerations.set(id, now);
}

export function isGenerationCancelled(generationId?: string): boolean {
  const id = String(generationId || "").trim();
  if (!id) return false;
  const now = Date.now();
  cleanupExpired(now);
  return cancelledGenerations.has(id);
}

export function clearGenerationCancelled(generationId?: string) {
  const id = String(generationId || "").trim();
  if (!id) return;
  cancelledGenerations.delete(id);
}
