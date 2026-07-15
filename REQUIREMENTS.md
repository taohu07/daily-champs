# Kid Daily Challenges App — Requirements

## 1. Purpose
A shared family app (phone/tablet) where a parent sets daily challenges (reading,
swimming, writing, chores, etc.) for their kid(s). The kid checks challenges off as
they complete them; the parent reviews and approves; approved challenges earn points
that can be redeemed for prizes.

## 2. Scope (from decisions with the user)
- **Platform:** Mobile web app (PWA) — installable to the home screen, works offline,
  no app store needed.
- **Users/device model:** One shared device. No login system. A **Kid Mode** (default,
  always open) and a PIN-gated **Parent Mode** live in the same app.
- **Completion flow:** Kid marks a challenge "Done" → it becomes **Pending** → parent
  approves or rejects (with optional PIN) → only approved challenges pay out points.
- **Photo proof:** Optional per-challenge setting. When on, the kid must attach a photo
  before a challenge can be submitted for approval.
- **Rewards:** Two layers —
  1. Virtual: points, daily streaks, badges, a visual "prize wall."
  2. Real-world: parent defines a redeemable prize list (e.g. "50 pts = ice cream
     trip"); kid redeems points for a prize; it enters a **Pending fulfillment** state;
     parent marks it fulfilled when actually delivered.

## 3. Users & Roles
| Role | Can do |
|---|---|
| Kid | View today's challenges, mark done, attach photo, view points/streak/badges, browse prize wall, redeem a prize (spends points immediately, delivery pending) |
| Parent | Everything a kid can do, plus: enter Parent Mode via PIN; create/edit/archive kids, challenges, and prizes; approve/reject pending challenge completions; mark redeemed prizes as fulfilled; view history/stats |

Multiple kid profiles are supported on the one shared device (siblings), selected via
a simple avatar switcher — this stays local/offline, no accounts.

## 4. Functional Requirements

### 4.1 Kid profiles
- FR1: Support 1+ kid profiles (name, avatar/emoji, birth year optional for age-appropriate defaults).
- FR2: Kid switcher accessible from the home screen without a PIN (kids should be able to switch to their own name freely).

### 4.2 Challenges
- FR3: Parent can create a challenge with: title, category/icon (reading, swimming, writing, chores, exercise, custom), point value, frequency (daily / specific weekdays), and whether photo proof is required.
- FR4: Each active kid gets that day's challenge list auto-generated at local midnight based on frequency rules.
- FR5: Parent can edit or deactivate (not hard-delete, to preserve history) a challenge.
- FR6: Parent can assign a challenge to one kid, several, or all kids.

### 4.3 Completing challenges (Kid Mode)
- FR7: Kid taps a challenge card to mark it "Done." If photo proof is required, the app opens the camera/photo picker first and blocks "Done" until a photo is attached.
- FR8: A completed-but-unapproved challenge shows a clear "Waiting for approval" state and does not yet count toward points/streak.
- FR9: Kid can undo a "Done" tap before parent approval (mistakes happen).
- FR10: Visual celebration (animation/confetti + sound-free by default) on marking done and again on approval, to keep motivation high without requiring sound.

### 4.4 Approval (Parent Mode)
- FR11: Parent Mode requires a 4-digit PIN, set on first run.
- FR12: Parent sees a single "Approval queue" listing all pending completions across kids, each with challenge name, kid, timestamp, and photo (if any).
- FR13: Parent can Approve (awards points, updates streak) or Reject (with an optional short reason) each item individually, or bulk-approve.
- FR14: Rejected items return to the kid's today list as "Try again."

### 4.5 Points, streaks, badges
- FR15: Approved challenges add their point value to the kid's balance.
- FR16: A daily streak counter increments when a kid gets at least one approval on a given day, and resets if a full day passes with none.
- FR17: Badges auto-award at milestones (e.g., 7-day streak, 50 total points, first swim challenge) — a fixed starter set, not configurable in v1.

### 4.6 Prizes
- FR18: Parent defines prizes: name, icon, point cost, optional "real-world" flag.
- FR19: Kid can redeem any prize they have enough points for; points are deducted immediately and the redemption enters "Pending fulfillment."
- FR20: Parent marks a redemption "Fulfilled" from Parent Mode; fulfilled redemptions move to history.
- FR21: Kid can view a running list of their redemptions and status.

### 4.7 History & stats
- FR22: Parent can view a per-kid history: completed challenges by day, approval/rejection log, redemption log.
- FR23: Simple weekly summary view (e.g., challenges completed this week, current streak, points earned).

## 5. Non-Functional Requirements
- NFR1: **Usable by early readers (~5+):** large tap targets (≥44px), icons/emoji paired with every text label, minimal text, no multi-step forms in Kid Mode.
- NFR2: **Offline-first:** all core flows (view challenges, mark done, view prizes) work with no network connection; data persists locally on the device.
- NFR3: **Fast:** app shell loads in <1s on repeat visits (installed PWA), no loading spinners for local actions.
- NFR4: **Safe defaults:** no external accounts, no data leaves the device, no ads, no in-app purchases.
- NFR5: **Resilient to mistakes:** every destructive or high-stakes action (delete challenge, reject completion) is reversible or confirmed.
- NFR6: **Accessible:** color is never the only signal (icons/text accompany status colors); minimum contrast for text; works with system font-size scaling.
- NFR7: **Installable:** valid web app manifest + service worker so it can be added to the home screen on iOS and Android and launches full-screen like a native app.

## 6. Out of Scope (v1)
- Multi-device sync / cloud accounts / login.
- Push notifications (device-local reminders could be a v2 addition).
- Social features (sharing, leaderboards between families).
- Payment processing for real-world prizes (fulfillment is tracked, not purchased).

## 7. Success Criteria
- A parent can, in under 2 minutes on first run: set a PIN, add a kid, add 3 challenges, add 2 prizes.
- A kid, unassisted, can find today's challenges, mark one done, and see it move to "waiting for approval" without any explanation from an adult.
- The app installs to a phone home screen and reopens instantly with all data intact after the browser is fully closed.
