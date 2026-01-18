# ACI Training Platform - Complete Documentation

**Last Updated:** January 18, 2026  
**Version:** 1.2.0

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Features](#features)
4. [Database Schema](#database-schema)
5. [API Endpoints](#api-endpoints)
6. [Frontend Pages](#frontend-pages)
7. [Key Components](#key-components)
8. [Reference Codes System](#reference-codes-system)
9. [Favorites System](#favorites-system)
10. [Setup & Installation](#setup--installation)
11. [Development Guide](#development-guide)
12. [Recent Changes](#recent-changes)

---

## Overview

ACI (Advanced Coaching Intelligence) is a comprehensive soccer training platform that uses AI (Google Gemini) to generate tactical drills, training sessions, and progressive series. The platform provides coaches with structured, age-appropriate training content with visual diagrams and detailed coaching points.

### Tech Stack

- **Backend:** Node.js, Express.js, TypeScript, Prisma ORM, PostgreSQL
- **Frontend:** Next.js 16, React 19, TypeScript, Tailwind CSS
- **AI:** Google Gemini API (gemini-2.5-flash, gemini-3-flash-preview)
- **Database:** PostgreSQL
- **Package Manager:** pnpm (monorepo)

---

## Architecture

### Monorepo Structure

```
aci/
├── apps/
│   ├── api/          # Backend Express server
│   └── web/          # Next.js frontend
├── src/            # Shared components (legacy)
├── package.json     # Root workspace config
└── pnpm-workspace.yaml
```

### Server Architecture

- **API Server** (Port 4000): Express.js backend handling AI generation, database operations, and API endpoints
- **Web Server** (Port 3000): Next.js frontend with server-side rendering and API routes

### Data Flow

```
User Input → Next.js Frontend → Next.js API Routes → Express Backend → Gemini AI
                                                              ↓
                                                         PostgreSQL Database
```

---

## Features

### Core Features

1. **Drill Generation**
   - Generate tactical drills based on game model, phase, zone, age group
   - Visual SVG diagrams with player positions and movement
   - Structured organization (setup, area, rotation, restarts, scoring)
   - Coaching points and progressions
   - QA scoring system

2. **Session Generation**
   - Create complete training sessions (60 or 90 minutes)
   - Multiple drills with warm-up, technical, tactical, conditioned games, cooldown
   - Skill focus analysis
   - Progressive difficulty

3. **Progressive Series**
   - Generate multi-session progressive series
   - Build complexity over time
   - Series tracking and organization

4. **Vault System**
   - Save and organize generated content
   - Filter by game model, age group, phase, zone
   - Search by name or reference code
   - View sessions, drills, and series
   - Extract individual drills from sessions
   - Session detail modal with full drill information

5. **Favorites System** (NEW)
   - Save favorite sessions, drills, and series
   - Anonymous user ID management (localStorage)
   - Favorites page with filtering
   - Favorite count tracking

6. **Reference Codes** (NEW)
   - Unique identifiers for all artifacts (D-XXXX, S-XXXX, SR-XXXX)
   - Click-to-copy functionality
   - Reference in AI chat for improvements

7. **AI Coach Assistant**
   - Chat interface for session recommendations
   - Context-aware suggestions
   - Reference existing sessions/drills by code

8. **Admin Dashboard**
   - System metrics and analytics
   - Token usage tracking
   - Cost calculations
   - System status monitoring (NEW)
   - Operation statistics

9. **PDF Export**
   - Export sessions as PDFs
   - Include diagrams and coaching points

---

## Database Schema

### Core Models

#### Drill
- Basic info: `id`, `refCode`, `title`, `json`
- Tactical metadata: `gameModelId`, `phase`, `zone`, `principleIds`, `psychThemeIds`
- Physical: `energySystem`, `rpeMin`, `rpeMax`
- Constraints: `numbersMin`, `numbersMax`, `spaceConstraint`, `goalsAvailable`
- Formation/Level: `formationUsed`, `playerLevel`, `coachLevel`
- Type: `drillType` (WARMUP, TECHNICAL, TACTICAL, etc.)
- Vault: `savedToVault`, `favoriteCount` (NEW)
- Visual: `visualThumbSvg`, `visualHash`
- QA: `qaScore`, `approved`

#### Session
- Basic info: `id`, `refCode`, `title`, `json`
- Same tactical/physical metadata as Drill
- Series: `isSeries`, `seriesId`, `seriesNumber`
- Vault: `savedToVault`, `favoriteCount` (NEW)
- Visual: `visualThumbSvg`, `visualHash`
- QA: `qaScore`, `approved`

#### User (NEW)
- `id` (UUID)
- `email` (optional, for future auth)
- `name` (optional)
- `createdAt`
- `favorites` (relation to Favorite)

#### Favorite (NEW)
- `id` (UUID)
- `userId` (relation to User)
- Polymorphic reference: `sessionId`, `drillId`, `seriesId` (only one set)
- `createdAt`
- Unique constraints: `@@unique([userId, sessionId])`, etc.

#### SkillFocus
- `id`, `sessionId`, `seriesId`
- `title`, `summary`, `keySkills`
- `coachingPoints`, `psychologyGood`, `psychologyBad`
- `sectionPhrases`

#### QAReport
- `id`, `artifactId`, `artifactType`
- `drillId`, `sessionId` (optional relations)
- `pass` (boolean), `scores` (JSON)
- `summary`, `createdAt`

#### ApiMetrics
- Operation tracking: `operationType`, `artifactId`, `model`
- Token usage: `promptTokens`, `completionTokens`, `totalTokens`
- Timing: `durationMs`
- Status: `success`, `errorMessage`
- Metadata: `ageGroup`, `gameModelId`, `phase`

#### DailyMetrics
- Aggregated daily statistics
- Counts by operation type
- Token totals
- Average durations

---

## API Endpoints

### Backend API (Port 4000)

#### Drill Endpoints
- `POST /coach/generate-drill-vetted` - Generate a vetted drill
- `GET /drills/:id` - Get drill by ID
- `POST /drills` - Create drill

#### Session Endpoints
- `POST /sessions/generate` - Generate a single session
- `POST /sessions/progressive` - Generate progressive series
- `GET /sessions/:id` - Get session by ID
- `POST /ai/chat` - AI coach chat with context

#### Vault Endpoints
- `GET /vault/sessions` - Get vault sessions (with filters)
- `GET /vault/series` - Get vault series
- `POST /vault/sessions/:id/save` - Save session to vault
- `GET /vault/sessions/:id/status` - Check if session is in vault
- `GET /vault/lookup/:refCode` - Lookup by reference code
- `POST /vault/lookup` - Batch lookup by reference codes
- `POST /vault/extract-refs` - Extract ref codes from text

#### Favorites Endpoints (NEW)
- `GET /favorites` - Get user's favorites (with filters)
- `POST /favorites/session/:id` - Add session to favorites
- `DELETE /favorites/session/:id` - Remove session from favorites
- `POST /favorites/drill/:id` - Add drill to favorites
- `DELETE /favorites/drill/:id` - Remove drill from favorites
- `POST /favorites/series/:id` - Add series to favorites
- `DELETE /favorites/series/:id` - Remove series from favorites
- `POST /favorites/check` - Batch check favorite status

#### Admin Endpoints
- `GET /admin/stats` - Overall statistics
- `GET /admin/metrics/timeline` - Timeline metrics
- `GET /admin/metrics/recent` - Recent metrics
- `GET /admin/metrics/by-operation` - Operation statistics
- `GET /admin/stats/by-age-group` - Age group statistics
- `GET /health` - Health check endpoint
- `POST /admin/random-sessions/start` - Start bulk session/series generation (NEW)
- `GET /admin/random-sessions/:jobId` - Get bulk generation job status (NEW)
- `POST /admin/sessions/review` - Run QA review on a session
- `POST /admin/sessions/regenerate` - Manually regenerate a session with new QA
- `GET /admin/analytics/qa-status` - Get QA status analytics (OK, PATCHABLE, NEEDS_REGEN breakdown) (NEW)

#### Skill Focus Endpoints
- `GET /skill-focus/session/:sessionId` - Get skill focus for session
- `GET /skill-focus/series/:seriesId` - Get skill focus for series
- `POST /skill-focus/session/:sessionId` - Generate skill focus

### Next.js API Routes (Port 3000)

All backend endpoints are proxied through Next.js API routes:
- `/api/vault/*` - Vault operations
- `/api/vault/sessions/[sessionId]` - Get individual session by ID (NEW)
- `/api/favorites/*` - Favorites operations
- `/api/admin/*` - Admin operations
- `/api/generate-session` - Session generation
- `/api/generate-progressive-series` - Series generation
- `/api/coach-chat` - AI chat
- `/api/export-session-pdf` - PDF export

---

## Frontend Pages

### Main Pages

1. **Home** (`/`)
   - Landing page with navigation cards
   - AI Coach Chat box
   - Quick access to generators

2. **Drill Generator** (`/demo/drill`)
   - Form to configure drill parameters
   - Generate and display drills
   - Visual diagram rendering

3. **Session Generator** (`/demo/session`)
   - Generate single sessions or progressive series
   - Session preview with drills
   - Skill focus display
   - PDF export
   - Favorite toggle (NEW)
   - Reference codes display (NEW)

4. **Vault** (`/vault`)
   - Browse saved sessions, drills, and series
   - Filter by game model, age group, phase, zone
   - Tab navigation (Drills, Sessions, Series)
   - Favorite buttons on cards (NEW)
   - Reference codes with click-to-copy (NEW)
   - Session detail modals

5. **Favorites** (`/vault/favorites`) (NEW)
   - View all favorited items
   - Tab navigation (All, Sessions, Drills, Series)
   - Same filtering as vault
   - Remove from favorites

6. **Admin Dashboard** (`/admin`)
   - System metrics and statistics
   - Token usage and costs
   - Operation breakdowns
   - System status monitoring
   - Revenue calculator
   - Bulk session/series generation
   - Session QA review and manual regeneration
   - QA Status Analytics (NEW) - View breakdown of session quality status
   - Session view modal for regenerated sessions (NEW)

### Navigation

Persistent header bar with links:
- 🏠 Home
- 🧩 Drill Generator
- 📋 Session Generator
- 🗂️ Vault
- ♥ Favorites
- ⚙️ Admin

---

## Key Components

### Frontend Components

1. **DrillDiagram** - Renders SVG tactical diagrams
2. **DrillDiagramCard** - Card display for drills
3. **SessionForm** - Session generation form
4. **CoachChat** - AI assistant chat interface
5. **TopicSelect** - Topic selection for sessions
6. **FormationSelect** - Formation picker
7. **PlayerCountInputs** - Player count inputs
8. **QAScoresDisplay** - QA score visualization
9. **SessionProgress** - Progress indicator for series

### Backend Services

1. **session.ts** - Single session generation
2. **session-progressive.ts** - Progressive series generation
3. **drill.ts** - Drill generation
4. **vault.ts** - Vault operations
5. **skill-focus.ts** - Skill focus analysis
6. **pdf-export.ts** - PDF generation
7. **ref-code.ts** (NEW) - Reference code utilities

### Utilities

1. **ref-code.ts** (NEW)
   - `generateRefCode()` - Generate unique reference codes
   - `lookupByRefCode()` - Lookup artifacts by code
   - `extractRefCodes()` - Extract codes from text
   - `parseRefCode()` - Parse code format

2. **user.ts** (NEW)
   - `getUserId()` - Get or create anonymous user ID
   - `getUserHeaders()` - Get headers for API requests
   - `clearUserId()` - Clear user ID (testing)

---

## Reference Codes System

### Format

- **Drills:** `D-XXXX` (e.g., `D-X7K2`)
- **Sessions:** `S-XXXX` (e.g., `S-9M3P`)
- **Series:** `SR-XXXX` (e.g., `SR-4F2`)

### Features

- Unique codes generated for all artifacts
- Embedded drills get their own codes
- Click-to-copy functionality throughout UI
- Reference in AI chat: "Improve S-7K2M"
- Batch lookup by multiple codes

### Implementation

- Codes stored in `refCode` field (unique, indexed)
- Generated using `generateRefCode()` utility
- Ensures uniqueness across Drill and Session tables
- Backfilled for existing records

---

## Favorites System

### User Management

- **Anonymous Users:** localStorage-based user IDs (`anon-xxxxx`)
- **Future:** Ready for real authentication (User model exists)
- **User ID:** Passed via `x-user-id` header

### Features

- Favorite sessions, drills, and series
- Favorite count tracking (public)
- Favorites page with filtering
- Remove from favorites
- Batch check favorite status

### Database

- `User` model for user accounts
- `Favorite` model with polymorphic references
- `favoriteCount` fields on Session and Drill
- Unique constraints prevent duplicate favorites

### API

- All CRUD operations for favorites
- Batch check endpoint
- Filtered favorites list
- Auto-increment/decrement favorite counts

---

## Setup & Installation

### Prerequisites

- Node.js 18+
- pnpm 10.20.0+
- PostgreSQL (for database)
- Google Gemini API key

### Installation

```bash
# Clone repository
git clone <repository-url>
cd aci

# Install dependencies
pnpm install

# Set up environment variables
# Create apps/api/.env with:
GEMINI_API_KEY=your_key_here
DATABASE_URL=postgresql://user:password@localhost:5432/aci_db

# Run database migrations
cd apps/api
npx prisma migrate deploy
npx prisma generate
```

### Running Servers

See `RUN_SERVERS.md` for detailed instructions.

**Quick Start:**
```bash
# Terminal 1: API Server
cd apps/api && pnpm dev

# Terminal 2: Web Server
cd apps/web && pnpm dev
```

### Database Setup

```bash
# Create database
createdb aci_db

# Run migrations
cd apps/api
npx prisma migrate deploy

# (Optional) Backfill reference codes
npx ts-node src/scripts/backfill-ref-codes.ts
```

---

## Development Guide

### Project Structure

```
apps/
├── api/
│   ├── src/
│   │   ├── routes-*.ts      # API route handlers
│   │   ├── services/         # Business logic
│   │   ├── utils/           # Utilities
│   │   ├── prompts/         # AI prompts
│   │   ├── prisma.ts        # Prisma client
│   │   └── index.ts         # Server entry
│   └── prisma/
│       ├── schema.prisma    # Database schema
│       └── migrations/      # Migration files
└── web/
    ├── src/
    │   ├── app/             # Next.js app router
    │   │   ├── api/         # API routes (proxies)
    │   │   ├── admin/       # Admin dashboard
    │   │   ├── demo/        # Demo pages
    │   │   ├── vault/       # Vault pages
    │   │   └── layout.tsx   # Root layout
    │   ├── components/      # React components
    │   ├── lib/             # Utilities
    │   └── types/           # TypeScript types
    └── public/              # Static assets
```

### Adding New Features

1. **Database Changes:**
   ```bash
   # Edit schema.prisma
   cd apps/api
   npx prisma migrate dev --name feature_name
   npx prisma generate
   ```

2. **Backend Routes:**
   - Create route file: `apps/api/src/routes-*.ts`
   - Register in `apps/api/src/app.ts`

3. **Frontend Pages:**
   - Create page: `apps/web/src/app/*/page.tsx`
   - Add API route if needed: `apps/web/src/app/api/*/route.ts`

### Code Style

- TypeScript strict mode
- ESLint configuration
- Prettier (if configured)
- Component-based architecture

### Testing

```bash
# Type checking
pnpm typecheck

# Run tests (if configured)
pnpm test
```

---

## Recent Changes

### January 18, 2026

#### QA Status Analytics (NEW)
- ✅ Added QA Status Analytics card to admin dashboard
- ✅ Shows breakdown of sessions by QA status: OK, PATCHABLE, NEEDS_REGEN, NO_QA_OR_PASS
- ✅ Displays counts and percentages for each status
- ✅ Shows sample sessions for PATCHABLE and NEEDS_REGEN statuses
- ✅ Includes reference codes and QA scores for easy identification
- ✅ New endpoint: `GET /admin/analytics/qa-status`

#### Session Regeneration Improvements
- ✅ Added session view modal (similar to vault) for viewing regenerated sessions
- ✅ Disable regenerate button after completion to prevent duplicate operations
- ✅ Improved success messages showing old and new session reference codes
- ✅ Increased timeout for regeneration operations (3 minutes)
- ✅ Better error handling and logging
- ✅ Added "Replace session" option to delete old session instead of marking as superseded

#### Vault Search
- ✅ Added search functionality to vault page
- ✅ Search by session/drill/series names or reference codes
- ✅ Case-insensitive matching across all tabs
- ✅ Works in combination with existing filters

### January 15, 2026

#### Vault Search (NEW)
- ✅ Added search functionality to vault page
- ✅ Search by session/drill/series names or reference codes
- ✅ Case-insensitive matching across all tabs
- ✅ Works in combination with existing filters
- ✅ Shows filtered count vs total in tab labels

#### Session Review & Regeneration (NEW)
- ✅ Manual session regeneration workflow
- ✅ Separate QA review and regeneration endpoints
- ✅ Regenerate button appears after QA review
- ✅ New sessions auto-saved to vault with QA scores
- ✅ Original sessions marked as superseded
- ✅ Removed auto-regenerate checkbox (replaced with manual button)

#### Admin Dashboard Enhancements
- ✅ Bulk session/series generation with progress tracking
- ✅ Session QA review card with scores and decision
- ✅ Manual regeneration workflow
- ✅ System status monitoring (backend and database)
- ✅ Age group statistics split by sessions vs series

### January 17, 2025

#### Favorites System
- ✅ Added User and Favorite models
- ✅ Implemented favorites API routes
- ✅ Created favorites page with filtering
- ✅ Added favorite buttons to vault and session pages
- ✅ Anonymous user ID management (localStorage)
- ✅ Favorite count tracking

#### Reference Codes
- ✅ Added `refCode` field to Drill and Session models
- ✅ Implemented reference code generation utilities
- ✅ Added click-to-copy functionality
- ✅ Reference code display throughout UI
- ✅ AI chat integration for referencing artifacts

#### System Improvements
- ✅ System status monitoring in admin dashboard
- ✅ Improved server keep-alive mechanisms
- ✅ Enhanced error handling and logging
- ✅ Fixed vault loading issues
- ✅ Added admin link to navigation

#### Bug Fixes
- ✅ Fixed port conflict issues
- ✅ Resolved server exit problems
- ✅ Improved API timeout handling
- ✅ Enhanced database connection handling

---

## Environment Variables

### API Server (`apps/api/.env`)

```bash
# Required
GEMINI_API_KEY=your_gemini_api_key_here
DATABASE_URL=postgresql://user:password@localhost:5432/aci_db

# Optional
PORT=4000
NODE_ENV=development
BYPASS_QA=1
USE_LLM_FIXER=1
PERSIST_DRILLS=1
```

### Web Server

No environment variables required (uses defaults).

---

## Troubleshooting

### Common Issues

1. **Port 4000 already in use**
   ```bash
   lsof -ti:4000 | xargs kill
   ```

2. **Database connection errors**
   - Check DATABASE_URL in `.env`
   - Verify PostgreSQL is running
   - Check database exists: `psql -l | grep aci_db`

3. **API not responding**
   - Check API server logs
   - Verify GEMINI_API_KEY is set
   - Test health endpoint: `curl http://localhost:4000/health`

4. **Vault not loading**
   - Check backend is running
   - Check browser console for errors
   - Verify database has data

5. **Favorites not working**
   - Check localStorage is enabled
   - Verify favorites API routes are registered
   - Check browser console for errors

---

## Future Enhancements

### Planned Features

- [ ] Real user authentication (replace anonymous IDs)
- [ ] User profiles and preferences
- [ ] Sharing and collaboration features
- [ ] Advanced search and filtering
- [ ] Export to other formats (Excel, CSV)
- [ ] Mobile app
- [ ] Offline mode
- [ ] Multi-language support

### Technical Debt

- [ ] Remove debug logging
- [ ] Improve error messages
- [ ] Add comprehensive tests
- [ ] Performance optimization
- [ ] Caching strategies
- [ ] Rate limiting

---

## Support & Contact

For issues, questions, or contributions, please refer to the project repository.

**Last Updated:** January 18, 2026
