# Kid Daily Challenges App — Design

## 1. Design principles
1. **One thumb, one glance.** Every Kid Mode screen must be understandable in ~3 seconds and operable with one thumb.
2. **Big, few, obvious.** Few choices per screen, large tap targets, one primary action per card.
3. **Status is never just a color.** Every state (pending / waiting / done) pairs an icon + short word with its color.
4. **Parent stuff is one tap away, never one tap by accident.** A single gear icon + PIN separates the two modes; kids never see edit/delete controls.
5. **Positive by default.** No red "you failed" states — a missed challenge is just "not done yet," never scored negatively.

## 2. Information architecture

```
App
├── Kid Mode (default, no PIN)
│   ├── Home (Today) ── kid switcher, streak/points header, today's challenge cards
│   ├── Challenge detail / complete sheet ── mark done, camera for photo proof
│   ├── Prize Wall ── browse + redeem prizes, "my redemptions" status
│   └── My Badges ── earned badges, progress to next
│
└── Parent Mode (gear icon → PIN)
    ├── Approval Queue ── approve/reject pending completions (default landing screen)
    ├── Manage Kids ── add/edit kid profiles
    ├── Manage Challenges ── add/edit/deactivate, assign kids, frequency, photo-proof toggle
    ├── Manage Prizes ── add/edit prizes, mark redemptions fulfilled
    └── History & Stats ── per-kid log, weekly summary
```

Bottom tab bar in Kid Mode: **Today | Prizes | Badges**. Gear icon top-right on every
Kid Mode screen opens the PIN pad. Parent Mode uses a top tab bar (Queue / Kids /
Challenges / Prizes / History) with a clear "Exit Parent Mode" button always visible.

## 3. Key screens

### 3.1 Home / Today (Kid Mode)
- Header: kid avatar + name (tap to switch kid), points balance ("⭐ 120"), streak
  ("🔥 4 days").
- List of today's challenge cards, one per challenge:
  - Icon + title (e.g. "📖 Read 15 minutes")
  - State pill: `To do` (gray) → `Waiting for approval` (amber, clock icon) →
    `Approved!` (green, check icon), with a `Try again` (orange) state if rejected.
  - Tapping a `To do` card opens the **complete sheet**.
- Empty state (no challenges assigned): friendly illustration + "Ask a grown-up to add
  your first challenge!"

### 3.2 Complete sheet
- Slides up from bottom (modal), one screen, one job.
- Shows the challenge title/icon large.
- If photo proof required: a big "📷 Add photo" button must be filled before "I'm
  done!" activates.
- Primary button: "I'm done!" (large, full-width, green).
- Secondary: "Cancel."
- On confirm: short celebration animation, then card flips to `Waiting for approval`.

### 3.3 Prize Wall
- Grid of prize cards: icon, name, cost in points, "Redeem" button (disabled/greyed
  with points-needed label if the kid can't afford it yet — never hidden, so kids can
  see what to save toward).
- Tapping "Redeem" opens a confirm sheet ("Use 50 ⭐ for Ice cream trip?" Yes/No).
- "My Redemptions" section below the grid: list with status pill `Pending` (amber) →
  `Ready!` (green) once parent marks fulfilled.

### 3.4 My Badges
- Grid of badge icons; earned ones in full color, locked ones grayscale with a short
  "how to unlock" caption.

### 3.5 Parent PIN pad
- Full-screen numeric pad, 4-digit PIN, large digits, shake animation on wrong PIN
  (no lockout in v1 — this is a family device, not a security boundary).
- First run: "Set a PIN for Parent Mode" instead of "Enter PIN."

### 3.6 Approval Queue (Parent Mode default screen)
- List of pending items, each: kid avatar, challenge title, timestamp, photo thumbnail
  if present, and two large buttons: `✓ Approve` / `✕ Reject`.
- "Approve all" button at top when queue > 1.
- Empty state: "All caught up! 🎉"

### 3.7 Manage Challenges / Kids / Prizes
- Standard list + "+ Add" button + edit-in-place forms. These screens are utilitarian
  (parent-only, not designed for a 5-year-old), but keep the same visual language
  (rounded cards, same color system) so the app feels coherent.

### 3.8 History & Stats
- Per-kid selector, weekly summary card (challenges done / streak / points earned),
  scrollable day-by-day log below.

## 4. Visual style guide
- **Palette:** warm, high-contrast, colorblind-safe status colors.
  - Primary brand: sunny yellow `#FFC93C` + teal `#2EC4B6` accents.
  - Status: to-do `#9AA5B1` (gray), pending `#F5A623` (amber), approved `#2ECC71`
    (green), try-again `#FF7A59` (orange) — never red/green alone; always paired with
    an icon.
  - Background: off-white `#FDFBF7` (light), dark mode mirrors with `#1E2128` base.
- **Typography:** rounded, friendly sans-serif (system-ui / "Baloo"-style fallback),
  minimum 18px body text in Kid Mode, 24px+ for headers.
- **Shape:** large rounded corners (16–24px radius) on all cards/buttons, soft
  shadows, no sharp edges — signals "made for kids."
- **Icons:** emoji-first for Kid Mode (zero localization/asset cost, instantly
  legible to non-readers); simple line icons for Parent Mode chrome.
- **Motion:** short (<400ms), springy, never blocking — celebration confetti burst on
  approval, gentle card-flip on state change.

## 5. Data model (local storage, single JSON document)

```ts
AppState {
  parentPin: string | null            // 4-digit, null until first-run setup
  kids: Kid[]
  challenges: Challenge[]
  completions: Completion[]           // one row per (kid, challenge, date)
  prizes: Prize[]
  redemptions: Redemption[]
  badgesEarned: { kidId: string, badgeId: string, dateEarned: string }[]
  activeKidId: string
}

Kid { id, name, avatar (emoji), points, streak, lastStreakDate, createdAt }

Challenge {
  id, title, icon, category,
  points, requiresPhoto: bool,
  frequency: 'daily' | number[] (0-6 weekdays),
  assignedKidIds: string[],
  active: bool
}

Completion {
  id, challengeId, kidId, date (YYYY-MM-DD),
  status: 'pending' | 'approved' | 'rejected',
  photo: string | null (data URL),
  submittedAt, decidedAt, rejectReason
}

Prize { id, name, icon, cost, isRealWorld: bool, active: bool }

Redemption {
  id, prizeId, kidId, pointsSpent,
  status: 'pending' | 'fulfilled',
  redeemedAt, fulfilledAt
}
```

All state persists to `localStorage` under one key, read/written synchronously —
sufficient for a single-device app with no concurrent writers.

## 6. Core flows (sequence)

**Kid completes a challenge**
1. Kid taps card → complete sheet opens.
2. (If photo required) kid attaches photo.
3. Kid taps "I'm done!" → `Completion` row created, `status: pending`.
4. Card on Home updates to `Waiting for approval`.

**Parent approves**
1. Parent taps gear → PIN → lands on Approval Queue.
2. Taps `Approve` → completion `status: approved`, `decidedAt` set.
3. Kid's `points += challenge.points`; streak logic runs.
4. Badge check runs against updated totals; any new badge recorded.

**Kid redeems a prize**
1. Kid taps `Redeem` on an affordable prize → confirm sheet → confirm.
2. `Redemption` created `status: pending`, kid's points debited immediately.
3. Parent later opens Manage Prizes → marks `Fulfilled`.

## 7. Accessibility & error-proofing notes
- Every icon-only control has an `aria-label`.
- Complete sheet traps focus; Escape/back closes without side effects.
- Points never go negative; redeem button is disabled (not hidden) if unaffordable.
- No text below 14px anywhere, 18px+ in Kid Mode.
