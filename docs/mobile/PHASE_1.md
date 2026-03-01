# Phase 1 — Auth, Navigation Shell & Home Dashboard

> **Duration:** Week 1–2
> **Goal:** Working app skeleton. User can register, log in, view the home dashboard, and navigate between all tabs. No generation yet — just the shell.

---

## Deliverables

- [ ] Expo project bootstrapped in `apps/mobile`
- [ ] Expo Router navigation shell (tab bar + auth stack)
- [ ] Login screen (email + password)
- [ ] Registration screen
- [ ] Email verification flow
- [ ] Forgot password / Reset password screens
- [ ] Home dashboard (quick actions + recent vault items + upcoming events)
- [ ] Settings / Profile screen
- [ ] JWT auth with auto-refresh
- [ ] Secure token storage
- [ ] Subscription plan + usage display
- [ ] Logout flow

---

## File Structure for This Phase

```
app/
├── _layout.tsx              Root layout — decides auth vs app
├── (auth)/
│   ├── _layout.tsx          Auth stack layout
│   ├── login.tsx            Login screen
│   ├── register.tsx         Registration screen
│   ├── verify-email.tsx     Email verification prompt
│   ├── forgot-password.tsx  Request reset email
│   └── reset-password.tsx   Enter new password
└── (tabs)/
    ├── _layout.tsx          Bottom tab bar
    ├── index.tsx            Home dashboard (Tab 1)
    ├── generate.tsx         Placeholder (Phase 2)
    ├── vault.tsx            Placeholder (Phase 3)
    ├── video.tsx            Placeholder (Phase 4)
    └── calendar.tsx         Placeholder (Phase 5)

components/
├── ui/
│   ├── Button.tsx
│   ├── Input.tsx
│   ├── Card.tsx
│   ├── Badge.tsx
│   ├── LoadingSpinner.tsx
│   └── ErrorMessage.tsx
├── auth/
│   ├── LoginForm.tsx
│   └── RegisterForm.tsx
└── dashboard/
    ├── QuickActionGrid.tsx
    ├── UsageBar.tsx
    ├── RecentVaultItem.tsx
    └── UpcomingEventItem.tsx

services/
├── api.ts                   Axios instance + interceptors
└── auth.service.ts          login, register, refresh, me, logout

stores/
└── auth.store.ts            Zustand auth store

hooks/
├── useAuth.ts               Auth state + actions
└── useUsage.ts              Current month usage stats

utils/
└── secure-store.ts          Wrappers around expo-secure-store
```

---

## Screen Specifications

### Root Layout (`app/_layout.tsx`)

**Logic:**
1. On mount, read `accessToken` from secure store.
2. If found → call `GET /auth/me` to validate.
3. If valid → navigate to `(tabs)`.
4. If invalid/expired → attempt refresh → navigate to `(tabs)` or `(auth)/login`.
5. If no token → navigate to `(auth)/login`.

**State handled:**
- `isLoading: true` while checking token → show splash screen.
- Auth state drives conditional rendering of stacks.

---

### Login Screen (`app/(auth)/login.tsx`)

**Fields:**
- Email (keyboard type: email-address, autocapitalize: none)
- Password (secureTextEntry)

**Actions:**
- `[Sign In]` → calls `POST /auth/login` → stores tokens → navigates to `(tabs)`
- `[Forgot password?]` → navigates to `forgot-password`
- `[Create account]` → navigates to `register`

**Validation (client-side):**
- Email: required, valid email format
- Password: required, minimum 6 characters

**Error states:**
- 401: "Invalid email or password"
- 403 (unverified): "Please verify your email first. [Resend email]"
- Network error: "Connection failed. Check your internet connection."

**UX details:**
- Keyboard avoiding view — fields scroll above keyboard on small screens
- Password field has show/hide toggle
- Submit button shows loading spinner during request
- Form is disabled during loading

---

### Register Screen (`app/(auth)/register.tsx`)

**Fields:**
- Full name
- Email
- Password
- Confirm password

**API:** `POST /auth/register`

**Post-registration flow:**
1. Success → navigate to `verify-email` with email in params.
2. Show message: "We sent a verification link to [email]."

**Validation:**
- Name: required, minimum 2 characters
- Email: required, valid format
- Password: required, minimum 8 characters
- Confirm: must match password

**Error states:**
- 409 (email taken): "An account with this email already exists."
- General: Display API error message.

---

### Email Verification Screen (`app/(auth)/verify-email.tsx`)

**Display:**
- Email address sent to (from route params)
- Instruction text
- `[Resend Email]` button → calls `POST /auth/resend-verification`
- `[I've verified, continue]` → attempts `GET /auth/me` → proceeds to app or shows error

**Resend throttle:** Disable resend button for 60 seconds after tap.

---

### Forgot Password (`app/(auth)/forgot-password.tsx`)

**Fields:** Email

**API:** `POST /auth/password/forgot`

**Success:** Always show "If that email exists, we sent a reset link." (security — don't confirm emails)

---

### Reset Password (`app/(auth)/reset-password.tsx`)

Accepts `token` from deep link: `tacticaledge://reset-password?token=xxx`

**Fields:**
- New password
- Confirm new password

**API:** `POST /auth/password/reset` with `{ token, newPassword }`

**Success:** Navigate to login with success banner.

---

### Home Dashboard (`app/(tabs)/index.tsx`)

**Sections:**

#### 1. Header
```
[Avatar initials]  Good morning, Coach [Name]!
                   [Plan badge] COACH_PRO
```

#### 2. Usage Bar
```
Sessions this month
████████████░░░  23 / 100

Drills this month
████░░░░░░░░░░░  87 / 500
```
Fetched from `GET /auth/usage`. Color: green < 60%, amber 60–85%, red > 85%.

#### 3. Quick Actions Grid (2×2)
```
[⚡ Generate Session]  [📋 Generate Drill]
[🎥 Video Analysis]   [📅 Calendar]
```
Each card navigates to the respective tab. Grayed out if user lacks the feature.

#### 4. Recent Vault Items
- Last 3 sessions from vault (`GET /vault/sessions?limit=3`)
- Each row: ref code, title, age group, date
- Tap → navigates to vault tab and opens session detail (Phase 3)
- "View all →" link to vault tab

#### 5. Upcoming Calendar Events
- Next 2 events (`GET /calendar/events?upcoming=true&limit=2`)
- Each row: date/time, session title, duration
- "View calendar →" link to calendar tab
- Hidden if user lacks `canAccessCalendar` feature

**Refresh:** Pull-to-refresh on entire scroll view. TanStack Query handles background refetch on focus.

---

### Settings Screen (`app/settings.tsx`)

Accessible via header avatar tap.

**Sections:**

#### Account
- Full name (editable) → `PATCH /auth/me`
- Email (display only — email changes require verify flow)
- Change password → navigates to change-password screen

#### Subscription
- Current plan name + badge
- Renewal date (if applicable)
- `[Manage Plan]` → opens Stripe customer portal via `POST /billing/customer-portal` → opens URL in browser

#### Usage This Month
- Sessions: used / limit with progress bar
- Drills: used / limit with progress bar
- Vault sessions: used / limit
- Vault drills: used / limit

#### Preferences (persisted in AsyncStorage)
- Default age group (dropdown)
- Default game model (dropdown)
These pre-fill the generation form in Phase 2.

#### Danger Zone
- `[Sign Out]` → confirm dialog → clears tokens → navigate to login

---

## API Calls in This Phase

| Screen | Method | Endpoint | Auth |
|---|---|---|---|
| Root layout | GET | `/auth/me` | Bearer |
| Login | POST | `/auth/login` | None |
| Register | POST | `/auth/register` | None |
| Verify email | POST | `/auth/resend-verification` | None |
| Forgot password | POST | `/auth/password/forgot` | None |
| Reset password | POST | `/auth/password/reset` | None |
| Dashboard | GET | `/auth/me` | Bearer |
| Dashboard | GET | `/auth/usage` | Bearer |
| Dashboard | GET | `/vault/sessions` | Bearer |
| Dashboard | GET | `/calendar/events` | Bearer |
| Settings | PATCH | `/auth/me` | Bearer |
| Settings | POST | `/billing/customer-portal` | Bearer |
| Token refresh | POST | `/auth/refresh` | Refresh token |

---

## Deep Links

Configure in `app.json`:

```json
{
  "expo": {
    "scheme": "tacticaledge",
    "intentFilters": [
      {
        "action": "VIEW",
        "data": [{ "scheme": "https", "host": "app.tacticaledge.app" }],
        "category": ["BROWSABLE", "DEFAULT"]
      }
    ]
  }
}
```

| Deep Link | Destination |
|---|---|
| `tacticaledge://reset-password?token=xxx` | Reset password screen |
| `tacticaledge://verify-email?token=xxx` | Email verification |

---

## Testing Scenarios — Phase 1

### AUTH-001: Successful Login

**Given** the user has a verified account
**When** they enter correct email and password and tap Sign In
**Then** tokens are stored in secure store, `/auth/me` is called, user lands on Home dashboard

```
Steps:
1. Launch app fresh (no stored token)
2. Observe login screen is shown
3. Enter: email=coach@test.com, password=Test1234!
4. Tap [Sign In]
5. Assert: loading spinner visible during request
6. Assert: user navigated to (tabs)/index
7. Assert: header shows user name
8. Assert: dashboard sections populated

API mock: POST /auth/login → { accessToken, refreshToken, user }
```

---

### AUTH-002: Login with Wrong Password

**Given** the user enters an incorrect password
**When** they tap Sign In
**Then** an inline error "Invalid email or password" appears, no navigation

```
Steps:
1. Enter email=coach@test.com, password=wrongpassword
2. Tap [Sign In]
3. Assert: error message shown below form
4. Assert: user remains on login screen
5. Assert: password field is NOT cleared

API mock: POST /auth/login → 401
```

---

### AUTH-003: Login with Unverified Email

**Given** user registered but hasn't verified email
**When** they attempt login
**Then** error shown with "Resend email" option

```
Steps:
1. Enter credentials for unverified account
2. Tap [Sign In]
3. Assert: error shown with [Resend Verification Email] button
4. Tap [Resend Verification Email]
5. Assert: POST /auth/resend-verification called
6. Assert: success toast shown

API mock: POST /auth/login → 403 { message: "Email not verified" }
```

---

### AUTH-004: Token Auto-Refresh

**Given** the user has an expired access token but valid refresh token
**When** the app starts or any API call returns 401
**Then** the interceptor automatically refreshes and retries

```
Steps:
1. Set expired accessToken in secure store
2. Set valid refreshToken in secure store
3. Launch app
4. Assert: POST /auth/refresh called automatically
5. Assert: new accessToken stored
6. Assert: user lands on home dashboard (not login)

API mock: GET /auth/me → 401, POST /auth/refresh → { accessToken }
```

---

### AUTH-005: Refresh Token Expired — Force Logout

**Given** both tokens are expired
**When** app starts
**Then** user is redirected to login, secure store is cleared

```
Steps:
1. Set expired accessToken in secure store
2. Set expired refreshToken in secure store
3. Launch app
4. Assert: POST /auth/refresh called
5. Assert: 401 received
6. Assert: secure store cleared (both tokens null)
7. Assert: user on login screen
8. Assert: no error toast (silent redirect)

API mock: GET /auth/me → 401, POST /auth/refresh → 401
```

---

### AUTH-006: Registration — Happy Path

```
Steps:
1. Tap [Create account] on login
2. Fill: name=Test Coach, email=new@test.com, password=Test1234!, confirm=Test1234!
3. Tap [Sign Up]
4. Assert: POST /auth/register called with correct body
5. Assert: navigated to verify-email screen
6. Assert: email=new@test.com shown on screen

API mock: POST /auth/register → 201 { message: "Verification email sent" }
```

---

### AUTH-007: Registration — Duplicate Email

```
Steps:
1. Fill registration form with existing email
2. Tap [Sign Up]
3. Assert: error "An account with this email already exists"
4. Assert: form remains filled (not cleared)

API mock: POST /auth/register → 409
```

---

### AUTH-008: Registration — Client Validation

```
Steps (test each individually):
1. Leave name empty → Assert: "Name is required"
2. Enter invalid email "notanemail" → Assert: "Enter a valid email"
3. Enter password "short" → Assert: "Password must be at least 8 characters"
4. Mismatch confirm password → Assert: "Passwords do not match"
5. Assert: no API call made in any of the above cases
```

---

### AUTH-009: Forgot Password Flow

```
Steps:
1. Tap [Forgot password?] on login
2. Enter email=coach@test.com
3. Tap [Send Reset Link]
4. Assert: POST /auth/password/forgot called
5. Assert: success message shown regardless of whether email exists
6. Assert: [Back to Login] button shown

API mock: POST /auth/password/forgot → 200
```

---

### AUTH-010: Deep Link — Password Reset

```
Steps:
1. Open app with URL: tacticaledge://reset-password?token=abc123
2. Assert: reset-password screen shown
3. Enter new password=NewPass123!, confirm=NewPass123!
4. Tap [Reset Password]
5. Assert: POST /auth/password/reset called with { token: "abc123", newPassword: "NewPass123!" }
6. Assert: navigated to login with success banner

API mock: POST /auth/password/reset → 200
```

---

### DASH-001: Dashboard Loads All Sections

```
Steps:
1. Login as COACH_PRO user with vault sessions and calendar events
2. Assert: usage bars show correct values from /auth/usage
3. Assert: 3 vault sessions listed in Recent section
4. Assert: 2 upcoming events listed
5. Assert: all 4 quick action buttons visible and enabled

API mocks:
  GET /auth/me → { plan: "COACH_PRO", name: "Test Coach" }
  GET /auth/usage → { sessionCount: 23, sessionLimit: 100, drillCount: 87, drillLimit: 500 }
  GET /vault/sessions → [session1, session2, session3]
  GET /calendar/events → [event1, event2]
```

---

### DASH-002: Dashboard Usage Bar Color States

```
Steps:
1. Login as user with 55% session usage → Assert: green bar
2. Login as user with 75% session usage → Assert: amber bar
3. Login as user with 95% session usage → Assert: red bar
4. Login as FREE user at limit → Assert: red bar + "Upgrade" prompt
```

---

### DASH-003: Free User — Feature Gates

```
Steps:
1. Login as FREE user
2. Assert: [Video Analysis] quick action is grayed out
3. Assert: [Calendar] quick action is grayed out
4. Tap grayed-out action
5. Assert: upgrade prompt modal shown

API mock: GET /auth/me → { plan: "FREE", features: { canAccessCalendar: false } }
```

---

### DASH-004: Pull to Refresh

```
Steps:
1. Load dashboard
2. Simulate pull-to-refresh gesture
3. Assert: all three API calls re-fired
4. Assert: data updated with new response
```

---

### SETTINGS-001: Update Profile Name

```
Steps:
1. Navigate to Settings
2. Tap name field, change to "Updated Coach"
3. Tap [Save]
4. Assert: PATCH /auth/me called with { name: "Updated Coach" }
5. Assert: success toast shown
6. Assert: header on home dashboard updates to "Updated Coach"

API mock: PATCH /auth/me → { ...user, name: "Updated Coach" }
```

---

### SETTINGS-002: Sign Out

```
Steps:
1. Tap [Sign Out] in Settings
2. Assert: confirmation dialog appears
3. Tap [Cancel] → Assert: user remains in settings
4. Tap [Sign Out] again → tap [Confirm]
5. Assert: POST /auth/logout called
6. Assert: secure store cleared
7. Assert: user navigated to login screen
8. Assert: back button from login doesn't go to app
```

---

## Acceptance Criteria for Phase 1

- [ ] Fresh app install shows login screen
- [ ] Successful login persists across app restarts (token stored)
- [ ] Expired token auto-refreshes without user action
- [ ] Double-expired token redirects to login silently
- [ ] All form validations work client-side before API calls
- [ ] API errors display human-readable messages
- [ ] Home dashboard loads and displays all 5 sections
- [ ] Feature-gated actions are visually disabled for FREE users
- [ ] Pull-to-refresh works on dashboard
- [ ] Settings screen reflects real user data
- [ ] Profile name update works and reflects immediately
- [ ] Sign out clears all state and tokens
- [ ] Password reset deep link opens correct screen
- [ ] App runs without errors on iOS 16+ and Android 12+
- [ ] No hardcoded strings (all text constants)
- [ ] All screens have safe area insets applied
- [ ] Keyboard avoiding behavior on all forms
