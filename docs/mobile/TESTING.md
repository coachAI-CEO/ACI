# Testing Strategy — TacticalEdge Mobile App

> Comprehensive testing approach covering unit tests, integration tests, end-to-end flows, and manual QA checklists for every phase.

---

## Table of Contents

- [Testing Philosophy](#testing-philosophy)
- [Tool Stack](#tool-stack)
- [Test Organization](#test-organization)
- [Unit Testing Guidelines](#unit-testing-guidelines)
- [Integration Testing](#integration-testing)
- [End-to-End Testing with Maestro](#end-to-end-testing-with-maestro)
- [API Mocking Strategy](#api-mocking-strategy)
- [Performance Testing](#performance-testing)
- [Accessibility Testing](#accessibility-testing)
- [Device Matrix](#device-matrix)
- [CI/CD Pipeline](#cicd-pipeline)
- [Manual QA Checklists](#manual-qa-checklists)
- [Critical User Journeys](#critical-user-journeys)
- [Regression Suite](#regression-suite)
- [Bug Report Template](#bug-report-template)

---

## Testing Philosophy

**Test behavior, not implementation.** Tests describe what the user experiences, not how components render internally.

**Priority order:**
1. Critical user journeys (login, generate, view result) — must never break
2. Data integrity (tokens stored correctly, API calls sent with right params)
3. Feature gates (FREE users cannot access paid features)
4. Error handling (network failures, API errors, edge cases)
5. UI polish (animations, transitions) — tested manually

**Coverage targets:**
- Services: 90%+ (pure functions, no UI)
- Hooks: 80%+
- Stores: 80%+
- Screens/Components: 60%+ (behavior, not structure)

---

## Tool Stack

| Tool | Purpose |
|---|---|
| **Jest** | Test runner + assertions |
| **React Native Testing Library (RNTL)** | Render components, fire events, query by accessibility role |
| **MSW (Mock Service Worker)** | Intercept API calls in tests |
| **@shopify/flash-list** mock | Mock FlashList for list tests |
| **expo-secure-store** mock | Stub token storage |
| **@react-native-async-storage** mock | Stub offline cache |
| **@react-native-community/netinfo** mock | Stub network status |
| **Maestro** | End-to-end tests on simulator/device |
| **EAS** | Build + submit automation |

---

## Test Organization

```
apps/mobile/
├── __tests__/
│   ├── services/
│   │   ├── auth.service.test.ts
│   │   ├── session.service.test.ts
│   │   ├── vault.service.test.ts
│   │   ├── video-analysis.service.test.ts
│   │   ├── calendar.service.test.ts
│   │   ├── player-plans.service.test.ts
│   │   └── offline-cache.service.test.ts
│   ├── stores/
│   │   ├── auth.store.test.ts
│   │   ├── generate.store.test.ts
│   │   └── offline.store.test.ts
│   ├── hooks/
│   │   ├── useAuth.test.ts
│   │   ├── useGenerate.test.ts
│   │   ├── useVault.test.ts
│   │   ├── useFavorites.test.ts
│   │   └── useNetworkStatus.test.ts
│   ├── components/
│   │   ├── auth/
│   │   │   ├── LoginForm.test.tsx
│   │   │   └── RegisterForm.test.tsx
│   │   ├── generate/
│   │   │   ├── AgeGroupPicker.test.tsx
│   │   │   └── GenerateButton.test.tsx
│   │   ├── session/
│   │   │   ├── DrillAccordion.test.tsx
│   │   │   └── SessionActionBar.test.tsx
│   │   ├── vault/
│   │   │   ├── SessionCard.test.tsx
│   │   │   └── VaultFilterBar.test.tsx
│   │   └── sideline/
│   │       ├── SidelineDrillView.test.tsx
│   │       └── SidelineTimer.test.tsx
│   └── utils/
│       ├── secure-store.test.ts
│       └── ref-code.test.ts
└── e2e/
    ├── flows/
    │   ├── auth.yaml
    │   ├── generate-session.yaml
    │   ├── vault-browse.yaml
    │   ├── video-analysis.yaml
    │   ├── calendar.yaml
    │   └── sideline-mode.yaml
    └── helpers/
        └── login.yaml
```

---

## Unit Testing Guidelines

### Services

Test each service function in isolation. Mock `api.ts` (axios) with MSW or `jest.mock`.

```typescript
// __tests__/services/auth.service.test.ts
import { login, logout, getCurrentUser } from '../../services/auth.service';
import { server } from '../mocks/server'; // MSW server
import { rest } from 'msw';

describe('auth.service', () => {
  describe('login()', () => {
    it('returns tokens and user on success', async () => {
      server.use(
        rest.post('/auth/login', (req, res, ctx) =>
          res(ctx.json({ accessToken: 'at', refreshToken: 'rt', user: mockUser }))
        )
      );
      const result = await login('coach@test.com', 'password123');
      expect(result.accessToken).toBe('at');
      expect(result.user.email).toBe('coach@test.com');
    });

    it('throws ApiError on 401', async () => {
      server.use(
        rest.post('/auth/login', (req, res, ctx) =>
          res(ctx.status(401), ctx.json({ message: 'Invalid credentials' }))
        )
      );
      await expect(login('a@b.com', 'wrong')).rejects.toMatchObject({
        status: 401,
        message: 'Invalid credentials',
      });
    });

    it('stores tokens in secure store on success', async () => {
      // ... mock success response
      await login('coach@test.com', 'password');
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith('accessToken', 'at');
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith('refreshToken', 'rt');
    });
  });

  describe('logout()', () => {
    it('clears tokens from secure store', async () => {
      await logout();
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('accessToken');
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('refreshToken');
    });
  });
});
```

---

### Stores

Test Zustand stores with real store instances (not mocked).

```typescript
// __tests__/stores/auth.store.test.ts
import { renderHook, act } from '@testing-library/react-hooks';
import { useAuthStore } from '../../stores/auth.store';

describe('useAuthStore', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, isAuthenticated: false });
  });

  it('sets user and isAuthenticated on login', async () => {
    const { result } = renderHook(() => useAuthStore());

    await act(async () => {
      await result.current.login('coach@test.com', 'password123');
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user?.email).toBe('coach@test.com');
  });

  it('clears user on logout', async () => {
    useAuthStore.setState({ user: mockUser, isAuthenticated: true });

    const { result } = renderHook(() => useAuthStore());
    await act(async () => { await result.current.logout(); });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
  });
});
```

---

### Components

Use RNTL to render components and test user-visible behavior.

```typescript
// __tests__/components/auth/LoginForm.test.tsx
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { LoginForm } from '../../../components/auth/LoginForm';

describe('LoginForm', () => {
  const mockOnSubmit = jest.fn();

  beforeEach(() => { mockOnSubmit.mockReset(); });

  it('renders email and password inputs', () => {
    const { getByPlaceholderText } = render(<LoginForm onSubmit={mockOnSubmit} />);
    expect(getByPlaceholderText('Email')).toBeTruthy();
    expect(getByPlaceholderText('Password')).toBeTruthy();
  });

  it('shows validation error for empty email', async () => {
    const { getByText, getByRole } = render(<LoginForm onSubmit={mockOnSubmit} />);
    fireEvent.press(getByRole('button', { name: 'Sign In' }));
    await waitFor(() => {
      expect(getByText('Email is required')).toBeTruthy();
    });
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it('shows validation error for invalid email format', async () => {
    const { getByPlaceholderText, getByText, getByRole } = render(
      <LoginForm onSubmit={mockOnSubmit} />
    );
    fireEvent.changeText(getByPlaceholderText('Email'), 'notanemail');
    fireEvent.press(getByRole('button', { name: 'Sign In' }));
    await waitFor(() => {
      expect(getByText('Enter a valid email')).toBeTruthy();
    });
  });

  it('calls onSubmit with email and password when form is valid', async () => {
    const { getByPlaceholderText, getByRole } = render(<LoginForm onSubmit={mockOnSubmit} />);
    fireEvent.changeText(getByPlaceholderText('Email'), 'coach@test.com');
    fireEvent.changeText(getByPlaceholderText('Password'), 'password123');
    fireEvent.press(getByRole('button', { name: 'Sign In' }));
    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith({
        email: 'coach@test.com',
        password: 'password123',
      });
    });
  });

  it('disables submit button while loading', async () => {
    const slowOnSubmit = jest.fn(() => new Promise(r => setTimeout(r, 100)));
    const { getByRole } = render(<LoginForm onSubmit={slowOnSubmit} />);
    // ... fill form
    fireEvent.press(getByRole('button', { name: 'Sign In' }));
    expect(getByRole('button', { name: 'Sign In' })).toBeDisabled();
  });
});
```

---

### Hooks

```typescript
// __tests__/hooks/useFavorites.test.ts
import { renderHook, act } from '@testing-library/react-hooks';
import { useFavorites } from '../../hooks/useFavorites';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';

const wrapper = ({ children }) => (
  <QueryClientProvider client={new QueryClient()}>
    {children}
  </QueryClientProvider>
);

describe('useFavorites', () => {
  it('toggles favorite optimistically', async () => {
    server.use(
      rest.post('/favorites/session/:id', (req, res, ctx) => res(ctx.status(201)))
    );

    const { result } = renderHook(() => useFavorites(), { wrapper });

    expect(result.current.isFavorited('session-1')).toBe(false);

    await act(async () => {
      await result.current.toggleFavorite('session', 'session-1');
    });

    expect(result.current.isFavorited('session-1')).toBe(true);
  });

  it('rolls back optimistic update on API error', async () => {
    server.use(
      rest.post('/favorites/session/:id', (req, res, ctx) => res(ctx.status(500)))
    );

    const { result } = renderHook(() => useFavorites(), { wrapper });

    await act(async () => {
      try {
        await result.current.toggleFavorite('session', 'session-1');
      } catch {}
    });

    // Optimistic update rolled back
    expect(result.current.isFavorited('session-1')).toBe(false);
  });
});
```

---

## Integration Testing

Integration tests render full screens with real stores and mocked API.

```typescript
// __tests__/screens/VaultScreen.integration.test.tsx
import { render, waitFor, fireEvent } from '@testing-library/react-native';
import { VaultScreen } from '../../app/(tabs)/vault';
import { TestProviders } from '../test-utils/TestProviders';
import { mockSessions } from '../mocks/data';

describe('Vault Screen (integration)', () => {
  it('loads and displays sessions from API', async () => {
    server.use(
      rest.get('/vault/sessions', (req, res, ctx) =>
        res(ctx.json({ data: mockSessions, total: 20 }))
      )
    );

    const { getAllByTestId } = render(
      <TestProviders authenticated>
        <VaultScreen />
      </TestProviders>
    );

    await waitFor(() => {
      expect(getAllByTestId('session-card')).toHaveLength(3);
    });
  });

  it('shows empty state when no sessions', async () => {
    server.use(
      rest.get('/vault/sessions', (req, res, ctx) =>
        res(ctx.json({ data: [], total: 0 }))
      )
    );

    const { getByText } = render(
      <TestProviders authenticated>
        <VaultScreen />
      </TestProviders>
    );

    await waitFor(() => {
      expect(getByText('No sessions in your vault yet')).toBeTruthy();
    });
  });

  it('applies filter and refetches', async () => {
    let lastRequest;
    server.use(
      rest.post('/vault/sessions/search', (req, res, ctx) => {
        lastRequest = req.body;
        return res(ctx.json({ data: [], total: 0 }));
      })
    );

    const { getByText, getByTestId } = render(
      <TestProviders authenticated>
        <VaultScreen />
      </TestProviders>
    );

    await waitFor(() => getByText('All Ages'));
    fireEvent.press(getByText('All Ages'));
    fireEvent.press(getByText('U14 Boys'));

    await waitFor(() => {
      expect(lastRequest?.ageGroup).toBe('U14_BOYS');
    });
  });
});
```

---

## End-to-End Testing with Maestro

Maestro uses YAML flow files that run on real iOS simulator / Android emulator.

### Setup

```bash
# Install Maestro
curl -Ls "https://get.maestro.mobile.dev" | bash

# Run a flow
maestro test e2e/flows/auth.yaml

# Run all flows
maestro test e2e/flows/
```

### Flow: Login (`e2e/flows/auth.yaml`)

```yaml
appId: com.tacticaledge.mobile
---
# Clear app state
- clearState

# Launch app
- launchApp

# Assert login screen shown
- assertVisible: "Sign In"

# Enter credentials
- tapOn: "Email"
- inputText: "coach@test.com"
- tapOn: "Password"
- inputText: "TestPass123!"

# Submit
- tapOn: "Sign In"

# Assert home dashboard visible
- assertVisible: "Good morning"
- assertVisible: "Quick Actions"

# Assert we're authenticated
- assertVisible: "Sessions this month"
```

---

### Flow: Full Session Generation (`e2e/flows/generate-session.yaml`)

```yaml
appId: com.tacticaledge.mobile
---
- runFlow: helpers/login.yaml

# Navigate to Generate tab
- tapOn:
    id: "tab-generate"

# Select Session sub-tab
- tapOn: "Session"

# Select Age Group
- tapOn: "U14 Boys"

# Select Game Model
- tapOn: "Pressing"

# Select Phase
- tapOn: "Attacking"

# Set Duration to 60
- tapOn: "60 min"

# Tap Generate
- tapOn: "Generate Session"

# Assert loading screen
- assertVisible: "Generating your session"

# Wait up to 3 minutes for generation
- waitForAnimationToEnd:
    timeout: 180000

# Assert session result screen
- assertVisible:
    text: "S-"  # ref code prefix
- assertVisible: "U14"
- assertVisible: "Pressing"

# Assert first drill in accordion
- assertVisible: "Warmup"

# Open first drill
- tapOn: "Warmup"

# Assert drill expanded
- assertVisible: "Coaching Points"

# Navigate to drill detail
- tapOn: "Read full setup"

# Assert tabs
- assertVisible: "Setup"
- assertVisible: "Coaching"
- assertVisible: "Progressions"

# Go back
- back

# Save to vault
- tapOn:
    id: "btn-save-session"

# Assert saved
- assertVisible: "Session saved to vault"
```

---

### Flow: Vault Browse & Filter (`e2e/flows/vault-browse.yaml`)

```yaml
appId: com.tacticaledge.mobile
---
- runFlow: helpers/login.yaml

# Navigate to Vault
- tapOn:
    id: "tab-vault"

# Assert sessions listed
- assertVisible: "S-"

# Open filter
- tapOn: "All Ages"
- tapOn: "U14 Boys"

# Assert filter active
- assertVisible: "U14 Boys ▾"

# Search
- tapOn:
    placeholder: "Search sessions"
- inputText: "pressing"

# Assert search results
- assertVisible: "Pressing"

# Clear search
- clearText
- assertVisible: "All Ages"  # filter preserved

# Tap a session
- tapOn:
    index: 0
    testId: "session-card"

# Assert session detail
- assertVisible: "Coaching Points"
- assertVisible: "Drills"
```

---

### Flow: Sideline Mode (`e2e/flows/sideline-mode.yaml`)

```yaml
appId: com.tacticaledge.mobile
---
- runFlow: helpers/login.yaml

# Navigate to vault, open a session
- tapOn:
    id: "tab-vault"
- tapOn:
    index: 0
    testId: "session-card"

# Start sideline mode
- tapOn: "Sideline"

# Confirm entry
- tapOn: "Start"

# Assert sideline screen
- assertVisible: "Drill 1"
- assertNotVisible:
    id: "tab-bar"  # tab bar hidden

# Assert coaching points visible
- assertVisible: "Coaching Points"

# Swipe to next drill
- swipe:
    direction: LEFT
    duration: 300

# Assert Drill 2 shown
- assertVisible: "Drill 2"

# Start timer
- tapOn: "Start"
- assertVisible: "Running"

# Exit
- tapOn: "✕"
- tapOn: "End Practice"

# Assert back to session detail
- assertVisible: "Drills"
- assertVisible:
    id: "tab-bar"  # tab bar restored
```

---

### Flow: Video Analysis (`e2e/flows/video-analysis.yaml`)

```yaml
appId: com.tacticaledge.mobile
---
- runFlow: helpers/login.yaml

# Navigate to Video tab
- tapOn:
    id: "tab-video"

# Tap Gallery (will use pre-seeded video in test env)
- tapOn: "Gallery"

# The gallery opens — select first video (pre-seeded)
# Maestro handles system UI with permission dialogs
- assertVisible: "Analyze Video"

# Set context
- tapOn: "Age Group"
- tapOn: "U14 Boys"

# Tap Analyze
- tapOn: "Analyze Video"

# Assert loading screen
- assertVisible: "Analyzing your footage"

# Wait for analysis (up to 3 minutes)
- waitForAnimationToEnd:
    timeout: 180000

# Assert result tabs
- assertVisible: "Summary"
- assertVisible: "Observations"
- assertVisible: "Diagrams"
- assertVisible: "Plan"

# Check observations tab
- tapOn: "Observations"
- assertVisible: "CRITICAL"

# Save
- tapOn: "Save Analysis"
- assertVisible: "VA-"
```

---

## API Mocking Strategy

### MSW Setup

```typescript
// __tests__/mocks/server.ts
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);

// jest.setup.ts
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

### Mock Handlers

```typescript
// __tests__/mocks/handlers.ts
import { rest } from 'msw';
import { mockUser, mockSession, mockSessions, mockAnalysis } from './data';

export const handlers = [
  // Auth
  rest.post('/auth/login', (req, res, ctx) =>
    res(ctx.json({ accessToken: 'mock-at', refreshToken: 'mock-rt', user: mockUser }))
  ),
  rest.get('/auth/me', (req, res, ctx) =>
    res(ctx.json(mockUser))
  ),
  rest.get('/auth/usage', (req, res, ctx) =>
    res(ctx.json({ sessionCount: 23, sessionLimit: 100, drillCount: 87, drillLimit: 500 }))
  ),
  rest.post('/auth/refresh', (req, res, ctx) =>
    res(ctx.json({ accessToken: 'refreshed-at' }))
  ),

  // Generation
  rest.post('/ai/generate-session', (req, res, ctx) =>
    res(ctx.delay(500), ctx.json(mockSession))
  ),

  // Vault
  rest.get('/vault/sessions', (req, res, ctx) =>
    res(ctx.json({ data: mockSessions, total: 20 }))
  ),
  rest.get('/vault/sessions/:sessionId', (req, res, ctx) =>
    res(ctx.json(mockSession))
  ),
  rest.post('/vault/sessions/:sessionId/save', (req, res, ctx) =>
    res(ctx.json({ success: true }))
  ),

  // Favorites
  rest.get('/favorites', (req, res, ctx) =>
    res(ctx.json({ sessions: [], series: [], drills: [] }))
  ),
  rest.post('/favorites/session/:id', (req, res, ctx) =>
    res(ctx.status(201))
  ),
  rest.delete('/favorites/session/:id', (req, res, ctx) =>
    res(ctx.json({ success: true }))
  ),

  // Video Analysis
  rest.post('/ai/video-analysis/run', (req, res, ctx) =>
    res(ctx.delay(2000), ctx.json(mockAnalysis))
  ),

  // Calendar
  rest.get('/calendar/events', (req, res, ctx) =>
    res(ctx.json([]))
  ),
  rest.post('/calendar/events', (req, res, ctx) =>
    res(ctx.status(201), ctx.json({ id: 'evt1', ...req.body }))
  ),
];
```

---

## Performance Testing

### Render Performance

Use `@testing-library/react-native` with `jest-performance` to assert render times:

```typescript
it('renders vault list of 50 sessions under 500ms', async () => {
  const start = Date.now();
  const { getAllByTestId } = render(<VaultScreen sessions={mockSessions50} />);
  await waitFor(() => getAllByTestId('session-card'));
  expect(Date.now() - start).toBeLessThan(500);
});
```

### List Scrolling (Maestro)

```yaml
# e2e/flows/performance/vault-scroll.yaml
- scrollUntilVisible:
    element: "Load 20 more"
    direction: DOWN
    timeout: 3000  # must reach bottom in under 3 seconds
```

### Generation Timeout

All generation tests mock fast responses, but the timeout behavior is explicitly tested:

```typescript
it('shows retry option after 120 seconds', async () => {
  jest.useFakeTimers();
  server.use(
    rest.post('/ai/generate-session', (req, res, ctx) =>
      res(ctx.delay('infinite'))
    )
  );
  // Start generation...
  jest.advanceTimersByTime(121_000);
  await waitFor(() => {
    expect(getByText('This is taking longer than expected')).toBeTruthy();
    expect(getByText('Retry')).toBeTruthy();
  });
  jest.useRealTimers();
});
```

---

## Accessibility Testing

All interactive elements must have accessibility labels.

```typescript
// Each component test should include:
it('has correct accessibility labels', () => {
  const { getByRole } = render(<SessionCard session={mockSession} />);

  // Buttons identifiable by role
  expect(getByRole('button', { name: 'Save session S-M9V4' })).toBeTruthy();
  expect(getByRole('button', { name: 'Favorite S-M9V4' })).toBeTruthy();

  // Card is accessible
  expect(getByRole('button', { name: /U14 Boys.*Pressing.*60 min/ })).toBeTruthy();
});
```

### Accessibility Labels Matrix

| Component | Role | Expected Label |
|---|---|---|
| Login submit | button | "Sign In" |
| Save session | button | "Save session S-XXXX" / "Remove from vault S-XXXX" |
| Favorite | button | "Add to favorites" / "Remove from favorites" |
| Drill accordion | button | "Expand [drill name]" / "Collapse [drill name]" |
| Next drill (sideline) | button | "Next drill: [drill name]" |
| Generate | button | "Generate Session" |

### Screen Reader Testing (Manual)

Test with VoiceOver (iOS) and TalkBack (Android):
- [ ] Login form navigable in correct order
- [ ] Error messages announced on validation failure
- [ ] Session cards announce all key info
- [ ] Accordion state announced on toggle
- [ ] Sideline mode coaching points readable in sequence

---

## Device Matrix

### Must Pass (Tier 1)

| Device | OS | Screen |
|---|---|---|
| iPhone 15 Pro | iOS 17 | 6.1" |
| iPhone SE (3rd gen) | iOS 16 | 4.7" — smallest supported |
| Samsung Galaxy S24 | Android 14 | 6.2" |
| Google Pixel 7 | Android 13 | 6.3" |

### Should Pass (Tier 2)

| Device | OS | Screen |
|---|---|---|
| iPhone 15 Plus | iOS 17 | 6.7" large |
| iPad (10th gen) | iPadOS 17 | 10.9" tablet |
| Samsung Galaxy A54 | Android 13 | 6.4" mid-range |

### Critical Screen Tests

**iPhone SE (4.7" — smallest):**
- Login form: both fields visible, no overlap
- Session result: accordion scrolls correctly
- Sideline mode: coaching points readable (min 18px), diagram visible
- Bottom tab bar: all 5 tabs fit without truncation

**iPad (10th gen):**
- Forms use max-width 600px centered
- Session detail shows 2-column layout (drills list + detail)
- Vault shows 2-column card grid

---

## CI/CD Pipeline

### GitHub Actions Workflow

```yaml
# .github/workflows/mobile-ci.yml
name: Mobile CI

on:
  push:
    branches: [main, develop]
    paths: ['apps/mobile/**', 'packages/shared/**']
  pull_request:
    paths: ['apps/mobile/**']

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - run: pnpm install
      - name: Run unit tests
        run: pnpm --filter mobile test --coverage
      - name: Upload coverage
        uses: codecov/codecov-action@v3

  build-check:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm install -g eas-cli
      - run: eas build --platform all --profile preview --non-interactive
        env:
          EXPO_TOKEN: ${{ secrets.EXPO_TOKEN }}

  e2e-ios:
    runs-on: macos-latest
    needs: build-check
    steps:
      - uses: actions/checkout@v4
      - name: Install Maestro
        run: curl -Ls "https://get.maestro.mobile.dev" | bash
      - name: Run E2E flows
        run: maestro test e2e/flows/ --device "iPhone 15 Pro"
```

### Release Pipeline

```
main branch push
    │
    ├── Unit tests pass
    ├── Integration tests pass
    ├── E2E flows pass (iOS simulator)
    │
    ▼
EAS Build (production profile)
    │
    ├── iOS build → TestFlight (auto-submit)
    └── Android build → Google Play Internal (auto-submit)
    │
    ▼
Manual QA on TestFlight / Internal Track
    │
    ▼
Promote to App Store / Production
```

---

## Manual QA Checklists

### Pre-Release Checklist (Every Release)

#### Auth & Onboarding
- [ ] Fresh install → login screen shown
- [ ] Register with new email → verification email received
- [ ] Login → token persists after app restart
- [ ] Login with wrong password → correct error message
- [ ] Forgot password → reset email received → reset works
- [ ] Sign out → redirected to login, back button disabled

#### Generation
- [ ] Generate session (all age groups tested)
- [ ] Loading screen animates correctly
- [ ] Cancel generation works
- [ ] Session result renders all drills
- [ ] Accordion opens/closes correctly
- [ ] SVG diagrams render on iOS
- [ ] SVG diagrams render on Android
- [ ] Diagram fullscreen opens + pinch zoom works
- [ ] Save to vault works
- [ ] PDF export → share sheet opens with correct PDF
- [ ] Coach chat responds

#### Vault
- [ ] Sessions list loads
- [ ] Filter by age group narrows results
- [ ] Filter by game model narrows results
- [ ] Multiple filters combined work
- [ ] Search by keyword works
- [ ] Ref code lookup finds item
- [ ] Pull to refresh works
- [ ] Favorites toggle from list (optimistic)
- [ ] Favorites screen shows correct items

#### Video Analysis
- [ ] Gallery picker opens
- [ ] Camera records and returns video
- [ ] Analysis runs and returns result
- [ ] Observations display with correct severity
- [ ] Diagram frames carousel works
- [ ] Save analysis to vault
- [ ] Generate corrective session from analysis
- [ ] Delete saved analysis

#### Calendar
- [ ] Month view shows event dots
- [ ] Tapping date shows events
- [ ] Create event with session from vault
- [ ] Edit event works
- [ ] Delete event (confirm required)
- [ ] Weekly summary loads

#### Player Plans
- [ ] Create plan from session
- [ ] Plan detail shows all exercises
- [ ] PDF export shares correctly
- [ ] Share ref code via native share

#### Sideline Mode
- [ ] Enter with confirmation dialog
- [ ] Screen stays on
- [ ] Coaching points visible in sunlight (high contrast)
- [ ] Swipe left/right changes drills
- [ ] Haptic feedback on swipe
- [ ] Timer starts/pauses/resets
- [ ] Timer triggers haptic at zero
- [ ] Exit requires confirmation

#### Offline
- [ ] Airplane mode → network banner appears
- [ ] Vault loads from cache
- [ ] Session detail loads from cache
- [ ] Generate shows "requires connection"
- [ ] Reconnect → banner dismisses, data refreshes
- [ ] Sideline mode works offline

#### Notifications (device only)
- [ ] Permission requested on first calendar event
- [ ] 1-hour reminder fires correctly
- [ ] Day-before reminder fires correctly
- [ ] Tapping notification opens correct screen
- [ ] Deleting event cancels notifications
- [ ] Notification settings toggles respected

---

## Critical User Journeys

These represent the most important end-to-end flows. Any failure blocks release.

### Journey 1: New Coach Onboarding
```
Install app → Register → Verify email → Login →
View dashboard → Generate first session → Save to vault
```
**Test file:** `e2e/flows/onboarding.yaml`

---

### Journey 2: Pre-Practice Preparation
```
Login → Calendar → View today's session →
Open session → Enter Sideline Mode → Swipe through drills →
Exit → Share player plan PDF via WhatsApp
```
**Test file:** `e2e/flows/pre-practice.yaml`

---

### Journey 3: Post-Game Video Analysis
```
Login → Video tab → Record/upload clip →
Set context → Analyze → View observations →
Generate corrective session → Save session → Schedule in calendar
```
**Test file:** `e2e/flows/post-game-analysis.yaml`

---

### Journey 4: Weekly Planning
```
Login → Generate progressive series →
Schedule 4 sessions across 4 weeks →
Create player plans for each session →
Export and share PDFs with team
```
**Test file:** `e2e/flows/weekly-planning.yaml`

---

### Journey 5: Offline Access
```
Browse vault while online (cache populated) →
Enable airplane mode →
Open cached session →
Enter sideline mode →
Complete practice with offline diagrams
```
**Test file:** `e2e/flows/offline-access.yaml`

---

## Regression Suite

Run on every PR that touches core functionality:

```bash
# Fast regression (~5 minutes)
pnpm test --testPathPattern="auth|vault|generate"

# Full regression (~15 minutes)
pnpm test --coverage

# E2E regression (~30 minutes)
maestro test e2e/flows/ --device "iPhone 15 Pro"
maestro test e2e/flows/ --device "Pixel 7"
```

### Regression Test Tags

Tag tests with `@regression` for selective running:

```typescript
describe('Login Form @regression', () => {
  it.each([
    ['empty email', '', 'password', 'Email is required'],
    ['invalid email', 'notanemail', 'password', 'Enter a valid email'],
    ['short password', 'email@test.com', '12', 'Password must be at least 6 characters'],
  ])('validates: %s', async (_, email, password, error) => {
    // ...
  });
});
```

---

## Bug Report Template

When filing a bug found during testing, use this template:

```markdown
## Bug: [Short description]

**Phase:** Phase X — [Phase name]
**Severity:** Critical / High / Medium / Low
**Test ID:** [e.g., AUTH-002]

**Device:** iPhone 15 Pro / Samsung Galaxy S24
**OS:** iOS 17.2 / Android 14
**App version:** 1.0.0 (build 42)
**Network:** Online / Offline / Airplane mode

## Steps to Reproduce
1. ...
2. ...
3. ...

## Expected Behavior
[What should happen]

## Actual Behavior
[What actually happens]

## Screenshots / Screen Recording
[Attach]

## Console Logs / Error Messages
```
[Paste relevant logs]
```

## Possible Cause
[If known, suggest where to look]
```

---

## Test Data

### Mock User Objects

```typescript
// __tests__/mocks/data.ts
export const mockUser = {
  id: 'user-1',
  email: 'coach@test.com',
  name: 'Test Coach',
  role: 'COACH',
  plan: 'COACH_PRO',
  features: {
    canExportPDF: true,
    canAccessCalendar: true,
    canGenerateProgressiveSeries: true,
    canCreatePlayerPlans: true,
    canGenerateWeeklySummaries: true,
    canRunVideoAnalysis: true,
  },
  trialEndDate: null,
};

export const mockFreeUser = {
  ...mockUser,
  plan: 'FREE',
  features: {
    canExportPDF: false,
    canAccessCalendar: false,
    canGenerateProgressiveSeries: false,
    canCreatePlayerPlans: false,
    canGenerateWeeklySummaries: false,
    canRunVideoAnalysis: false,
  },
};

export const mockSession = {
  id: 'session-1',
  refCode: 'S-M9V4',
  ageGroup: 'U14_BOYS',
  playerLevel: 'INTERMEDIATE',
  coachLevel: 'USSF_C',
  gameModelId: 'PRESSING',
  phase: 'ATTACKING',
  zone: 'MIDDLE_THIRD',
  durationMinutes: 60,
  savedToVault: false,
  createdAt: '2026-01-15T10:00:00Z',
  drills: [mockDrill1, mockDrill2, mockDrill3, mockDrill4, mockDrill5, mockDrill6],
  skillFocus: {
    keySkills: ['Compactness', 'High Press', 'Trigger Moments'],
    coachingPoints: ['Body shape', 'Triggers'],
    psychologyAngle: 'Focus on collective pressing triggers',
  },
};
```
