"use client";

import type { ReactNode } from "react";
import type { DiagramV1 } from "@/types/diagram";
import {
  bandsThatHaveShape,
  curriculumForAssignedAge,
  inferAttShape,
  languageForLicense,
  type LicenseCurriculum,
  type PlayOutShape,
  type ShapeCurriculum,
} from "@/lib/board-play-out-curriculum";
import {
  ageExpectForShape,
  developmentForAge,
  gameModelMomentForTopic,
  gameModelStyle,
  gameModelTitleForTopic,
  howModelUsesTopic,
  shapeProfile,
  type AgeDevelopment,
  type GameModelStyle,
  type ShapeProfile,
} from "@/lib/board-principles-library";
import {
  classifyBoardAsk,
  isThinBoardAsk,
  passingPathFromAsk,
  topicAgeBlock,
  topicAgeNote,
  topicLabel,
  topicLessonForShape,
  type PrincipleTopic,
  type TopicAgeBlock,
  type TopicLesson,
} from "@/lib/board-principle-topics";
import {
  EMPHASIS_AGE_BANDS,
  ageExpectationForEmphasis,
  emphasisLabel,
  hasEmphasis,
  resolveEmphasis,
  topicFromEmphasis,
  type BoardEmphasis,
} from "@/lib/board-emphasis";

type Props = {
  coachLevel?: string | null;
  ageGroup?: string | null;
  gameModelId?: string | null;
  attFormation?: string | null;
  lastAsk?: string | null;
  emphasis?: BoardEmphasis | null;
  diagram?: DiagramV1 | null;
  onUsePrompt: (prompt: string) => void;
};

function Section({
  kicker,
  title,
  children,
}: {
  kicker: string;
  title?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-400/90">{kicker}</p>
      {title ? <p className="mt-1 text-[13px] font-semibold text-white/90">{title}</p> : null}
      <div className={title ? "mt-2 space-y-2" : "mt-1.5 space-y-2"}>{children}</div>
    </section>
  );
}

function P({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <p className={`text-[12px] leading-relaxed text-slate-300 ${className}`}>{children}</p>;
}

function BulletList({ items, tone = "slate" }: { items: string[]; tone?: "slate" | "go" | "stop" }) {
  const mark = tone === "go" ? "text-emerald-400/80" : tone === "stop" ? "text-rose-300/70" : "text-slate-500";
  return (
    <ul className="space-y-1">
      {items.map((item) => (
        <li key={item} className="text-[12px] leading-relaxed text-slate-400">
          <span className={`mr-1.5 ${mark}`}>·</span>
          {item}
        </li>
      ))}
    </ul>
  );
}

function AgeDevelopmentBlock({ dev, sessionRule }: { dev: AgeDevelopment; sessionRule?: string }) {
  return (
    <>
      <P>
        <span className="text-slate-200">{dev.format}.</span> {dev.body}
      </P>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-400/80">They can</p>
          <div className="mt-1">
            <BulletList items={dev.canDo} tone="go" />
          </div>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-rose-300/70">Not yet</p>
          <div className="mt-1">
            <BulletList items={dev.notYet} tone="stop" />
          </div>
        </div>
      </div>
      {sessionRule ? <p className="text-[11px] leading-relaxed text-slate-500">{sessionRule}</p> : null}
    </>
  );
}

function TopicAgeBlockView({ block }: { block: TopicAgeBlock }) {
  return (
    <>
      <p className="text-[12px] font-medium text-slate-100">{block.headline}</p>
      <P>{block.body}</P>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-400/80">They can</p>
          <div className="mt-1">
            <BulletList items={block.canDo} tone="go" />
          </div>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-rose-300/70">Not yet</p>
          <div className="mt-1">
            <BulletList items={block.notYet} tone="stop" />
          </div>
        </div>
      </div>
    </>
  );
}

function HistoryBlock({
  profile,
  showDeep,
  topic,
}: {
  profile: ShapeProfile;
  showDeep: boolean;
  topic: PrincipleTopic;
}) {
  const combo = topic === "attacking_combo";
  return (
    <Section kicker="History" title={profile.lineage}>
      <P>{profile.history}</P>
      {showDeep && !combo ? <P className="text-slate-400">{profile.historyDeep}</P> : null}
      <P className="text-slate-200">{profile.idea}</P>
    </Section>
  );
}

function StylesBlock({ profile, topic }: { profile: ShapeProfile; topic: PrincipleTopic }) {
  const combo = topic === "attacking_combo";
  const styles = combo
    ? profile.styles.filter((style) => !/press|rest|loss|defend/i.test(style.title))
    : profile.styles;
  return (
    <Section kicker="Styles" title={combo ? "How this combination plays" : "How this shape plays"}>
      <P>
        <span className="text-slate-200">In possession. </span>
        {profile.inPossession}
      </P>
      {combo ? null : (
        <P>
          <span className="text-slate-200">Out of possession. </span>
          {profile.outOfPossession}
        </P>
      )}
      {styles.map((style) => (
        <div key={style.title} className="rounded-lg border border-white/5 bg-black/20 px-2.5 py-2">
          <p className="text-[12px] font-medium text-slate-100">{style.title}</p>
          <p className="mt-1 text-[12px] leading-relaxed text-slate-400">{style.body}</p>
        </div>
      ))}
    </Section>
  );
}

function ClubStyleBlock({
  model,
  shape,
  topic,
  modelOnTopic,
}: {
  model: GameModelStyle;
  shape: PlayOutShape | null;
  topic: PrincipleTopic;
  modelOnTopic: string | null;
}) {
  const moment = gameModelMomentForTopic(topic);
  return (
    <Section kicker={`${model.label} style`} title={gameModelTitleForTopic(model, topic)}>
      {moment === "all" || moment === "attacking" ? (
        <P>
          <span className="text-slate-200">When we have it. </span>
          {model.attacking}
        </P>
      ) : null}
      {moment === "all" || moment === "loss" ? (
        <P>
          <span className="text-slate-200">When we lose it. </span>
          {model.loss}
        </P>
      ) : null}
      {moment === "all" || moment === "defending" ? (
        <P>
          <span className="text-slate-200">When they have it. </span>
          {model.defending}
        </P>
      ) : null}
      {moment === "all" || moment === "regain" ? (
        <P>
          <span className="text-slate-200">When we win it. </span>
          {model.regain}
        </P>
      ) : null}
      {modelOnTopic ? (
        <p className="rounded-lg border border-sky-500/20 bg-sky-500/10 px-2.5 py-2 text-[12px] leading-relaxed text-sky-100/90">
          {modelOnTopic}
        </p>
      ) : (
        <p className="text-[11px] leading-relaxed text-slate-500">
          Place an attacking shape to see how this club style sits on those shirts — I will not assume a
          4-3-3 or 4-2-3-1.
        </p>
      )}
    </Section>
  );
}

function ShapeCard({
  shape,
  bandLabel,
  block,
  ageExpect,
  onUsePrompt,
}: {
  shape: PlayOutShape;
  bandLabel?: string;
  block: ShapeCurriculum;
  ageExpect?: string | null;
  onUsePrompt: (prompt: string) => void;
}) {
  return (
    <section className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
      <p className="text-[13px] font-semibold text-white/90">
        Play out this week · {shape}
        {bandLabel ? <span className="font-normal text-slate-500"> · {bandLabel}</span> : null}
      </p>
      {ageExpect ? (
        <p className="mt-1.5 text-[12px] leading-relaxed text-amber-100/85">{ageExpect}</p>
      ) : null}
      <p className="mt-1.5 text-[12px] leading-relaxed text-slate-300">{block.picture}</p>
      <ul className="mt-2 space-y-1">
        {block.jobs.map((job) => (
          <li key={job} className="text-[12px] leading-relaxed text-slate-400">
            <span className="mr-1.5 text-emerald-400/80">·</span>
            {job}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[12px] leading-relaxed text-emerald-100/80">Teach: {block.teach}</p>
      <p className="mt-1 text-[11px] leading-relaxed text-slate-500">Avoid: {block.avoid}</p>
      <button
        type="button"
        onClick={() => onUsePrompt(block.boardAsk)}
        className="mt-2.5 inline-flex items-center rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-1.5 text-[11px] font-medium text-emerald-100 hover:bg-emerald-500/25"
      >
        Use on the board
      </button>
    </section>
  );
}

export default function BoardPrinciplesPanel({
  coachLevel,
  ageGroup,
  gameModelId,
  attFormation,
  lastAsk,
  emphasis,
  diagram,
  onUsePrompt,
}: Props) {
  const assigned = curriculumForAssignedAge(ageGroup);
  const lang = languageForLicense(coachLevel);
  const showDeep = lang.license !== "USSF D";
  const model = gameModelStyle(gameModelId);
  const shape = inferAttShape({
    attFormation,
    players: diagram?.players,
  });
  const boardEmphasis = resolveEmphasis(emphasis, diagram);
  const askedTopic = classifyBoardAsk(lastAsk);
  const topic: PrincipleTopic =
    askedTopic !== "overview" ? askedTopic : topicFromEmphasis(boardEmphasis);
  const fromEmphasis = askedTopic === "overview" && hasEmphasis(boardEmphasis);
  const topicLesson = topicLessonForShape(shape, topic);
  const profile = shape ? shapeProfile(shape) : null;
  const modelOnTopic = shape ? howModelUsesTopic(gameModelId, shape, topic) : null;
  const noAge = !assigned;
  const dev = assigned ? developmentForAge(assigned.age) : null;
  const topicDev = assigned ? topicAgeBlock(assigned.age, topic) : null;
  const talkLine = topicDev?.talk || `How we talk (${lang.license}): ${lang.language}`;
  const phaseAge = ageExpectationForEmphasis({
    age: assigned?.age,
    emphasis: boardEmphasis,
    shape,
    topic,
  });
  const showPlayOut = topic === "play_out";

  const ageHeader = assigned
    ? `${assigned.age}${ageGroup && ageGroup !== assigned.age ? ` · board ${ageGroup}` : ""}`
    : "No team age on this board";

  return (
    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-3">
      {lastAsk && !isThinBoardAsk(lastAsk) ? (
        <Section kicker="This board ask" title={topic === "overview" ? "General principles" : topicLabel(topic)}>
          <p className="rounded-lg border border-white/10 bg-black/30 px-2.5 py-2 text-[12px] leading-relaxed text-slate-300">
            “{lastAsk.trim()}”
          </p>
          <P>
            Principles follow this ask, on the {shape || "live"} shirts. I will not switch formation unless you
            name one.
          </P>
        </Section>
      ) : fromEmphasis ? (
        <Section
          kicker="From the board"
          title={emphasisLabel(boardEmphasis, shape)}
        >
          <P>
            No clear chat instruction — principles follow Setup emphasis (phase / zone / channel) and this{" "}
            {shape || "attacking"} shape.
          </P>
        </Section>
      ) : (
        <p className="text-[11px] leading-relaxed text-slate-500">
          Ask on the Board tab, or set phase / zone / channel in Setup. Principles follow that emphasis and
          this attacking shape.
        </p>
      )}

      {hasEmphasis(boardEmphasis) && lastAsk && !isThinBoardAsk(lastAsk) ? (
        <p className="text-[11px] leading-relaxed text-slate-500">
          Board emphasis: {emphasisLabel(boardEmphasis, shape)}
        </p>
      ) : null}

      {shape && topicLesson ? (
        <TopicCard
          shape={shape}
          lesson={topicLesson}
          path={passingPathFromAsk(lastAsk)}
          ageExpect={topicAgeNote(assigned?.age, topic)}
          onUsePrompt={onUsePrompt}
        />
      ) : null}

      {shape && noAge && topic !== "overview" && topic !== "play_out" ? (
        <DocTopicLadder shape={shape} topic={topic} />
      ) : null}

      <Section kicker={noAge ? "DOC / unassigned age" : "Age expectation"} title={`${lang.license} · ${ageHeader}`}>
        {assigned && topicDev ? (
          <>
            <TopicAgeBlockView block={topicDev} />
            <p className="text-[11px] leading-relaxed text-slate-500">
              How we talk ({lang.license}): {topicDev.talk}
            </p>
          </>
        ) : assigned && dev ? (
          <>
            <p className="text-[12px] font-medium text-slate-100">{dev.headline}</p>
            <AgeDevelopmentBlock dev={dev} sessionRule={assigned.sessionRule} />
            <p className="text-[11px] leading-relaxed text-slate-500">{talkLine}</p>
          </>
        ) : (
          <>
            <P>
              This board has no assigned age (typical for a DOC viewing across teams). History and styles follow
              the attacking shape on the grass. Vocabulary still follows your license.
            </P>
            <p className="text-[11px] leading-relaxed text-slate-500">
              How we talk ({lang.license}): {lang.language}
            </p>
          </>
        )}
      </Section>

      {phaseAge ? (
        <Section kicker="Age in this phase / zone" title={phaseAge.title}>
          <P>{phaseAge.body}</P>
          {phaseAge.canDo.length ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-400/80">
                  They can here
                </p>
                <div className="mt-1">
                  <BulletList items={phaseAge.canDo} tone="go" />
                </div>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-rose-300/70">Not yet here</p>
                <div className="mt-1">
                  <BulletList items={phaseAge.notYet} tone="stop" />
                </div>
              </div>
            </div>
          ) : null}
        </Section>
      ) : null}

      {noAge && hasEmphasis(boardEmphasis) ? (
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            How this phase / zone changes with age
          </p>
          {EMPHASIS_AGE_BANDS.map((age) => {
            const row = ageExpectationForEmphasis({
              age,
              emphasis: boardEmphasis,
              shape,
              topic,
            });
            if (!row) return null;
            return (
              <div key={age} className="rounded-xl border border-white/5 bg-black/20 px-3 py-2">
                <p className="text-[12px] font-medium text-slate-100">{row.title}</p>
                <p className="mt-1 text-[12px] leading-relaxed text-slate-400">{row.body}</p>
              </div>
            );
          })}
        </div>
      ) : null}

      <ClubStyleBlock model={model} shape={shape} topic={topic} modelOnTopic={modelOnTopic} />

      {shape && profile ? (
        <>
          <HistoryBlock profile={profile} showDeep={showDeep} topic={topic} />
          <StylesBlock profile={profile} topic={topic} />
        </>
      ) : (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2.5">
          <p className="text-[12px] font-medium text-amber-100">No attacking shape on this board</p>
          <p className="mt-1 text-[12px] leading-relaxed text-slate-400">
            History and styles wait for a formation on the grass. Place one or name one in Board chat. I will
            stay on that shape — I will not assume a 4-3-3 or 4-2-3-1.
          </p>
        </div>
      )}

      {shape && assigned && showPlayOut ? (
        <AssignedShape band={assigned} shape={shape} onUsePrompt={onUsePrompt} />
      ) : null}

      {assigned && !shape ? (
        <P>
          {assigned.age} pictures in the curriculum:{" "}
          {Object.keys(assigned.shapes).join(" · ") || "none yet"}. Place one on the board — I will not pick a
          formation for you.
        </P>
      ) : null}

      {shape && noAge && showPlayOut ? <DocAgeLadder shape={shape} onUsePrompt={onUsePrompt} /> : null}

      {!shape && noAge ? <DocAgeOverview /> : null}

      <p className="pb-2 text-[10px] leading-relaxed text-slate-600">
        Principles follow the latest Board ask. Age comes from the team. License only sets how we talk. Shape
        comes from the live attacking shirts — never from a default 4-3-3.
      </p>
    </div>
  );
}

function TopicCard({
  shape,
  lesson,
  path,
  ageExpect,
  onUsePrompt,
}: {
  shape: PlayOutShape;
  lesson: TopicLesson;
  path?: string | null;
  ageExpect?: string | null;
  onUsePrompt: (prompt: string) => void;
}) {
  return (
    <section className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-300/90">
        {topicLabel(lesson.topic)} · {shape}
      </p>
      <p className="mt-1 text-[13px] font-semibold text-white/90">{lesson.title}</p>
      {path ? (
        <p className="mt-1 text-[13px] font-medium text-emerald-100">{path}</p>
      ) : null}
      <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{lesson.lineage}</p>
      <p className="mt-2 text-[12px] leading-relaxed text-slate-200">{lesson.idea}</p>
      {ageExpect ? (
        <p className="mt-2 text-[12px] leading-relaxed text-amber-100/90">{ageExpect}</p>
      ) : null}
      <p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Who is involved</p>
      <ul className="mt-1 space-y-1">
        {lesson.involved.map((row) => (
          <li key={row} className="text-[12px] leading-relaxed text-slate-300">
            <span className="mr-1.5 text-emerald-400/80">·</span>
            {row}
          </li>
        ))}
      </ul>
      <ul className="mt-2 space-y-1">
        {lesson.jobs.map((job) => (
          <li key={job} className="text-[12px] leading-relaxed text-slate-400">
            <span className="mr-1.5 text-sky-300/80">·</span>
            {job}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[12px] leading-relaxed text-emerald-100/80">Teach: {lesson.teach}</p>
      <p className="mt-1 text-[11px] leading-relaxed text-slate-500">Avoid: {lesson.avoid}</p>
      <button
        type="button"
        onClick={() => onUsePrompt(lesson.boardAsk)}
        className="mt-2.5 inline-flex items-center rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-1.5 text-[11px] font-medium text-emerald-100 hover:bg-emerald-500/25"
      >
        Use on the board
      </button>
    </section>
  );
}

function DocTopicLadder({ shape, topic }: { shape: PlayOutShape; topic: PrincipleTopic }) {
  const ages = ["U8–U10", "U11–U12", "U13", "U14–U15", "U16–U18"] as const;
  const notes = ages
    .map((age) => ({ age, note: topicAgeNote(age, topic) }))
    .filter((row) => row.note);
  if (!notes.length) return null;
  return (
    <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        How this {topicLabel(topic).toLowerCase()} changes with age · {shape}
      </p>
      {notes.map((row) => (
        <p key={row.age} className="text-[12px] leading-relaxed text-slate-400">
          <span className="text-slate-200">{row.age}.</span> {row.note}
        </p>
      ))}
    </div>
  );
}

function AssignedShape({
  band,
  shape,
  onUsePrompt,
}: {
  band: LicenseCurriculum;
  shape: PlayOutShape;
  onUsePrompt: (prompt: string) => void;
}) {
  const native = band.shapes[shape];
  const expect = ageExpectForShape(band.age, shape);
  if (native) {
    return (
      <ShapeCard
        shape={shape}
        block={native}
        ageExpect={expect}
        onUsePrompt={onUsePrompt}
      />
    );
  }
  const source = bandsThatHaveShape(shape)[0];
  const fallback = source?.shapes[shape];
  if (!fallback) {
    return (
      <P>
        Stay on {shape}. {band.age} curriculum does not have a play-out block for this shape yet — I will not
        switch you to another formation.
      </P>
    );
  }
  return (
    <div className="space-y-2">
      <P>
        {band.age} play-out pictures are written for {Object.keys(band.shapes).join(" · ")}. Staying on {shape}{" "}
        — this is how that shape is taught at {source.age}.
      </P>
      <ShapeCard
        shape={shape}
        bandLabel={source.age}
        block={fallback}
        ageExpect={ageExpectForShape(source.age, shape) || expect}
        onUsePrompt={onUsePrompt}
      />
    </div>
  );
}

function DocAgeLadder({
  shape,
  onUsePrompt,
}: {
  shape: PlayOutShape;
  onUsePrompt: (prompt: string) => void;
}) {
  const bands = bandsThatHaveShape(shape);
  if (!bands.length) return null;
  return (
    <div className="space-y-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        How {shape} age expectation changes
      </p>
      {bands.map((band) => {
        const block = band.shapes[shape];
        const dev = developmentForAge(band.age);
        if (!block) return null;
        return (
          <div key={band.age} className="space-y-2">
            {dev ? (
              <div className="rounded-xl border border-white/5 bg-black/20 px-3 py-2">
                <p className="text-[12px] font-medium text-slate-100">
                  {band.age} · {dev.format} · {dev.headline}
                </p>
                <p className="mt-1 text-[12px] leading-relaxed text-slate-400">{dev.body}</p>
              </div>
            ) : null}
            <ShapeCard
              shape={shape}
              bandLabel={band.age}
              block={block}
              ageExpect={ageExpectForShape(band.age, shape)}
              onUsePrompt={onUsePrompt}
            />
          </div>
        );
      })}
    </div>
  );
}

function DocAgeOverview() {
  const ages = ["U8–U10", "U11–U12", "U13", "U14–U15", "U16–U18"] as const;
  return (
    <div className="space-y-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        How age expectation changes (no shape yet)
      </p>
      {ages.map((age) => {
        const dev = developmentForAge(age);
        if (!dev) return null;
        return (
          <Section key={age} kicker={age} title={`${dev.format} · ${dev.headline}`}>
            <AgeDevelopmentBlock dev={dev} />
          </Section>
        );
      })}
    </div>
  );
}
