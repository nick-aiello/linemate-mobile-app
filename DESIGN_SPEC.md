# Linemate Mobile App — Design Spec

## App Overview
Linemate is a hockey team management app. Coaches/managers set lineups, view history, manage rosters, chat with the team, and track stats/schedule. Built in React Native (Expo, bare workflow). Backend is a Cloudflare Worker at linemate-app.com.

## Brand
- **Primary red:** `#c0392b`
- **Background:** `#f5f2ec` (warm off-white)
- **Cards:** `#fff`
- **Text primary:** `#1a1a1a`
- **Text secondary:** `#888`
- **Text muted:** `#aaa` / `#bbb`
- **Border:** `#e0ddd8` / `#f0ede8`
- **Typography style:** ALL CAPS, tight letter spacing, bold/heavy weights throughout
- Each team has a custom `primaryColor` (hex) that replaces red as the accent where relevant

---

## Navigation Structure
5 bottom tabs inside a team context:
1. **Lineup** — the main lineup card
2. **Share** — share the lineup
3. **Team** — hub to sub-sections
4. **Chat** — team chat
5. **Account** — personal info + team settings

Top-level stack (before entering a team):
- **Login** — auth screen
- **Team Picker** — select which team to enter (admins see an "Admin" button)
- **Admin** — superadmin/admin management panel (accessible from Team Picker)

---

## Page 1 — Login
**File:** `src/screens/LoginScreen.js`

**Purpose:** Authenticate the user.

**UI Elements:**
- Linemate logo (PNG asset, hockey rink + wordmark)
- "Sign in to continue" subtitle
- Email/username text input
- Password text input (secure)
- "Log In" button (red, full width)
- Error message shown inline if login fails

**Notes:** Warm off-white background (`#f5f2ec`). White card centered on screen. Currently functional.

---

## Page 2 — Team Picker
**File:** `src/screens/TeamPickerScreen.js`

**Purpose:** After login, user picks which team to manage.

**UI Elements:**
- "My Teams" title
- List of team cards, each with:
  - Team name (bold, uppercase)
  - Division (if set)
  - Left border accent in team's `primaryColor`
- "Admin" button in top-right corner (only visible to superadmin/admin users) — navigates to Admin screen

**Notes:** Teams come from `GET /api/teams`. Each team card navigates into the 5-tab TeamTabs view.

---

## Page 3 — Lineup
**File:** `src/screens/LineupScreen.js`

**Purpose:** View and edit the current lineup card for a game.

**UI Elements:**
- Header: team logo (remote image) + team name
- Game Info Card (6 cells in a 3×2 grid): VS / Date / Time / Rink / Jersey / H/A
- Forwards grid: 3 columns (LW | C | RW), configurable number of lines (2–4)
- Defense grid: 2 columns (LD | RD), configurable pairs (2–3)
- Goalie column (G1, G2)
- Each player cell shows jersey number + first/last name
- Game Notes text area (shown when editing or if notes exist)
- "Mark as Set" / "Mark Pending" toggle button at bottom (green when set, red when pending)
- Header buttons (view mode): "Fill" (if ChillerStats configured) + "Edit"
- Header buttons (edit mode): "Cancel" + "Save"
- Player picker modal: search + list of roster players, slides up when a slot is tapped in edit mode

**Notes:** `isSet = true` means lineup is locked and shared with the team.

---

## Page 4 — Share
**File:** `src/screens/ShareScreen.js`

**Purpose:** Share the current lineup with teammates or outside the app.

**UI Elements:**
- Lineup preview card (compact read-only view of the current lineup with colored header)
- Three action rows:
  1. **Share Link** — opens native iOS share sheet with the team URL
  2. **Email Lineup** — opens mail app with formatted text lineup
  3. **Open in Browser** — opens the web lineup card in Safari
- URL hint text at bottom

**Notes:** Loads lineup from API on mount. No editing here.

---

## Page 5 — Team Hub
**File:** `src/screens/TeamHubScreen.js`

**Purpose:** Navigation hub for team-specific sub-sections.

**UI Elements:**
- Team name as section label
- 4 tappable cards:
  1. **Lineup History** — icon: clock
  2. **Roster** — icon: people
  3. **Schedule** — icon: calendar
  4. **Stats** — icon: bar chart
- Each card has: colored icon, title (bold, uppercase), subtitle, right chevron

**Notes:** Each card pushes the corresponding screen onto the Team nested stack navigator.

---

## Page 6 — Lineup History
**File:** `src/screens/HistoryScreen.js`

**Purpose:** View past saved lineups, apply them to the current lineup, or delete them.

**UI Elements:**
- List of history entries grouped by month (e.g. "Apr 2025" as a section header)
- Each entry card shows: opponent (or "Lineup"), date, result badge (W/L/OTL), score
- Tapping a card opens a full lineup detail modal (page sheet)
- Detail modal shows: opponent/date/rink header, "Apply to Current Lineup" button + "Delete" button, full lineup grid (forwards, defense, goalie), game notes

**Notes:** Apply requires confirmation alert. Delete requires destructive confirmation.

---

## Page 7 — Roster
**File:** `src/screens/RosterScreen.js`

**Purpose:** View and manage the team roster, request/manage subs.

**UI Elements:**
- View mode:
  - Players listed in two sections: Regulars and Subs
  - Each player row: jersey #, name, stats (GP/G/A/PTS/PIM), hot indicator (🔥 if on a scoring streak)
  - Tap player → opens Profile modal (email, phone, stats)
- Edit mode (Edit button in header):
  - Each row: jersey # input, name input, Sub toggle, remove (−) button
  - "Save" in header
- Sub Requests section below roster:
  - Open sub requests with player name, message, game date
  - "Fill" and "Cancel" buttons per request
  - "I Need a Sub" button to create a new request

**Notes:** Edit mode saves the full roster array to the API.

---

## Page 8 — Schedule
**File:** `src/screens/ScheduleScreen.js`

**Purpose:** View the team's game schedule synced from ChillerStats.

**UI Elements:**
- List of games grouped by month
- Each game row: date, time, opponent (home/away), rink, result/score badge if played
- Pull-to-refresh
- Empty state if no schedule loaded

**Notes:** Schedule data comes from `GET /api/teams/:id/schedule`.

---

## Page 9 — Stats
**File:** `src/screens/StatsScreen.js`

**Purpose:** View player stats for the season.

**UI Elements:**
- Stats table or list with columns: #, Player, GP, G, A, PTS, PIM
- Sortable by column (tapping a column header sorts by that stat)
- Highlight leader in each category

**Notes:** Stats come from `GET /api/teams/:id/stats` (ChillerStats data).

---

## Page 10 — Chat
**File:** `src/screens/ChatScreen.js`

**Purpose:** Team chat / message board.

**UI Elements:**
- Message list (reverse chronological, pull up to load more)
- Each message: sender name, timestamp, message body, emoji reactions
- Tap reaction to toggle it
- Text input + send button at bottom
- Keyboard-avoiding behavior

**Notes:** Messages come from `GET /api/teams/:id/chat`. Sends via `POST /api/teams/:id/chat`.

---

## Page 11 — Account (Settings)
**File:** `src/screens/SettingsScreen.js`

**Purpose:** View personal account info and configure team settings.

**Sections:**
1. **Account** — displays user name + role
2. **Team Settings:**
   - ChillerStats URL input (paste to configure integration)
   - Primary color (hex input + color swatch)
   - Division picker (action sheet)
   - Forward Lines stepper (2–4)
   - Defense Lines stepper (2–3)
   - Jerseys (home/away: color hex + label, both editable)
   - "Save Team Settings" button
3. **Notifications** (toggle switches):
   - Lineup Set
   - Game Reminders
   - Chat Messages
4. **Data:**
   - "Sync from ChillerStats" row (triggers roster + schedule sync)
5. **Sign Out** button

**Notes:** Team settings section only editable by team_manager, admin, superadmin roles (enforced server-side).

---

## Page 12 — Admin
**File:** `src/screens/AdminScreen.js`

**Purpose:** Superadmin/admin panel to manage all teams and users.

**UI Elements:**
- Summary cards: total teams count + total users count
- **Teams section:**
  - "+ Add" button → opens Team modal
  - List of all teams: color dot, name, division, slug
  - Tap team → opens Team edit modal
  - Team modal: name, primary color, division, ChillerStats ID → save or delete
- **Users section:**
  - "+ Add" button → opens User modal
  - List of all users: name, email, role badge (color-coded by role)
  - Tap user → opens User edit modal
  - User modal: first/last name, email, role selector, team assignments (multi-select), save; + reset password, delete

**Roles (in order):** `superadmin` > `admin` > `team_manager` > `team_member`

**Notes:** Accessible from Team Picker for admin/superadmin users only.

---

## Key API Endpoints (reference)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/login` | Login |
| GET | `/api/me` | Current user |
| GET | `/api/teams` | User's teams |
| GET | `/api/teams/:id/lineup` | Current lineup |
| POST | `/api/teams/:id/lineup` | Save lineup |
| POST | `/api/teams/:id/lineup/toggle` | Toggle isSet |
| GET | `/api/teams/:id/history` | Lineup history list |
| GET | `/api/teams/:id/history/:ts` | Single history entry |
| POST | `/api/teams/:id/history/:ts/apply` | Apply history to current |
| POST | `/api/teams/:id/history/:ts/delete` | Delete history entry |
| GET | `/api/teams/:id/roster` | Roster |
| POST | `/api/teams/:id/roster` | Save roster |
| GET | `/api/teams/:id/schedule` | Schedule |
| GET | `/api/teams/:id/stats` | Stats |
| GET | `/api/teams/:id/chat` | Chat messages |
| POST | `/api/teams/:id/chat` | Send message |
| GET | `/api/teams/:id/config` | Team config (colors, lines, jerseys, opponents, rinks) |
| GET | `/api/teams/:id/brand` | Brand settings |
| POST | `/api/teams/:id/brand` | Save brand |
| POST | `/api/teams/:id/sync` | Sync from ChillerStats |
| GET | `/api/teams/:id/next-game` | Next game from ChillerStats |
| GET | `/api/teams/:id/notifications` | Notification prefs |
| POST | `/api/teams/:id/notifications` | Save notification prefs |
| GET | `/api/admin/teams` | All teams (admin) |
| GET | `/api/admin/users` | All users (admin) |
| POST | `/api/admin/teams/create` | Create team |
| POST | `/api/admin/teams/:slug/edit` | Edit team |
| POST | `/api/admin/teams/:slug/delete` | Delete team |
| POST | `/api/admin/users/create` | Create user |
| POST | `/api/admin/users/:id/update` | Update user |
| POST | `/api/admin/users/:id/reset-password` | Reset password |
| POST | `/api/admin/users/:id/delete` | Delete user |
