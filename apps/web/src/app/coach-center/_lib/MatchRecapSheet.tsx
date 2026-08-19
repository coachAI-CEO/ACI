import {
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Heart,
  MapPin,
  Shield,
  Star,
  Target,
  Trophy,
  Users,
} from "lucide-react";
import type { MatchRecap, StatKey } from "./match-recap";
import { STAT_ROWS, barWidth, clubInitials, formatRecapDate } from "./match-recap";

const SHORT_STAT: Record<StatKey, string> = {
  shots: "Shots",
  attempts: "Attempts",
  corners: "Corners",
  freeKicks: "Free Kicks",
  throwIns: "Throw-ins",
  fouls: "Fouls",
  penalties: "Penalties",
  passesCompleted: "Passes",
  possessionPct: "Poss %",
  possessionMinutes: "Poss min",
  possessionWon: "Poss won",
};
const PILLAR_ICONS = [Target, Shield, Users, Star];
const MEANING_ICONS = [BarChart3, Users, Star, Heart];

type Props = {
  recap: MatchRecap;
  clubName: string;
  teamName: string;
  ageGroup?: string | null;
  competition?: string | null;
  matchDate?: string | null;
};

function Crest({ clubName }: { clubName: string }) {
  return (
    <div
      className="flex h-[4.25rem] w-[3.35rem] shrink-0 flex-col items-center justify-center bg-gradient-to-b from-[#0b4a7a] to-[#001529] text-center shadow-[0_8px_20px_rgba(0,0,0,0.35)]"
      style={{ clipPath: "polygon(50% 0, 100% 16%, 92% 78%, 50% 100%, 8% 78%, 0 16%)" }}
    >
      <span className="text-[15px] font-black tracking-tight text-white">{clubInitials(clubName)}</span>
      <span className="mt-0.5 text-[7px] font-semibold uppercase tracking-[0.18em] text-[#9ec5e8]">FC</span>
    </div>
  );
}

function DualBar({ us, them, statKey }: { us: number; them: number; statKey: StatKey }) {
  const width = barWidth(us, them, statKey);
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_7.5rem_minmax(0,1fr)] items-center gap-2">
      <div className="flex items-center justify-end gap-2">
        <span className="w-8 text-right text-[11px] font-bold tabular-nums text-[#002147]">{us}</span>
        <div className="h-2 w-full max-w-[9rem] overflow-hidden rounded-sm bg-[#d7e3ee]">
          <div className="ml-auto h-full rounded-sm bg-[#1d4e89]" style={{ width: `${width.us}%` }} />
        </div>
      </div>
      <div className="flex h-7 items-center justify-center rounded-sm bg-[#002147] px-1 text-center">
        <span className="text-[8px] font-bold uppercase tracking-[0.12em] text-[#c5d8ea]">
          {SHORT_STAT[statKey]}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <div className="h-2 w-full max-w-[9rem] overflow-hidden rounded-sm bg-[#f0d9d4]">
          <div className="h-full rounded-sm bg-[#c45c4a]" style={{ width: `${width.them}%` }} />
        </div>
        <span className="w-8 text-left text-[11px] font-bold tabular-nums text-[#9a3b2f]">{them}</span>
      </div>
    </div>
  );
}

export function MatchRecapSheet({ recap, clubName, teamName, ageGroup, competition, matchDate }: Props) {
  const club = clubName || "Club";
  const subtitle = [ageGroup, teamName.replace(new RegExp(`^${club}\\s*`, "i"), "")]
    .filter(Boolean)
    .join(" · ")
    .replace(/^·\s*/, "");

  return (
    <article className="overflow-hidden rounded-md bg-[#eef2f6] text-[#0b1c2c] shadow-[0_24px_60px_rgba(0,0,0,0.35)] ring-1 ring-black/10">
      <header className="relative bg-[#002147] px-5 pb-8 pt-4 text-white">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <Crest clubName={club} />
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#8fb7d9]">Match Recap</p>
              <h2 className="truncate text-xl font-black uppercase leading-tight tracking-wide text-[#9ec5e8] sm:text-2xl">
                {club}
              </h2>
              <p className="truncate text-[11px] font-semibold uppercase tracking-[0.16em] text-white/80">
                {subtitle || teamName}
              </p>
            </div>
          </div>
          <div className="shrink-0 rounded-sm border border-white/25 bg-[#001529] px-3 py-2 text-center">
            <p className="text-[22px] font-black leading-none tracking-tight">
              {recap.usScore} – {recap.themScore}
            </p>
            <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.28em] text-[#8fb7d9]">Final</p>
          </div>
        </div>

        <div className="relative mt-4 text-center">
          <h1 className="text-3xl font-black uppercase tracking-[0.18em] sm:text-4xl">Match Recap</h1>
          <div className="mx-auto mt-1 h-2 w-48 -skew-x-[24deg] bg-[#0a3a6b]" />
        </div>

        <div
          className="absolute inset-x-6 -bottom-4 overflow-hidden bg-[#001529] px-4 py-2 text-center shadow-lg"
          style={{ clipPath: "polygon(10px 0, 100% 0, calc(100% - 10px) 100%, 0 100%)" }}
        >
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-white">
            {competition || "Match day"}
          </p>
          {recap.caption ? (
            <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8fb7d9]">
              {recap.caption}
            </p>
          ) : null}
        </div>
      </header>

      <section className="grid gap-5 px-5 pb-4 pt-8 md:grid-cols-[1.05fr_1.35fr]">
        <div>
          <h3 className="text-lg font-black uppercase tracking-wide text-[#002147]">{recap.headline}</h3>
          <p className="mt-2 text-[13px] leading-relaxed text-slate-600">{recap.summary}</p>
          <ul className="mt-4 space-y-2 text-[12px] text-slate-600">
            <li className="flex items-start gap-2">
              <Trophy className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#1d4e89]" />
              <span>{competition || "Competition TBD"}</span>
            </li>
            <li className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#1d4e89]" />
              <span>{recap.location || "Location TBD"}</span>
            </li>
            <li className="flex items-start gap-2">
              <CalendarDays className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#1d4e89]" />
              <span>{formatRecapDate(matchDate || "") || "Date TBD"}</span>
            </li>
          </ul>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {recap.pillars.map((pillar, i) => {
            const Icon = PILLAR_ICONS[i] || Target;
            return (
              <div key={pillar.title} className="text-center">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-[#002147] text-white">
                  <Icon className="h-4 w-4" />
                </div>
                <p className="mt-2 text-[11px] font-black uppercase leading-tight tracking-wide text-[#002147]">
                  {pillar.title}
                </p>
                <p className="mt-1 text-[11px] leading-snug text-slate-500">{pillar.body}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="bg-white px-5 py-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#1d4e89]">{club}</p>
          <div className="relative px-4">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-[#002147]">Match Stats</p>
            <div className="absolute inset-x-2 -bottom-1 h-1.5 -skew-x-[18deg] bg-[#002147]/80" />
          </div>
          <p className="text-right text-[11px] font-black uppercase tracking-[0.2em] text-[#c45c4a]">
            {recap.opponentLabel || "Opponent"}
          </p>
        </div>
        <div className="space-y-1.5">
          {STAT_ROWS.map((row) => (
            <DualBar key={row.key} us={recap.stats[row.key].us} them={recap.stats[row.key].them} statKey={row.key} />
          ))}
        </div>
      </section>

      <section className="grid gap-4 px-5 py-5 md:grid-cols-3">
        <div>
          <h4 className="text-sm font-black uppercase tracking-wide text-[#002147]">Key Takeaways</h4>
          <ul className="mt-3 space-y-2.5">
            {recap.takeaways.map((item) => (
              <li key={item.title} className="flex gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#1d4e89]" />
                <div>
                  <p className="text-[12px] font-bold text-[#002147]">{item.title}</p>
                  <p className="text-[11px] leading-snug text-slate-500">{item.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className="text-center">
          <CalendarDays className="mx-auto h-5 w-5 text-[#1d4e89]" />
          <h4 className="mt-1 text-sm font-black uppercase tracking-wide text-[#002147]">Next Up</h4>
          <ul className="mt-2 space-y-1 text-[12px] text-slate-600">
            {recap.nextUp.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <Trophy className="mx-auto mt-4 h-5 w-5 text-[#1d4e89]" />
          <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.16em] text-[#002147]">{recap.proudOf}</p>
          <p className="mt-2 font-serif text-xl italic text-[#1d4e89]">{recap.keepBuilding}</p>
        </div>
        <div>
          <h4 className="text-sm font-black uppercase tracking-wide text-[#002147]">What This Means</h4>
          <ul className="mt-3 space-y-2.5">
            {recap.meaning.map((item, i) => {
              const Icon = MEANING_ICONS[i] || Star;
              return (
                <li key={item.title} className="flex gap-2">
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[#1d4e89]" />
                  <div>
                    <p className="text-[12px] font-bold text-[#002147]">{item.title}</p>
                    <p className="text-[11px] leading-snug text-slate-500">{item.body}</p>
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="mt-3 flex items-start gap-2 rounded-md border border-[#1d4e89]/30 bg-[#e8f1f8] px-2.5 py-2">
            <Heart className="mt-0.5 h-4 w-4 shrink-0 text-[#1d4e89]" />
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#002147]">{recap.thankYou}</p>
          </div>
        </div>
      </section>

      <footer className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-[#002147] px-4 py-2.5 text-[9px] font-bold uppercase tracking-[0.16em] text-[#9ec5e8]">
        {recap.mottos.map((motto, i) => (
          <span key={motto} className="flex items-center gap-3">
            {i > 0 ? <span className="hidden h-3 w-px bg-white/25 sm:block" /> : null}
            {motto}
          </span>
        ))}
      </footer>
    </article>
  );
}
