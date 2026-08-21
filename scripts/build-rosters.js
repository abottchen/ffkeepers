#!/usr/bin/env node
// Merges a year's draft exports (owners.json, players.json, draft_state.json)
// with the ESPN end-of-year snapshot (espn_data.json, produced by
// scripts/fetch-espn.js) into the app's single source of truth,
// final_rosters.json. Usage: npm run build-rosters <year>
//
// Rules (see CLAUDE.md):
// - Roster membership comes from the ESPN end-of-year rosters.
// - DRAFT players keep their draft price; the ESPN owner must match the
//   owner who drafted them.
// - ADD players get the bid amount of their latest executed add (always > 0).
// - TRADE players retain the price of their last acquisition that had one
//   (a waiver bid, or their draft price).

const fs = require('fs');
const path = require('path');

// ESPN member first names that differ from owners.json owner names.
// steve -> yash: Yash replaced Steve for 2026 and inherits his end-of-year roster.
const OWNER_ALIASES = { jacqueline: 'jackie', steve: 'yash' };

function buildFinalRosters({ year, owners, players, draftState, espnData }) {
    const playersById = new Map(players.map(p => [p.id, p]));
    const dstByNickname = new Map(
        players.filter(p => p.position === 'D/ST').map(p => [p.last_name.toLowerCase(), p])
    );

    const draftPickByPlayerId = new Map();
    for (const team of draftState.teams) {
        for (const pick of team.picks) {
            draftPickByPlayerId.set(pick.player_id, pick);
        }
    }

    const ownerForEspnTeam = (espnTeam) => {
        const first = espnTeam.owner_first_name.toLowerCase();
        const name = OWNER_ALIASES[first] || first;
        const owner = owners.find(o => o.owner_name.toLowerCase() === name);
        if (!owner) {
            throw new Error(`ESPN team "${espnTeam.team_name}" owner "${espnTeam.owner_first_name}" matches no owner in owners.json`);
        }
        return owner;
    };

    // players.json entry for an ESPN roster player, or null for someone
    // outside the draft pool (e.g. a veteran added mid-season)
    const resolvePlayer = (espnPlayer) => {
        if (espnPlayer.espn_player_id < 0) {
            const nickname = espnPlayer.name.replace(/ D\/ST$/, '').toLowerCase();
            const dst = dstByNickname.get(nickname);
            if (!dst) {
                throw new Error(`D/ST "${espnPlayer.name}" not found in players.json`);
            }
            return dst;
        }
        return playersById.get(espnPlayer.espn_player_id) || null;
    };

    const latestExecutedAdd = (playerId) => {
        let latest = null;
        for (const tx of espnData.transactions) {
            if (tx.status !== 'EXECUTED') continue;
            if (!tx.items.some(i => i.type === 'ADD' && i.player_id === playerId)) continue;
            if (!latest || tx.process_date > latest.process_date) latest = tx;
        }
        return latest;
    };

    const resolvePrice = (espnPlayer, localPlayer, owner) => {
        const draftPlayerId = localPlayer ? localPlayer.id : espnPlayer.espn_player_id;

        if (espnPlayer.acquisition_type === 'DRAFT') {
            const pick = draftPickByPlayerId.get(draftPlayerId);
            if (!pick) {
                throw new Error(`${espnPlayer.name} is DRAFT on ESPN but has no pick in draft_state.json`);
            }
            if (pick.owner_id !== owner.id) {
                const drafter = owners.find(o => o.id === pick.owner_id);
                throw new Error(
                    `${espnPlayer.name} is on ${owner.owner_name}'s ESPN roster as DRAFT but was drafted by ${drafter ? drafter.owner_name : pick.owner_id}`
                );
            }
            return { price: pick.price, acquired: 'draft' };
        }

        // ADD or TRADE: last acquisition with a price wins
        const add = latestExecutedAdd(espnPlayer.espn_player_id);
        if (add) {
            if (!(add.bid_amount > 0)) {
                throw new Error(`${espnPlayer.name} was added with a non-positive bid ($${add.bid_amount}) — check the ESPN data`);
            }
            return { price: add.bid_amount, acquired: 'waiver' };
        }

        if (espnPlayer.acquisition_type === 'TRADE') {
            const pick = draftPickByPlayerId.get(draftPlayerId);
            if (pick) {
                return { price: pick.price, acquired: 'trade' };
            }
        }

        throw new Error(`${espnPlayer.name} (${espnPlayer.acquisition_type}) has no acquisition transaction or draft pick to price from`);
    };

    const teamsByOwnerId = new Map();
    for (const espnTeam of espnData.teams) {
        const owner = ownerForEspnTeam(espnTeam);
        if (teamsByOwnerId.has(owner.id)) {
            throw new Error(`Owner ${owner.owner_name} matched more than one ESPN team`);
        }

        teamsByOwnerId.set(owner.id, espnTeam.players.map(espnPlayer => {
            const localPlayer = resolvePlayer(espnPlayer);
            const { price, acquired } = resolvePrice(espnPlayer, localPlayer, owner);
            return {
                player_id: localPlayer ? localPlayer.id : espnPlayer.espn_player_id,
                name: localPlayer ? `${localPlayer.first_name} ${localPlayer.last_name}` : espnPlayer.name,
                position: localPlayer ? localPlayer.position : espnPlayer.position,
                nfl_team: localPlayer ? localPlayer.team : '',
                price,
                acquired
            };
        }));
    }

    return {
        year,
        teams: owners.map(owner => ({
            owner_id: owner.id,
            owner_name: owner.owner_name,
            team_name: owner.team_name,
            color: owner.color,
            players: teamsByOwnerId.get(owner.id) || []
        }))
    };
}

function main() {
    const year = process.argv[2];
    if (!year) {
        console.error('Usage: npm run build-rosters <year>');
        process.exit(1);
    }

    const yearDir = path.join(__dirname, '../rosters', year);
    const readJson = (name) => JSON.parse(fs.readFileSync(path.join(yearDir, name), 'utf-8'));

    const result = buildFinalRosters({
        year: Number(year),
        owners: readJson('owners.json'),
        players: readJson('players.json'),
        draftState: readJson('draft_state.json'),
        espnData: readJson('espn_data.json')
    });

    const outPath = path.join(yearDir, 'final_rosters.json');
    fs.writeFileSync(outPath, JSON.stringify(result, null, 2) + '\n');

    const counts = { draft: 0, waiver: 0, trade: 0 };
    for (const team of result.teams) {
        for (const player of team.players) counts[player.acquired]++;
    }
    const playerCount = result.teams.reduce((n, t) => n + t.players.length, 0);
    console.log(`Wrote ${outPath}: ${result.teams.length} teams, ${playerCount} players (${counts.draft} draft, ${counts.waiver} waiver, ${counts.trade} trade)`);
}

if (require.main === module) {
    main();
}

module.exports = { buildFinalRosters };
