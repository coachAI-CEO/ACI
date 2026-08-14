import {
  clearMetricsContext,
  generateMultimodalText,
  setMetricsContext,
} from '../gemini';
import { getClubPhilosophy } from './club-philosophy';

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME = new Set(['application/pdf']);

export type PhilosophyImportDraft = {
  gameModelId: 'COACHAI' | 'POSSESSION' | 'PRESSING' | 'TRANSITION' | 'ROCKLIN_FC' | null;
  attackingOrganization: string;
  defensiveTransition: string;
  defensiveOrganization: string;
  attackingTransition: string;
  notes: string;
};

export async function importClubPhilosophyFromDocument(input: {
  clubId: string;
  fileName: string;
  mimeType: string;
  base64: string;
}): Promise<{ draft: PhilosophyImportDraft; clubName: string; fileName: string }> {
  const club = await getClubPhilosophy(input.clubId);
  if (!club) throw new Error('Club not found');

  const mimeType = String(input.mimeType || '').toLowerCase();
  if (!ALLOWED_MIME.has(mimeType)) {
    throw new Error('Only PDF uploads are supported right now');
  }

  const cleaned = String(input.base64 || '').replace(/^data:application\/pdf;base64,/, '');
  const approxBytes = Math.floor((cleaned.length * 3) / 4);
  if (!cleaned || approxBytes < 100) {
    throw new Error('Empty or invalid PDF');
  }
  if (approxBytes > MAX_FILE_BYTES) {
    throw new Error('PDF too large (max 5MB)');
  }

  const prompt = [
    'SYSTEM: You convert a club game-model PDF into DOC Hub philosophy DNA.',
    'Return ONLY valid JSON (no markdown fences) with this exact shape:',
    '{',
    '  "gameModelId": "COACHAI"|"POSSESSION"|"PRESSING"|"TRANSITION"|"ROCKLIN_FC"|null,',
    '  "attackingOrganization": string,',
    '  "defensiveTransition": string,',
    '  "defensiveOrganization": string,',
    '  "attackingTransition": string,',
    '  "notes": string',
    '}',
    '',
    'Mapping rules:',
    '- attackingOrganization = in possession / attacking organization',
    '- defensiveTransition = on ball loss / ATT→DEF',
    '- defensiveOrganization = out of possession / defending',
    '- attackingTransition = on regain / DEF→ATT',
    '- Prefer concrete coach language (principles + player actions).',
    '- Expand terse slide text into clear stage prose (2–6 sentences each when source has enough detail).',
    `- gameModelId MUST be exactly "${club.gameModelId}" (club-locked; do not suggest switching models).`,
    '- notes = short import summary for the DOC (what you found / gaps).',
    '',
    `Club name: ${club.clubName}`,
    `Locked game model (do not change): ${club.gameModelId}`,
    `Uploaded file: ${input.fileName}`,
  ].join('\n');

  setMetricsContext({
    operationType: 'club_philosophy_import',
    artifactId: input.clubId,
    gameModelId: club.gameModelId,
  });

  try {
    const raw = await generateMultimodalText(
      [
        { text: prompt },
        { inlineData: { mimeType: 'application/pdf', data: cleaned } },
      ],
      { timeout: 60000 }
    );
    const draft = parseImportJson(raw, club.gameModelId);
    return { draft, clubName: club.clubName, fileName: input.fileName };
  } finally {
    clearMetricsContext();
  }
}

function parseImportJson(
  raw: string,
  lockedGameModelId: string
): PhilosophyImportDraft {
  let text = String(raw || '').trim();
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) text = text.slice(start, end + 1);

  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('AI could not structure the PDF into philosophy JSON. Try again or paste text manually.');
  }

  const allowed = new Set(['COACHAI', 'POSSESSION', 'PRESSING', 'TRANSITION', 'ROCKLIN_FC']);
  // Always keep the club's locked model — import drafts DNA only.
  const gameModelId = (
    allowed.has(lockedGameModelId) ? lockedGameModelId : null
  ) as PhilosophyImportDraft['gameModelId'];

  const pick = (key: string) => String(parsed?.[key] || '').trim().slice(0, 4000);

  const draft: PhilosophyImportDraft = {
    gameModelId,
    attackingOrganization: pick('attackingOrganization'),
    defensiveTransition: pick('defensiveTransition'),
    defensiveOrganization: pick('defensiveOrganization'),
    attackingTransition: pick('attackingTransition'),
    notes: pick('notes').slice(0, 1000),
  };

  const filled = [
    draft.attackingOrganization,
    draft.defensiveTransition,
    draft.defensiveOrganization,
    draft.attackingTransition,
  ].filter(Boolean).length;

  if (filled === 0) {
    throw new Error('No usable philosophy content found in the PDF');
  }

  return draft;
}
