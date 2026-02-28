# Short Video Analysis Implementation Checklist

## Phase 0: Alignment and Constraints
- [ ] Confirm allowed video formats (suggest: mp4, mov)
- [ ] Confirm max upload size (suggest: 200MB MVP)
- [ ] Confirm retention policy for raw video and derived artifacts
- [ ] Confirm plan entitlements (who can use feature)
- [ ] Confirm MVP latency targets and timeout strategy

## Phase 1: Data Model and Migration (apps/api/prisma)
- [ ] Add enum `VideoAnalysisStatus` (UPLOADED, PROCESSING, COMPLETED, FAILED)
- [ ] Add enum `ObservationSeverity` (CRITICAL, MAJOR, MINOR)
- [ ] Add enum `ObservationCategory` (TECHNICAL, DECISION, PHYSICAL, TACTICAL)
- [ ] Add model `VideoAnalysis`
- [ ] Add model `VideoObservation`
- [ ] Add model `VideoRecommendation`
- [ ] Add indexes on `(userId, createdAt)` and `(analysisId)`
- [ ] Generate migration and validate on local DB

## Phase 2: API Contracts and Services (apps/api/src)
- [ ] Create `routes-video-analysis.ts`
- [ ] Mount route in `app.ts`
- [ ] Implement `POST /ai/video-analysis/upload`
  - [ ] Validate metadata (`ageGroup`, `playerLevel`, `coachLevel`, `focusTeamColor`)
  - [ ] Store upload reference + create `VideoAnalysis` record
  - [ ] Return `analysisId` with initial `UPLOADED` status
- [ ] Implement `POST /ai/video-analysis/:analysisId/run`
  - [ ] Transition status to `PROCESSING`
  - [ ] Trigger analysis orchestration service
- [ ] Implement `GET /ai/video-analysis/:analysisId`
  - [ ] Return status and full results if complete
- [ ] Implement `POST /ai/video-analysis/:analysisId/generate-session`
  - [ ] Convert top findings into existing session generation input
- [ ] Implement `POST /ai/video-analysis/:analysisId/generate-series`
  - [ ] Map top 2-3 priorities into progressive series request

## Phase 3: Prompting and AI Orchestration
- [ ] Add `prompts/video-analysis.ts`
- [ ] Define strict JSON schema for model output
- [ ] Add rubric scoring weights per category
- [ ] Add guardrail instruction for "critical but constructive" tone
- [ ] Add hard anonymization rules (no personal names; team labels only)
- [ ] Add team-color focus instruction (`focusTeamColor`) so analysis targets one team
- [ ] Add low-confidence behavior (explicit uncertainty + quality flags)
- [ ] Parse and persist observations/recommendations to DB
- [ ] Add schema validation before save (reject malformed output)

## Phase 4: Web UI and API Proxy (apps/web/src)
- [ ] Add page `app/video-analysis/page.tsx`
- [ ] Add route proxy `app/api/video-analysis/route.ts` (and/or id routes)
- [ ] Build upload + metadata form
- [ ] Add status polling UI (UPLOADED/PROCESSING/COMPLETED/FAILED)
- [ ] Render analysis sections:
  - [ ] Overall verdict
  - [ ] Prioritized observations with severity badges
  - [ ] Evidence timestamps
  - [ ] Coaching cues
  - [ ] Recommended sessions
- [ ] Add CTA: `Generate 15 min`, `Generate 45 min`, `Generate 75 min`
- [ ] Add navigation entry from dashboard quick links

## Phase 5: Integration with Existing Session Pipeline
- [ ] Build mapper: `VideoAnalysis -> GenerateSessionInput`
- [ ] Inject `ageGroup`, `playerLevel`, `coachLevel` into generation payload
- [ ] Include evidence-backed coaching points in generated session metadata
- [ ] Save generated sessions to vault with source pointer (`analysisId`)

## Phase 6: Auth, Entitlements, and Limits
- [ ] Require auth on all analysis endpoints
- [ ] Add plan gate check (reuse billing/subscription services)
- [ ] Add per-user rate limits (uploads/day)
- [ ] Add payload size limits and MIME type validation

## Phase 7: Observability and Failure Handling
- [ ] Add structured logs for analysis lifecycle
- [ ] Track metrics:
  - [ ] upload_count
  - [ ] processing_time_ms
  - [ ] analysis_failure_count
  - [ ] session_generation_from_video_count
- [ ] Persist failure reason in `VideoAnalysis`
- [ ] Expose safe error messages to client

## Phase 8: Testing
- [ ] Unit tests for:
  - [ ] metadata validation
  - [ ] status transitions
  - [ ] prompt output schema parsing
  - [ ] recommendation mapping logic
- [ ] Integration tests for API endpoints
- [ ] E2E test for upload -> analysis -> session generation flow
- [ ] Golden-file checks on representative clips
- [ ] Safety/tone checks for youth contexts

## Phase 9: Release
- [ ] Add feature flag (`VIDEO_ANALYSIS_ENABLED`)
- [ ] Deploy internal QA release
- [ ] Run test matrix for multiple age/level combinations
- [ ] Roll out to limited cohort
- [ ] Monitor quality and latency metrics for 1-2 weeks
- [ ] Remove/relax flag based on stability

## Suggested Build Order (fastest path)
1. Prisma models + migration
2. Upload and analysis status endpoints
3. Prompt and analysis persistence
4. UI page with result rendering
5. Session generation from findings
6. Tests + rollout flag

## Definition of Done
- [ ] Coach can upload short clip and submit context
- [ ] System returns strict, critical, evidence-backed breakdown
- [ ] Recommendations are generated and actionable
- [ ] Coach can generate at least one full session from analysis
- [ ] Core flows are tested and feature-flagged for safe rollout
