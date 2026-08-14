export type BoardCardMeta = {
  phase: string | null;
  zone: string | null;
  channel: string | null;
  attFormation: string | null;
  defFormation: string | null;
  slideCount: number;
};

type LooseDiagram = {
  players?: Array<{ team?: string; role?: string; number?: number; x: number; y: number }>;
  labels?: Array<{ text?: string }>;
  areas?: Array<{ label?: string }>;
  balls?: Array<{ x?: number; y?: number }>;
  sequence?: {
    activeFrameId?: string;
    frames?: Array<{
      id?: string;
      players?: LooseDiagram['players'];
      labels?: LooseDiagram['labels'];
      areas?: LooseDiagram['areas'];
      balls?: LooseDiagram['balls'];
    }>;
  };
};

function asDiagram(raw: unknown): LooseDiagram {
  if (!raw || typeof raw !== 'object') return {};
  return raw as LooseDiagram;
}

function activeLayers(diagram: LooseDiagram): LooseDiagram {
  const frames = diagram.sequence?.frames;
  if (!Array.isArray(frames) || !frames.length) return diagram;
  const active =
    frames.find((f) => f.id && f.id === diagram.sequence?.activeFrameId) || frames[0];
  return {
    players: active.players?.length ? active.players : diagram.players,
    labels: active.labels?.length ? active.labels : diagram.labels,
    areas: active.areas?.length ? active.areas : diagram.areas,
    balls: active.balls?.length ? active.balls : diagram.balls,
  };
}

function parseSetupText(text: string): Pick<BoardCardMeta, 'phase' | 'zone' | 'channel'> {
  const t = text.toLowerCase();

  let phase: string | null = null;
  if (/\btransition\b|press after|counterpress/.test(t)) phase = 'TRANSITION';
  else if (/\bdefending\b|red defending|out of possession/.test(t)) phase = 'DEFENDING';
  else if (/\battacking\b|blue attacking|build[-\s]?up|play(?:ing)? out/.test(t)) {
    phase = 'ATTACKING';
  }

  let zone: string | null = null;
  if (/def(?:ensive)? third|goal[-\s]?kick|build[-\s]?up/.test(t)) zone = 'DEFENSIVE_THIRD';
  else if (/att(?:acking)? third|final third/.test(t)) zone = 'ATTACKING_THIRD';
  else if (/\bmiddle\b|\bpocket\b/.test(t)) zone = 'MIDDLE_THIRD';

  let channel: string | null = null;
  if (/\bleft\b/.test(t)) channel = 'LEFT';
  else if (/\bright\b/.test(t)) channel = 'RIGHT';
  else if (/\bcenter|central\b/.test(t)) channel = 'CENTER';

  return { phase, zone, channel };
}

function inferFormationFromPlayers(
  players: Array<{ team?: string; role?: string }>,
  team: 'ATT' | 'DEF'
): string | null {
  const side = players.filter((p) => p.team === team);
  if (side.length < 8) return null;
  const roles = side.map((p) => String(p.role || '').toUpperCase());
  const count = (re: RegExp) => roles.filter((r) => re.test(r)).length;

  if (count(/^(CB|RCB|LCB)$/) >= 3 && count(/^(RWB|LWB|WB)$/) >= 1) return '3-5-2';
  if (count(/^(ST|CF)$/) >= 2 && count(/^(RM|LM)$/) >= 1) return '4-4-2';
  if (count(/^(CDM|DM)$/) >= 2 || count(/^(RAM|LAM|CAM)$/) >= 1) return '4-2-3-1';
  if (count(/^(RW|LW)$/) >= 1) return '4-3-3';
  return null;
}

/** Card fields from the last-saved diagram (captions + shirts). */
export function summarizeBoardCardMeta(raw: unknown): BoardCardMeta {
  const layers = activeLayers(asDiagram(raw));
  const players = Array.isArray(layers.players) ? layers.players : [];
  const text = [
    ...(layers.labels || []).map((l) => l.text || ''),
    ...(layers.areas || []).map((a) => a.label || ''),
  ]
    .filter(Boolean)
    .join(' · ');

  const parsed = parseSetupText(text);
  const usable = players.filter((p) => p.team === 'ATT' || p.team === 'DEF').length >= 8;

  let zone = parsed.zone;
  let channel = parsed.channel;
  if (usable) {
    const ball = layers.balls?.[0];
    if (!zone && typeof ball?.y === 'number') {
      if (ball.y >= 67) zone = 'DEFENSIVE_THIRD';
      else if (ball.y <= 33) zone = 'ATTACKING_THIRD';
      else zone = 'MIDDLE_THIRD';
    }
    if (!channel && typeof ball?.x === 'number') {
      if (ball.x >= 62) channel = 'LEFT';
      else if (ball.x <= 38) channel = 'RIGHT';
      else channel = 'CENTER';
    }
  }

  return {
    phase: parsed.phase,
    zone,
    channel,
    attFormation: inferFormationFromPlayers(players, 'ATT'),
    defFormation: inferFormationFromPlayers(players, 'DEF'),
    slideCount: Math.max(1, asDiagram(raw).sequence?.frames?.length || 1),
  };
}
