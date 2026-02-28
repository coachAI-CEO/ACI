# Short Video Analysis Feature Spec

## 1) Goal
Enable coaches to upload a short player or team clip and receive a strict, high-signal coaching analysis that is adapted by:
- Age group
- Player level
- Coach level

The feature then converts findings into practical training actions:
- Recommended corrective sessions
- Optional one-click generated session plans

## 2) Problem Statement
Coaches can identify that "something is off" in clips, but converting that into prioritized, age-appropriate, coach-appropriate training actions is inconsistent and slow. Current generation flows focus on requested topics, not evidence from game footage.

## 3) Primary Users
- Grassroots and academy coaches reviewing match/training clips
- Parent coaches needing structured, actionable guidance
- Club coaches who want faster analysis-to-session workflows

## 4) Success Criteria (MVP)
- User can upload a clip (10-90 seconds, up to 200MB)
- User sets `ageGroup`, `playerLevel`, `coachLevel`
- AI returns a critical breakdown with severity and coaching cues
- AI recommends 3-5 training blocks based on findings
- User can generate a full session from selected findings

## 5) Scope
### In scope (MVP)
- Video upload + processing status
- Evidence-driven analysis output
- Severity-ranked observations (Critical/Major/Minor)
- Confidence score per observation
- Session recommendation cards
- "Generate Session from Analysis" flow

### Out of scope (MVP)
- Live stream analysis
- Multi-angle sync and tracking overlays
- Player identity/biometric profiling
- Fully automated season plan generation from multiple clips

## 6) UX Flow
1. Coach opens "Short Video Analysis" from app dashboard.
2. Coach uploads a clip and sets context:
   - Age group (U8/U10/U12/U14/U16/U18/Adult)
   - Player level (Beginner/Intermediate/Advanced/Elite)
   - Coach level (Parent coach/Grassroots/Licensed/Pro)
   - Focus team color (e.g., blue, red, white)
3. User submits.
4. System processes video + creates analysis job.
5. Coach receives:
   - Summary diagnosis
   - Prioritized faults
   - Evidence notes (time windows)
   - Corrective coaching cues
   - Recommended training blocks
6. Coach selects one of:
   - Save analysis
   - Generate 15/45/75 minute session
   - Generate progressive series from top findings

## 7) Analysis Output Contract
Each observation should include:
- `category`: TECHNICAL | DECISION | PHYSICAL | TACTICAL
- `title`: short fault label
- `severity`: CRITICAL | MAJOR | MINOR
- `confidence`: 0.0-1.0
- `evidence`: list of timestamps and what happened
- `impact`: why this reduces performance
- `coachingCue`: one sentence correction cue
- `correctiveDrillHint`: drill/session focus to fix it

Top-level analysis should include:
- `overallVerdict`: 2-4 sentences, direct and strict
- `topPriorities`: top 3 issues to fix first
- `riskFlags`: quality/confidence limitations (camera angle, low FPS, occlusion)
- `recommendedSessionTypes`: e.g. technical repetition, directional game, transition rondo
- `teamDefinition`: focus team color + opponent color mapping

## 8) Tone and Safety Guardrails
- Tone: critical, precise, constructive
- Never insulting, degrading, or abusive
- Youth-safe language for minor age groups
- If confidence is low, explicitly state uncertainty
- Do not claim medical diagnoses
- Strict anonymization: no real player names, no personal identifiers
- Refer to teams as `Team A` (focus color) and `Team B` (opponent)

## 9) Technical Architecture (ACI-aligned)
### Web app (`apps/web`)
- New page: `app/video-analysis/page.tsx`
- New API proxy route: `app/api/video-analysis/route.ts`
- Upload + metadata form
- Job status polling and analysis results UI
- CTA buttons:
  - "Recommend Sessions"
  - "Generate Session"
  - "Generate Series"

### API app (`apps/api`)
- New routes:
  - `POST /ai/video-analysis/upload`
  - `POST /ai/video-analysis/:analysisId/run`
  - `GET /ai/video-analysis/:analysisId`
  - `POST /ai/video-analysis/:analysisId/generate-session`
  - `POST /ai/video-analysis/:analysisId/generate-series`
- Services:
  - `services/video-analysis.ts` (orchestration)
  - `services/video-ingest.ts` (storage + metadata)
  - `prompts/video-analysis.ts` (rubric and output schema)
- Reuse existing session generation services for downstream plan generation.

### Data layer (Prisma)
Add models:
- `VideoAnalysis`
  - id, userId, ageGroup, playerLevel, coachLevel
  - videoUrl/storageKey, durationSec, status
  - summaryJson, createdAt, updatedAt
- `VideoObservation`
  - id, analysisId, category, severity, confidence
  - title, impact, coachingCue, evidenceJson, drillHint
- `VideoRecommendation`
  - id, analysisId, type, title, rationale, payloadJson

Suggested enums:
- `VideoAnalysisStatus`: UPLOADED | PROCESSING | COMPLETED | FAILED
- `ObservationSeverity`: CRITICAL | MAJOR | MINOR
- `ObservationCategory`: TECHNICAL | DECISION | PHYSICAL | TACTICAL

## 10) Prompting Strategy
Use a rubric prompt with strict JSON output schema and weighted evaluation:
- Technical execution quality
- Decision quality under pressure
- Movement mechanics and repeatability
- Tactical positioning/awareness

Condition prompt language by selected context:
- Younger age groups: simpler cues, lower cognitive load
- Elite levels: tighter detail and tactical precision
- Lower coach levels: clearer drill setup instructions

## 11) Session Recommendation and Generation
### Recommendation layer
Map top faults to session templates:
- Fault pattern -> session type
- Severity + confidence -> priority score
- Age/level constraints -> drill complexity and load

### Generation layer
Support outputs:
- 15 min corrective block
- 45 min focused session
- 75 min full session

Generated sessions should include:
- Objective
- Setup
- Constraints/progression/regression
- Coaching points tied directly to observations
- Success criteria

## 12) Non-functional Requirements
- Upload reliability with retry support
- Async job model for long processing
- Max response time target:
  - Upload request: <3s initial ack
  - Analysis completion: best effort, status-driven
- Observability:
  - Job state transitions
  - Failure reasons
  - Time-to-analysis metrics

## 13) QA and Evaluation
- Golden test clips by age/level
- Rubric consistency checks across reruns
- Hallucination checks (must cite visible evidence)
- Safety checks for tone and youth suitability
- Regression checks for existing session generation flows

## 14) Rollout Plan
- Phase 1: Internal beta (manual QA clips)
- Phase 2: Limited users with feature flag
- Phase 3: General release with usage analytics

## 15) Open Decisions
- Storage provider and retention policy for uploaded clips
- Max file size and accepted formats for first release
- Whether asynchronous processing uses queue worker or in-process worker
- Billing entitlement (free vs paid tiers)
