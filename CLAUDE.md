# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Fantasy Football keeper selection system (Node.js/Express, modernized from a legacy Perl CGI app). Team owners select up to 3 keeper players for the upcoming season; selections are encrypted and stored server-side. Tests use the built-in `node:test` runner plus supertest (`npm test`); no linter is configured.

## Commands

```bash
npm install            # Install dependencies
npm start              # Start server (port from .env, currently 3100)
npm run dev            # Start with nodemon auto-reload
npm test               # Run the test suite (node --test)
npm run fetch-espn <year>      # Pull end-of-year rosters + transactions from ESPN into rosters/<year>/espn_data.json
npm run build-rosters <year>   # Merge draft exports + espn_data.json into final_rosters.json
npm run decrypt <team-name> <password>           # Print a team's saved keepers
npm run decrypt <team-name> <password> api=<n>   # Also submit keepers to the draft tracker API, starting at version n
```

## Deployment

The app runs as a systemd **user** service: `~/.config/systemd/user/ffkeepers.service` (enabled, with lingering on). Manage with `systemctl --user {status,restart} ffkeepers` and `journalctl --user -u ffkeepers`. The unit's `ExecStart` points at the nvm-versioned node binary (`~/.nvm/versions/node/v24.15.0/bin/node`) — update the path and `daemon-reload` after an nvm upgrade. Port 3000 is used by an unrelated app on this machine; this app uses 3100.

## Gitignored runtime state

`.env`, `data/`, and `node_modules/` are gitignored — a fresh clone will not run until `.env` is created (copy `.env.example`) and `npm install` is run. If `CURRENT_YEAR` is unset, the code falls back to the current calendar year and will fail unless `rosters/<that year>/final_rosters.json` exists; set it to the newest year directory that has one. `data/` is auto-created on first keeper submission.

## Architecture

### Data flow
1. `scripts/fetch-espn.js` (`npm run fetch-espn <year>`) pulls the league's end-of-year rosters and full transaction log from ESPN's fantasy API (`lm-api-reads.fantasy.espn.com`, league is private — needs `ESPN_S2`/`ESPN_SWID` cookies in `.env`) and writes a trimmed `rosters/<year>/espn_data.json`.
2. `scripts/build-rosters.js` (`npm run build-rosters <year>`) merges the year's draft exports — `rosters/<year>/{owners,players,draft_state}.json` — with `espn_data.json` into the app's single source of truth, `rosters/<year>/final_rosters.json`. Roster membership comes from ESPN (end-of-year, not the draft). Prices: drafted players keep their draft price (asserting the ESPN owner is the drafter); added players get their latest executed waiver `bid_amount` (asserted > 0); trade-only players retain their prior price. ESPN teams map to owners by member **first name** (never team names, which change yearly; `OWNER_ALIASES` in the script handles e.g. Jacqueline→Jackie). Any unresolvable player fails the build loudly.
3. `src/services/rosterService.js` reads only `final_rosters.json` (path resolved relative to the repo, or `ROSTERS_DIR`; tests use this override) and computes each player's keeper cost.
4. Frontend (`public/` — vanilla JS single-page app, no build step) fetches rosters via the REST API, user picks a team and up to 3 keepers plus a password. Teams are keyed by lowercased owner name (e.g. `adam`); the UI shows owner + fantasy team name and ESPN player headshots.
5. `src/routes/keepers.js` serializes selections as `"Name $cost"` strings joined by `/`, then `src/services/encryptionService.js` encrypts and writes `data/encrypted/{teamkey}.enc`.
6. Every submission appends the team's password **in plaintext** to `data/keepers.log` (intentional legacy recovery behavior — do not "fix").
7. `src/decrypt.js` is the CLI to read selections back; with `api=<n>` it also pushes them to a separate draft tracker service.

### Roster data format
`final_rosters.json`: `{year, teams: [{owner_id, owner_name, team_name, color, players: [{player_id, name, position, nfl_team, price, acquired: "draft"|"waiver"|"trade"}]}]}`. `player_id` is the ESPN player id (headshots come from `a.espncdn.com/i/headshots/nfl/players/full/<id>.png`; D/ST uses team logos). `price` is what the player last cost their current owner (draft or pickup price). `nfl_team` is a last-season snapshot — don't display it as current (it's only used for D/ST logos). Old years (2014–2024) exist only as legacy `ff<year>rosters.csv` files the app can no longer read.

### Keeper cost rule
`calculateKeeperCost()`: last year's cost + 10% (rounded), minimum $1 increase.

### Encryption
AES-256-CBC with a key derived as SHA-256 of the password; output is `hex(iv):hex(ciphertext)`. Decryption of a `.enc` file only needs the password — there is no server-side secret.

### Draft tracker integration (src/decrypt.js)
Fetches owners/players from `{API_BASE_URL}:8176/api/v1/{owners,players}` and POSTs each keeper to `{API_BASE_URL}:8175/api/v1/admin/draft` with `{owner_id, player_id, price, expected_version}`, incrementing `expected_version` per submission from the `api=<n>` argument. Team matching is case-insensitive against owner name or team name; player matching falls back to partial name match (which is what tolerates the stored `"Name $cost"` suffix).

## API Endpoints

- `GET /api/keepers/teams` — all teams (`{key, ownerName, teamName, color}`) and rosters keyed by team key
- `GET /api/keepers/team/:teamName` — one team's roster (owner key, case-insensitive)
- `POST /api/keepers/submit` — body `{team, players: [{name, cost}], password}` (max 3 players, enforced in frontend and backend)
- `POST /api/keepers/decrypt` — body `{team, password}`

## Configuration (.env)

- `PORT`: server port (currently 3100)
- `CURRENT_YEAR`: which `rosters/<year>/final_rosters.json` to load — bump when adding a new year's data
- `DATA_DIR`, `ENCRYPTED_DIR`, `LOG_FILE`: data storage locations (defaults under `./data/`)
- `API_BASE_URL`: draft tracker base URL for `decrypt.js` (default `http://localhost`; ports 8176/8175 are hardcoded)
