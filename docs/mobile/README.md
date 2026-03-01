# TacticalEdge Mobile App — Master Plan

> AI-powered soccer coaching platform for iOS and Android, built on top of the existing ACI backend API.

---

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Monorepo Integration](#monorepo-integration)
- [Architecture](#architecture)
- [Phase Roadmap](#phase-roadmap)
- [Environment Setup](#environment-setup)
- [API Integration Rules](#api-integration-rules)
- [Shared Packages](#shared-packages)
- [Design System](#design-system)
- [State Management](#state-management)
- [Security](#security)

---

## Overview

The TacticalEdge mobile app brings the full coaching platform to iOS and Android. Coaches can generate sessions, run video analysis from the sideline, browse their vault, and manage their training calendar — all from their phone.

**Backend**: Zero changes to the existing Express API. The mobile app is a pure REST consumer calling the same endpoints as the web app.

**Key differentiators vs web:**
- Sideline Mode (stripped UI for pitch use)
- Camera-native video analysis
- Offline vault caching
- Push notifications for scheduled sessions
- Native share sheet for player plan PDFs

---

## Tech Stack

| Concern | Choice | Reason |
|---|---|---|
| Framework | **React Native + Expo SDK 52** | Same mental model as Next.js; single codebase for iOS + Android |
| Navigation | **Expo Router v4** | File-based routing mirrors Next.js — familiar to the team |
| State | **Zustand** | Lightweight, no boilerplate; replaces React context for global state |
| Server state | **TanStack Query v5** | Caching, background refetch, offline support |
| Styling | **NativeWind v4** | Tailwind CSS classes in React Native — reuse design tokens from web |
| SVG diagrams | **react-native-svg** | Port `UniversalDrillDiagram` component |
| Animations | **react-native-reanimated v3** | Gesture-driven animations, pinch-zoom |
| Gestures | **react-native-gesture-handler** | Swipe between drills, pinch diagrams |
| Secure storage | **expo-secure-store** | JWT tokens |
| Async storage | **@react-native-async-storage/async-storage** | Vault offline cache |
| Video picker | **expo-image-picker** | Camera + gallery for video analysis |
| PDF | **expo-print + expo-sharing** | Generate and share session PDFs |
| Notifications | **expo-notifications** | Session reminders |
| Calendar | **expo-calendar** | Optional native calendar sync |
| Build | **EAS Build** | Cloud builds for iOS + Android |
| Testing | **Jest + React Native Testing Library** | Unit + integration tests |
| E2E | **Maestro** | End-to-end flows on real device/simulator |

---

## Monorepo Integration

Add `apps/mobile` to the existing pnpm workspace:

```
aci/
├── apps/
│   ├── api/          ← existing Express API (unchanged)
│   ├── web/          ← existing Next.js web (unchanged)
│   └── mobile/       ← NEW
│       ├── app/              Expo Router file-based routes
│       │   ├── (auth)/       Auth screens (login, register, etc.)
│       │   ├── (tabs)/       Bottom tab navigator
│       │   │   ├── index.tsx         Home dashboard
│       │   │   ├── generate.tsx      Generate drill/session
│       │   │   ├── vault.tsx         Vault browser
│       │   │   ├── video.tsx         Video analysis
│       │   │   └── calendar.tsx      Training calendar
│       │   └── _layout.tsx   Root layout
│       ├── components/       Shared UI components
│       ├── services/         API client (calls existing backend)
│       ├── stores/           Zustand stores
│       ├── hooks/            Custom hooks
│       ├── constants/        Colors, sizes, enums
│       ├── utils/            Helpers
│       ├── __tests__/        Jest test files
│       ├── e2e/              Maestro flow files
│       ├── app.json          Expo config
│       ├── eas.json          EAS build config
│       ├── babel.config.js
│       ├── metro.config.js
│       └── package.json
├── packages/
│   └── shared/       ← NEW: shared TypeScript types + constants
│       ├── src/
│       │   ├── types/        Session, Drill, Series, User types
│       │   ├── constants/    Enums (GameModelId, Phase, Zone, etc.)
│       │   └── utils/        refCode parsing, date helpers
│       └── package.json
└── pnpm-workspace.yaml
```

### pnpm-workspace.yaml addition

```yaml
packages:
  - 'apps/*'
  - 'packages/*'   # ← add this line
```

---

## Architecture

```
┌────────────────────────────────────────────────────┐
│                  Mobile App (Expo)                  │
│                                                     │
│  ┌─────────┐  ┌──────────┐  ┌────────────────────┐ │
│  │ Screens │  │Components│  │   Zustand Stores   │ │
│  └────┬────┘  └────┬─────┘  └─────────┬──────────┘ │
│       │            │                  │             │
│  ┌────▼────────────▼──────────────────▼──────────┐ │
│  │              TanStack Query Layer              │ │
│  │    (cache, background sync, offline support)   │ │
│  └───────────────────┬────────────────────────────┘ │
│                      │                              │
│  ┌───────────────────▼────────────────────────────┐ │
│  │              API Client (services/)             │ │
│  │   - auth.service.ts                             │ │
│  │   - session.service.ts                          │ │
│  │   - vault.service.ts                            │ │
│  │   - video.service.ts                            │ │
│  │   - calendar.service.ts                         │ │
│  └───────────────────┬────────────────────────────┘ │
└──────────────────────┼─────────────────────────────┘
                       │ HTTPS REST
                       ▼
          ┌────────────────────────┐
          │  Existing Express API  │
          │  (apps/api — unchanged)│
          └────────────────────────┘
```

---

## Phase Roadmap

| Phase | Features | Target | Doc |
|---|---|---|---|
| 1 | Auth, Navigation shell, Home dashboard | Week 1–2 | [PHASE_1.md](./PHASE_1.md) |
| 2 | Session/Drill/Series generation + result view | Week 3–5 | [PHASE_2.md](./PHASE_2.md) |
| 3 | Vault browser, Favorites, Search | Week 6–7 | [PHASE_3.md](./PHASE_3.md) |
| 4 | Video Analysis (upload, results, save) | Week 8–9 | [PHASE_4.md](./PHASE_4.md) |
| 5 | Calendar, Player Plans, PDF export | Week 10–11 | [PHASE_5.md](./PHASE_5.md) |
| 6 | Sideline Mode, Offline cache, Push notifications | Week 12–13 | [PHASE_6.md](./PHASE_6.md) |

---

## Environment Setup

### Prerequisites

```bash
# Install Expo CLI
npm install -g eas-cli

# Install dependencies
cd apps/mobile
pnpm install

# iOS (macOS only)
npx expo run:ios

# Android
npx expo run:android

# Expo Go (fast dev)
npx expo start
```

### Environment Variables

Create `apps/mobile/.env`:

```env
EXPO_PUBLIC_API_URL=https://api.tacticaledge.app
# For local dev:
# EXPO_PUBLIC_API_URL=http://localhost:4000
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

Variables prefixed `EXPO_PUBLIC_` are inlined at build time and safe for client use. Never put secrets here.

---

## API Integration Rules

1. **All API calls go through `services/`** — never call `fetch` directly in a component.
2. **Auth token** is attached via an Axios interceptor — never pass it manually.
3. **Refresh logic** is handled automatically — if a 401 is received, the interceptor calls `POST /auth/refresh`, retries once, then logs out on failure.
4. **Every service function returns typed data** using the shared types from `@aci/shared`.
5. **Errors are typed** — API errors are caught and normalized to `ApiError { status, message }`.

### API Client skeleton

```typescript
// services/api.ts
import axios from 'axios';
import { getSecureItem, setSecureItem, deleteSecureItem } from '../utils/secure-store';

const api = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL,
  timeout: 120_000, // 2 min — sessions take time to generate
});

// Attach token
api.interceptors.request.use(async (config) => {
  const token = await getSecureItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-refresh on 401
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response?.status === 401 && !error.config._retry) {
      error.config._retry = true;
      const refreshToken = await getSecureItem('refreshToken');
      const { data } = await api.post('/auth/refresh', { refreshToken });
      await setSecureItem('accessToken', data.accessToken);
      error.config.headers.Authorization = `Bearer ${data.accessToken}`;
      return api(error.config);
    }
    return Promise.reject(error);
  }
);

export default api;
```

---

## Shared Packages

`packages/shared` exports:

```typescript
// Types used by both web and mobile
export type { Session, Drill, Series, User, VideoAnalysis, CalendarEvent, PlayerPlan }

// Enums
export { GameModelId, Phase, Zone, DrillType, AgeGroup, PlayerLevel, CoachLevel }

// Utilities
export { parseRefCode, formatRefCode, isValidRefCode }
export { formatDuration, formatAgeGroup }
```

---

## Design System

Use NativeWind (Tailwind for React Native). Map existing web design tokens:

| Token | Web (Tailwind) | Mobile (NativeWind) |
|---|---|---|
| Primary | `blue-600` | `blue-600` |
| Background | `zinc-950` | `zinc-950` |
| Card | `zinc-900` | `zinc-900` |
| Border | `zinc-800` | `zinc-800` |
| Text primary | `white` | `white` |
| Text muted | `zinc-400` | `zinc-400` |
| Accent | `emerald-500` | `emerald-500` |
| Danger | `red-500` | `red-500` |
| Warning | `amber-500` | `amber-500` |

### Typography scale

```
Heading 1: 24px bold
Heading 2: 20px semibold
Heading 3: 17px semibold
Body: 15px regular
Caption: 13px regular
Label: 11px medium uppercase tracking-wide
```

---

## State Management

Three Zustand stores:

```typescript
// stores/auth.store.ts
interface AuthStore {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

// stores/generate.store.ts
interface GenerateStore {
  formState: SessionFormState;      // persists form between navigations
  currentSession: Session | null;   // last generated session
  isGenerating: boolean;
  generationProgress: string;       // "Building warmup drills..."
  cancel: () => void;
}

// stores/ui.store.ts
interface UIStore {
  sidelineModeActive: boolean;
  sidelineCurrentDrillIndex: number;
  setSidelineMode: (active: boolean) => void;
}
```

TanStack Query handles all server state (vault list, calendar events, etc.).

---

## Security

- JWT access token stored in `expo-secure-store` (Keychain on iOS, Keystore on Android)
- Refresh token stored in `expo-secure-store`
- No tokens stored in AsyncStorage (unencrypted)
- Auto-logout after refresh failure
- Certificate pinning: configure via `expo-build-properties` for production builds
- Deep links validated before navigation to prevent open redirect

---

## See Also

- [Phase 1 — Auth + Dashboard](./PHASE_1.md)
- [Phase 2 — Generation](./PHASE_2.md)
- [Phase 3 — Vault](./PHASE_3.md)
- [Phase 4 — Video Analysis](./PHASE_4.md)
- [Phase 5 — Calendar + Player Plans](./PHASE_5.md)
- [Phase 6 — Sideline Mode + Offline](./PHASE_6.md)
- [Testing Strategy](./TESTING.md)
