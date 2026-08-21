#!/usr/bin/env node
// Fetches the league's end-of-year rosters and transaction history from
// ESPN's fantasy API and writes rosters/<year>/espn_data.json for
// scripts/build-rosters.js to merge.
//
// Usage: npm run fetch-espn <year>
// Requires in .env: ESPN_LEAGUE_ID, ESPN_S2, ESPN_SWID (copy espn_s2 and
// SWID cookies from a logged-in fantasy.espn.com session — see CLAUDE.md).

const fs = require('fs');
const path = require('path');
require('dotenv').config();

const POSITIONS = { 1: 'QB', 2: 'RB', 3: 'WR', 4: 'TE', 5: 'K', 16: 'D/ST' };

function trimEspnData(league, periodTransactions) {
    const memberById = new Map(league.members.map(m => [m.id, m]));

    const teams = league.teams.map(team => {
        const owner = memberById.get(team.primaryOwner);
        return {
            espn_team_id: team.id,
            team_name: team.name.trim(),
            owner_first_name: owner ? owner.firstName : '',
            players: (team.roster ? team.roster.entries : []).map(entry => {
                const player = entry.playerPoolEntry.player;
                return {
                    espn_player_id: entry.playerId,
                    name: player.fullName,
                    position: POSITIONS[player.defaultPositionId] || String(player.defaultPositionId),
                    acquisition_type: entry.acquisitionType
                };
            })
        };
    });

    const seen = new Set();
    const transactions = [];
    for (const tx of periodTransactions.flat()) {
        if (tx.status !== 'EXECUTED') continue;
        if (seen.has(tx.id)) continue;
        const items = (tx.items || []).filter(i => i.type === 'ADD' || i.type === 'TRADE');
        if (items.length === 0) continue;
        seen.add(tx.id);
        transactions.push({
            type: tx.type,
            status: tx.status,
            bid_amount: tx.bidAmount,
            process_date: tx.processDate,
            scoring_period: tx.scoringPeriodId,
            items: items.map(i => ({
                player_id: i.playerId,
                type: i.type,
                to_team_id: i.toTeamId,
                from_team_id: i.fromTeamId
            }))
        });
    }

    return { year: league.seasonId, league_id: league.id, teams, transactions };
}

async function fetchJson(url) {
    const res = await fetch(url, {
        headers: {
            accept: 'application/json',
            cookie: `espn_s2=${process.env.ESPN_S2}; SWID=${process.env.ESPN_SWID}`
        }
    });
    if (!res.ok) {
        throw new Error(`ESPN API ${res.status} for ${url}`);
    }
    const body = await res.json();
    if (body.messages && !body.teams && !body.transactions) {
        throw new Error(`ESPN API error: ${body.messages.join('; ')}`);
    }
    return body;
}

async function main() {
    const year = process.argv[2];
    if (!year) {
        console.error('Usage: npm run fetch-espn <year>');
        process.exit(1);
    }
    for (const name of ['ESPN_LEAGUE_ID', 'ESPN_S2', 'ESPN_SWID']) {
        if (!process.env[name]) {
            console.error(`Missing ${name} in .env`);
            process.exit(1);
        }
    }

    const base = `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${year}/segments/0/leagues/${process.env.ESPN_LEAGUE_ID}`;

    console.log('Fetching rosters...');
    const league = await fetchJson(`${base}?view=mRoster&view=mTeam`);

    const first = league.status.firstScoringPeriod || 1;
    const last = league.status.latestScoringPeriod || 18;
    console.log(`Fetching transactions for scoring periods ${first}-${last}...`);
    const periodTransactions = [];
    for (let p = first; p <= last; p++) {
        const data = await fetchJson(`${base}?view=mTransactions2&scoringPeriodId=${p}`);
        periodTransactions.push(data.transactions || []);
    }

    const result = trimEspnData(league, periodTransactions);
    const outPath = path.join(__dirname, '../rosters', year, 'espn_data.json');
    fs.writeFileSync(outPath, JSON.stringify(result, null, 2) + '\n');

    const playerCount = result.teams.reduce((n, t) => n + t.players.length, 0);
    console.log(`Wrote ${outPath}: ${result.teams.length} teams, ${playerCount} players, ${result.transactions.length} acquisition transactions`);
}

if (require.main === module) {
    main().catch(err => {
        console.error(err.message);
        process.exit(1);
    });
}

module.exports = { trimEspnData };
