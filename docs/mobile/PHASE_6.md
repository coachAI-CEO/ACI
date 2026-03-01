# Phase 6 — Sideline Mode, Offline Cache & Push Notifications

> **Duration:** Week 12–13
> **Goal:** Make the app usable pitch-side in poor connectivity conditions. Sideline mode strips the UI to essential drill information. Offline cache lets coaches access saved sessions without internet. Push notifications remind coaches of scheduled sessions.

---

## Deliverables

- [ ] Sideline Mode — stripped UI for pitch use
- [ ] Swipe-between-drills navigation in Sideline Mode
- [ ] Drill timer in Sideline Mode
- [ ] High-contrast mode support
- [ ] Offline vault cache (read-only) via AsyncStorage
- [ ] Cache staleness indicator
- [ ] Network status banner
- [ ] Push notification setup (expo-notifications)
- [ ] Session reminder notifications (1 hour before, day before)
- [ ] Weekly summary push notification
- [ ] Notification settings screen
- [ ] Background sync when connectivity restored
- [ ] App badge count for upcoming sessions

---

## File Structure for This Phase

```
app/
└── sideline/
    └── [sessionId].tsx            Sideline mode screen

components/
├── sideline/
│   ├── SidelineScreen.tsx         Main sideline layout
│   ├── SidelineDrillView.tsx      Single drill — large font, minimal
│   ├── SidelineTimer.tsx          Countdown timer for drill duration
│   ├── SidelineNavBar.tsx         Prev / Next drill buttons
│   └── SidelineHeader.tsx         Session title + exit button
├── offline/
│   ├── NetworkBanner.tsx          Top banner when offline
│   ├── CacheStaleIndicator.tsx    "Last updated X ago" note
│   └── OfflineEmptyState.tsx      Empty state when no cache
└── notifications/
    └── NotificationSettings.tsx   Per-type notification toggles

services/
├── offline-cache.service.ts       Read/write vault to AsyncStorage
├── network.service.ts             NetInfo wrapper + reactive state
└── notifications.service.ts       expo-notifications setup + scheduling

stores/
├── offline.store.ts               Cache state + staleness
└── network.store.ts               isOnline boolean

hooks/
├── useOfflineVault.ts             Reads from cache when offline
├── useNetworkStatus.ts            Reactive online/offline
└── useNotifications.ts            Permission + schedule helpers
```

---

## Screen Specifications

### Sideline Mode Entry

Accessible from two places:
1. Session detail action bar → `[⚽ Sideline]` button
2. Calendar event card → `[Start Practice]` button

On entry:
- Lock screen orientation to landscape-friendly layout (optional: let coach choose)
- Prevent screen from sleeping (`expo-keep-awake`)
- Use maximum screen brightness
- Hide all navigation UI (tab bar hidden)

**Confirm entry dialog:**
```
┌──────────────────────────────────┐
│  Start Sideline Mode?            │
│                                  │
│  • Screen stays on               │
│  • Large text for easy reading   │
│  • Swipe left/right to switch    │
│    between drills                │
│                                  │
│  [Start]        [Cancel]         │
└──────────────────────────────────┘
```

---

### Sideline Mode Screen (`app/sideline/[sessionId].tsx`)

**Portrait layout:**

```
┌─────────────────────────────────┐
│  S-M9V4 · Drill 2/6       [✕] │  ← thin header, exit = confirm
│─────────────────────────────────│
│                                 │
│  Rondos 4v2                     │  ← 28px bold
│  Technical · 15 min             │  ← 16px muted
│─────────────────────────────────│
│                                 │
│  [SVG Diagram — full width]     │  ← 200px tall
│                                 │
│─────────────────────────────────│
│  COACHING POINTS                │  ← 11px label
│                                 │
│  1  Trigger on back pass        │  ← 20px, numbered
│                                 │
│  2  Body shape before ball      │
│                                 │
│  3  Compactness when pressing   │
│                                 │
│─────────────────────────────────│
│  ⏱️ 12:43        [▶ Start]      │  ← timer
│─────────────────────────────────│
│  [◀ Warmup]           [T.Press ▶]│  ← prev / next drill names
└─────────────────────────────────┘
```

**Design rules:**
- Background: pure black (zinc-950 or `#000`)
- Text: pure white for max contrast on sunlit screens
- Font size minimum 18px for coaching points
- Max 3 coaching points shown (top 3 by order)
- No menus, no nav bars, no distractions
- `[✕]` to exit requires confirmation ("End practice mode?")

**Swipe gestures:**
- Swipe left → next drill (with haptic feedback via `expo-haptics`)
- Swipe right → previous drill
- Swipe up → fullscreen diagram (pinch-zoom)

Implemented with `react-native-gesture-handler` `PanGestureHandler` + `react-native-reanimated` slide animation.

---

### Sideline Timer

Optional drill timer in Sideline Mode:

**States:**
```
Stopped:  ⏱️ 15:00  [▶ Start]
Running:  ⏱️ 12:43  [⏸ Pause]  [⏹ Reset]
Paused:   ⏱️ 12:43  [▶ Resume] [⏹ Reset]
Done:     ⏱️ 00:00  [✓ Done — swipe to next drill]
```

When timer hits 00:00:
- Haptic vibration (long burst via `expo-haptics`)
- Screen flashes briefly (white flash, 200ms)
- Auto-suggests "Swipe to next drill"

Timer state is local only — no API call. Resets when switching drills.

---

### Sideline Mode Exit

Tapping `[✕]`:
```
┌──────────────────────────────────┐
│  End practice mode?              │
│                                  │
│  [End Practice]   [Keep Going]  │
└──────────────────────────────────┘
```

On exit:
- Release screen wake lock (`expo-keep-awake`)
- Navigate back to session detail
- Restore normal brightness

---

## Offline Cache System

### Strategy

Cache is read-only. Coaches can browse previously loaded vault sessions offline. All write operations (generate, save, schedule) require connectivity.

**Cache layers:**

```
Online request
    │
    ▼
TanStack Query (in-memory, cleared on app restart)
    │
    ▼ (background, after every successful load)
AsyncStorage cache (persists across restarts)
    │
    ▼ (when online = false)
Read from AsyncStorage cache
```

**What gets cached:**
- Vault session list (last loaded result)
- Individual session detail (each session viewed, up to 50 most recent)
- Drill details (within cached sessions)
- User profile + features (for feature gate checks)

**What is NOT cached:**
- Generation results (ephemeral — always requires network)
- Video analysis
- Calendar events (requires accurate time data)

---

### Cache Service (`services/offline-cache.service.ts`)

```typescript
// Key format
const KEYS = {
  vaultSessions: 'cache:vault:sessions',
  sessionDetail: (id: string) => `cache:session:${id}`,
  userProfile: 'cache:user:profile',
  cacheTimestamps: 'cache:timestamps',
};

// Max entries
const MAX_CACHED_SESSIONS = 50;

// Staleness threshold
const STALE_AFTER_MS = 24 * 60 * 60 * 1000; // 24 hours

interface CacheEntry<T> {
  data: T;
  cachedAt: number; // unix timestamp
}

async function cacheSession(session: Session): Promise<void>;
async function getCachedSession(sessionId: string): Promise<Session | null>;
async function getCachedVaultList(): Promise<Session[] | null>;
async function isCacheStale(key: string): Promise<boolean>;
async function clearCache(): Promise<void>;
```

---

### Network Status Hook

```typescript
// hooks/useNetworkStatus.ts
import NetInfo from '@react-native-community/netinfo';

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOnline(state.isConnected && state.isInternetReachable);
    });
    return unsubscribe;
  }, []);

  return { isOnline };
}
```

---

### Network Banner Component

Shown as a top-of-screen banner whenever `isOnline === false`:

```
┌──────────────────────────────────┐
│  📵 No internet connection       │
│     Showing cached content       │
└──────────────────────────────────┘
```

Yellow/amber background. Auto-dismisses when connectivity restored (show green "Back online" for 2 seconds).

---

### Offline Behavior per Screen

| Screen | Online | Offline |
|---|---|---|
| Home Dashboard | Live data | Cached user profile, no usage/events |
| Vault Sessions | Live list | Cached list with stale indicator |
| Session Detail | Live data | Cached if previously viewed |
| Generate | Full functionality | Disabled — show "Requires connection" |
| Video Analysis | Full functionality | Disabled |
| Calendar | Full functionality | Disabled |
| Sideline Mode | Works (no network needed) | Works fully |
| Player Plans | Live | Disabled for create; cached for view |

---

### Cache Stale Indicator

When showing cached data, display a subtle notice:

```
┌──────────────────────────────────┐
│  Vault (showing cached data)     │
│  Last updated: 3 hours ago  [↻] │
│──────────────────────────────────│
│  [session cards...]              │
└──────────────────────────────────┘
```

Tapping `[↻]` forces a refresh (requires network — if offline, show brief "Still offline" feedback).

---

### Background Sync

When connectivity restores after offline period:
1. `NetInfo` event fires `isConnected: true`
2. `TanStack Query` auto-refetches all active queries
3. Cache is updated with fresh data
4. Green "Back online" banner shown briefly
5. Stale indicators removed

---

## Push Notifications

### Notification Types

| Type | Trigger | Content | Setting Key |
|---|---|---|---|
| Session reminder (1hr) | 1 hour before calendar event | "Practice in 1 hour: U14 Pressing" | `notif_session_1hr` |
| Session reminder (day before) | Day before at 6 PM | "Practice tomorrow: U14 Pressing" | `notif_session_day` |
| Weekly summary ready | Monday 8 AM | "Your weekly coaching summary is ready" | `notif_weekly_summary` |

---

### Notification Setup (`services/notifications.service.ts`)

```typescript
async function requestPermission(): Promise<boolean>;
async function scheduleSessionReminder(event: CalendarEvent): Promise<string>; // returns notifId
async function cancelSessionReminder(notifId: string): Promise<void>;
async function scheduleWeeklySummaryNotification(): Promise<void>;
async function cancelAllNotifications(): Promise<void>;
```

**Permission flow:**
1. First calendar event creation → request notification permission
2. If denied → silently skip (don't spam permission dialogs)
3. Settings screen → "Enable notifications" toggle → prompts if not granted

---

### Notification Settings Screen (in Settings)

```
Notifications
─────────────────────────────────
Session Reminders
  1 hour before practice   [●]  ← toggle
  Day before practice       [●]

AI Summaries
  Weekly summary ready      [○]  ← disabled

─────────────────────────────────
[Open iOS Notification Settings →]
```

All toggles stored in AsyncStorage and respected when scheduling notifications.

---

### App Badge

On iOS, set app badge count = number of events today + tomorrow.

```typescript
async function updateBadgeCount(events: CalendarEvent[]) {
  const upcoming = events.filter(e => isToday(e.date) || isTomorrow(e.date));
  await Notifications.setBadgeCountAsync(upcoming.length);
}
```

Clear badge when user opens calendar tab.

---

## Testing Scenarios — Phase 6

### SIDELINE-001: Enter and Navigate Sideline Mode

```
Steps:
1. Open session S-M9V4 (6 drills)
2. Tap [Sideline] in action bar
3. Assert: confirmation dialog shown
4. Tap [Start]
5. Assert: sideline screen shown with Drill 1
6. Assert: tab bar is hidden
7. Assert: screen stays on (keep-awake active)
8. Assert: first 3 coaching points shown in large text
9. Swipe left → Assert: Drill 2 shown with slide animation
10. Assert: haptic feedback on swipe
11. Swipe right → Assert: Drill 1 shown again

State: session with 6 drills loaded into sideline store
```

---

### SIDELINE-002: Sideline Timer

```
Steps:
1. In Sideline Mode, Drill 1 (15 min timer)
2. Tap [▶ Start]
3. Assert: timer counts down from 15:00
4. Assert: status shows "Running"
5. Tap [⏸ Pause] at 12:43
6. Assert: timer frozen at 12:43
7. Tap [▶ Resume]
8. Assert: timer resumes from 12:43
9. Advance time to 00:00 (mock)
10. Assert: haptic vibration triggered
11. Assert: "Time's up! Swipe to next drill" shown
```

---

### SIDELINE-003: Sideline Mode Exit

```
Steps:
1. Enter Sideline Mode
2. Tap [✕]
3. Assert: confirm dialog "End practice mode?"
4. Tap [Keep Going] → Assert: still in sideline mode
5. Tap [✕] again → tap [End Practice]
6. Assert: navigated back to session detail
7. Assert: tab bar visible again
8. Assert: screen brightness returns to normal
```

---

### SIDELINE-004: Sideline Works Offline

```
Steps:
1. Load session S-M9V4 while online (session cached)
2. Enable airplane mode
3. Open sideline mode for same session
4. Assert: sideline mode loads from cache
5. Assert: all drills accessible
6. Assert: diagrams render (from cache)
7. Assert: no error messages

Network: disabled
Cache: session pre-loaded from prior online visit
```

---

### OFFLINE-001: Vault Loads from Cache When Offline

```
Steps:
1. Open app online — vault loads 20 sessions
2. Enable airplane mode
3. Assert: yellow network banner appears at top
4. Navigate to Vault tab
5. Assert: sessions shown from cache
6. Assert: "Last updated: 2 minutes ago" stale indicator shown
7. Assert: no error state

Network: disabled
Cache: vault list cached from step 1
```

---

### OFFLINE-002: Generate Disabled When Offline

```
Steps:
1. Enable airplane mode
2. Navigate to Generate tab
3. Assert: all form fields visible
4. Assert: [Generate Session] button is disabled
5. Assert: message shown: "Requires internet connection"
6. Restore network
7. Assert: button re-enables automatically

Hook: useNetworkStatus → isOnline
```

---

### OFFLINE-003: Session Detail Loads from Cache

```
Steps:
1. Online: open session S-M9V4 (cached to AsyncStorage)
2. Enable airplane mode
3. Navigate to Vault → tap S-M9V4
4. Assert: session detail loaded from cache
5. Assert: all drills with diagrams shown
6. Assert: stale indicator shown in header

Cache: session detail cached in prior step
```

---

### OFFLINE-004: Session Detail Not in Cache

```
Steps:
1. Enable airplane mode (never viewed this session before)
2. Tap session S-ZZZZ from vault list (it's in list cache, not detail cache)
3. Assert: offline empty state shown
4. Assert: message "This session isn't available offline"
5. Assert: [Go back] button shown (no error crash)
```

---

### OFFLINE-005: Background Sync on Reconnect

```
Steps:
1. Go offline — browse cached vault
2. Reconnect to network
3. Assert: green "Back online" banner briefly shown
4. Assert: TanStack Query auto-refetches vault list
5. Assert: stale indicator removed
6. Assert: list updates with any new sessions added while offline
```

---

### NOTIF-001: Permission Request on First Event Creation

```
Steps:
1. Login as user with no previous notification permission grant
2. Create a calendar event (POST /calendar/events succeeds)
3. Assert: iOS/Android notification permission dialog shown
4. Grant permission
5. Assert: local notification scheduled for 1 hour before event
6. Assert: another scheduled for day before at 6 PM (if > 1 day away)

Platform: iOS (permission dialog is platform-native)
```

---

### NOTIF-002: Permission Denied — No Crash

```
Steps:
1. Deny notification permission when prompted
2. Assert: no error shown to user
3. Assert: event still created successfully
4. Assert: Settings screen shows "Enable notifications" toggle (off)
5. Tap toggle → Assert: re-prompts permission (iOS deep link to Settings)

No side effects from denied permission
```

---

### NOTIF-003: Session Reminder Fires

```
Steps:
1. Create event for 1 hour in the future
2. Assert: notification scheduled via expo-notifications
3. Advance system time to 1 hour before event
4. Assert: notification delivered: "Practice in 1 hour: U14 Pressing · S-M9V4"
5. Tap notification
6. Assert: app opens to calendar event detail for that session

Platform: requires physical device for accurate testing
Mock alternative: call scheduleSessionReminder() directly and verify scheduled notif
```

---

### NOTIF-004: Cancel Notification on Event Delete

```
Steps:
1. Create event → notifications scheduled (capture notifIds)
2. Delete the event (DELETE /calendar/events/:id)
3. Assert: cancelSessionReminder(notifId) called
4. Assert: notification removed from scheduled list
5. Assert: notification does NOT fire

Verify: Notifications.getAllScheduledNotificationsAsync() does not include the cancelled id
```

---

### NOTIF-005: Notification Settings Toggles

```
Steps:
1. Navigate to Settings → Notifications
2. Toggle off "1 hour before practice"
3. Create a new calendar event
4. Assert: only "day before" notification scheduled (not 1-hour one)
5. Toggle off "day before" too
6. Create another event
7. Assert: no notifications scheduled

AsyncStorage: notif_session_1hr = false
```

---

### BADGE-001: App Badge Shows Upcoming Sessions

```
Steps:
1. Have 2 events today, 1 event tomorrow
2. Exit app
3. Assert: app icon badge shows "3"
4. Open app, navigate to Calendar tab
5. Assert: badge clears to "0"

Platform: iOS only (Android badges are per-notification)
```

---

## Acceptance Criteria for Phase 6

- [ ] Sideline Mode enters with confirmation dialog
- [ ] Sideline Mode shows large text coaching points (max 3)
- [ ] Sideline Mode hides tab bar and navigation UI
- [ ] Swipe left/right navigates between drills with animation + haptic
- [ ] Drill timer counts down, pauses/resumes, triggers haptic at zero
- [ ] Sideline Mode exit requires confirmation
- [ ] Screen stays awake in Sideline Mode (released on exit)
- [ ] Sideline Mode works fully offline (no network needed)
- [ ] Vault list loads from AsyncStorage cache when offline
- [ ] Session detail loads from cache when offline (if previously viewed)
- [ ] Generate/Video/Calendar show "requires connection" when offline
- [ ] Yellow "no internet" banner appears when connectivity lost
- [ ] Green "back online" banner appears briefly when restored
- [ ] TanStack Query auto-refetches on reconnect
- [ ] Stale indicator shows last update time on cached content
- [ ] Notification permission requested on first calendar event
- [ ] Denied permission causes no crash or error UI
- [ ] Session reminders scheduled 1hr before and day before events
- [ ] Reminders cancelled when event is deleted
- [ ] Notification settings toggles respected when scheduling
- [ ] App badge shows today+tomorrow event count on iOS
- [ ] Badge clears when calendar tab opened
