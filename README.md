# Fantasy Football Keeper Selection System

A web application for managing fantasy football keeper selections. Team owners can select up to 3 players to keep for the next season, with encrypted storage of their selections. Keeper cost is last year's price + 10% (rounded), minimum $1 increase.

## Quick Start

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env — at minimum set CURRENT_YEAR to a year that has
   # rosters/<year>/final_rosters.json
   ```

3. **Start the server**
   ```bash
   npm start
   ```
   Open http://localhost:3100 (or whatever `PORT` you set).

## Yearly Data Refresh (end to end)

Run this once per year, after the season ends and before keeper selections open. It produces `rosters/<year>/final_rosters.json`, the single file the app reads.

### 1. Collect the draft exports

Create `rosters/<year>/` containing these files from the draft tool:

- `owners.json` — `[{id, owner_name, team_name, color}]`
- `players.json` — `[{id, first_name, last_name, team, position}]` (ids are ESPN player ids)
- `draft_state.json` — auction results; each team's `picks` with `player_id` and `price`

### 2. Refresh ESPN cookies (once a year)

The league is private, so the ESPN fetch needs your session cookies:

1. Log in at fantasy.espn.com and open DevTools (F12)
2. Application → Cookies → `https://fantasy.espn.com`
3. Copy `espn_s2` into `.env` as `ESPN_S2=` and `SWID` (braces included) as `ESPN_SWID=`

`ESPN_LEAGUE_ID` is also required in `.env`. The `espn_s2` cookie lasts about a year, so this usually needs doing once per refresh.

### 3. Fetch end-of-year data from ESPN

```bash
npm run fetch-espn <year>
```

Pulls every team's end-of-year roster and the full season transaction log from ESPN's API into `rosters/<year>/espn_data.json`.

### 4. Build the final rosters

```bash
npm run build-rosters <year>
```

Merges the draft exports with the ESPN data:

- **Who's on each team** comes from the ESPN end-of-year rosters
- **Drafted players** keep their auction price (the build fails if a player marked as drafted sits on a different owner's team than the draft says)
- **Added players** get their latest executed waiver bid (the build fails on a bid ≤ $0)
- **Traded players** retain the price from their last priced acquisition (waiver bid or draft)
- ESPN teams are matched to owners by member **first name** — team names change yearly. Name mismatches (e.g. Jacqueline→Jackie) live in `OWNER_ALIASES` in `scripts/build-rosters.js`

Any player it can't resolve fails the build with a named error — fix the data rather than working around it.

### 5. Point the app at the new year and restart

```bash
# in .env: CURRENT_YEAR=<year>
systemctl --user restart ffkeepers
```

### 6. Verify

```bash
npm test
curl -s localhost:3100/api/keepers/teams | head -c 300
```

Then load the page, pick a team, and spot-check a couple of players against ESPN (a known waiver pickup and a known draftee).

## Usage

### Web Interface

1. Select your team (shown as "Owner — Team Name")
2. Click up to 3 players to add them to the keeper slip
3. Enter a password to encrypt your selections
4. Submit

### Command Line Decrypt

```bash
npm run decrypt <team-name> <password>
```

`<team-name>` is the owner key, e.g. `adam`.

### Draft Tracker API Integration

The decrypt tool can also submit keeper selections to the draft tracker:

```bash
npm run decrypt <team-name> <password> api=<version>
```

- `api=<version>`: starting `expected_version` for API submissions (e.g. `api=1`), incremented per keeper
- Requires the draft tracker to be running; configure `API_BASE_URL` in `.env`

## Development

```bash
npm run dev    # auto-reload via nodemon
npm test       # node:test + supertest suite
```

## Deployment

Runs as a systemd user service (`~/.config/systemd/user/ffkeepers.service`):

```bash
systemctl --user {status,restart} ffkeepers
journalctl --user -u ffkeepers
```

The unit's `ExecStart` points at the nvm-managed node binary — update the path and `systemctl --user daemon-reload` after an nvm upgrade.

## Configuration (.env)

- `PORT`: server port (default 3000; this deployment uses 3100)
- `CURRENT_YEAR`: which `rosters/<year>/final_rosters.json` to load
- `DATA_DIR`, `ENCRYPTED_DIR`, `LOG_FILE`: data storage locations
- `API_BASE_URL`: draft tracker base URL for decrypt (default `http://localhost`)
- `ESPN_LEAGUE_ID`, `ESPN_S2`, `ESPN_SWID`: ESPN fantasy API access for `fetch-espn`
