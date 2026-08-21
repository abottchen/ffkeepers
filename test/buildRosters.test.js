const { test, describe } = require('node:test');
const assert = require('node:assert');
const { buildFinalRosters } = require('../scripts/build-rosters');

const owners = [
    { id: 1, owner_name: 'Adam', team_name: 'Call Me The Breece', color: '#21D4FD' },
    { id: 2, owner_name: 'Jodi', team_name: 'Run CMC', color: '#FF5CA8' },
    { id: 3, owner_name: 'Jackie', team_name: 'Blood Sweat Beers', color: '#E8453C' }
];

const players = [
    { id: 12, first_name: 'Green Bay', last_name: 'Packers', team: 'GB', position: 'D/ST' },
    { id: 4430737, first_name: 'Bijan', last_name: 'Robinson', team: 'ATL', position: 'RB' },
    { id: 15847, first_name: 'Davante', last_name: 'Adams', team: 'LAR', position: 'WR' },
    { id: 999, first_name: 'Cheap', last_name: 'Guy', team: 'KC', position: 'TE' },
    { id: 4431452, first_name: 'Drake', last_name: 'Maye', team: 'NE', position: 'QB' },
    { id: 555, first_name: 'Traded', last_name: 'Guy', team: 'CHI', position: 'RB' },
    { id: 888, first_name: 'Jackie', last_name: 'Player', team: 'DAL', position: 'WR' }
];

const draftState = {
    teams: [
        {
            owner_id: 1,
            picks: [
                { pick_id: 1, player_id: 4430737, owner_id: 1, price: 40 },
                { pick_id: 2, player_id: 12, owner_id: 1, price: 2 },
                { pick_id: 3, player_id: 999, owner_id: 1, price: 1 }
            ]
        },
        {
            owner_id: 2,
            picks: [
                { pick_id: 4, player_id: 15847, owner_id: 2, price: 14 },
                { pick_id: 5, player_id: 555, owner_id: 2, price: 9 }
            ]
        },
        {
            owner_id: 3,
            picks: [
                { pick_id: 6, player_id: 888, owner_id: 3, price: 5 }
            ]
        }
    ]
};

// End-of-year ESPN state: Cheap Guy was dropped, Drake Maye added on waivers,
// Traded Guy went from Jodi to Adam in a trade.
function makeEspnData() {
    return {
        year: 2099,
        league_id: 577910,
        teams: [
            {
                espn_team_id: 101,
                team_name: 'Some 2099 Team Name',
                owner_first_name: 'Adam',
                players: [
                    { espn_player_id: 4430737, name: 'Bijan Robinson', position: 'RB', acquisition_type: 'DRAFT' },
                    { espn_player_id: -16009, name: 'Packers D/ST', position: 'D/ST', acquisition_type: 'DRAFT' },
                    { espn_player_id: 555, name: 'Traded Guy', position: 'RB', acquisition_type: 'TRADE' }
                ]
            },
            {
                espn_team_id: 102,
                team_name: "Don't Joe Chasin' Waterfalls",
                owner_first_name: 'Jodi',
                players: [
                    { espn_player_id: 15847, name: 'Davante Adams', position: 'WR', acquisition_type: 'DRAFT' },
                    { espn_player_id: 4431452, name: 'Drake Maye', position: 'QB', acquisition_type: 'ADD' }
                ]
            },
            {
                espn_team_id: 103,
                team_name: 'Hucke Yeah',
                owner_first_name: 'Jacqueline',
                players: [
                    { espn_player_id: 888, name: 'Jackie Player', position: 'WR', acquisition_type: 'DRAFT' }
                ]
            }
        ],
        transactions: [
            {
                type: 'WAIVER',
                status: 'EXECUTED',
                bid_amount: 3,
                process_date: 200,
                items: [{ player_id: 4431452, type: 'ADD', to_team_id: 102, from_team_id: 0 }]
            },
            {
                type: 'TRADE_ACCEPT',
                status: 'EXECUTED',
                bid_amount: 0,
                process_date: 300,
                items: [{ player_id: 555, type: 'TRADE', to_team_id: 101, from_team_id: 102 }]
            }
        ]
    };
}

function build(overrides = {}) {
    return buildFinalRosters({
        year: 2099,
        owners,
        players,
        draftState,
        espnData: makeEspnData(),
        ...overrides
    });
}

describe('buildFinalRosters', () => {
    test('roster membership comes from ESPN end-of-year rosters, not the draft', () => {
        const result = build();
        const adam = result.teams.find(t => t.owner_id === 1);
        assert.ok(!adam.players.some(p => p.player_id === 999), 'dropped player excluded');
        assert.deepStrictEqual(adam.players.map(p => p.player_id), [4430737, 12, 555]);
    });

    test('teams keep owner metadata from owners.json', () => {
        const result = build();
        assert.deepStrictEqual(
            result.teams.map(t => ({ owner_id: t.owner_id, owner_name: t.owner_name, team_name: t.team_name, color: t.color })),
            owners.map(o => ({ owner_id: o.id, owner_name: o.owner_name, team_name: o.team_name, color: o.color }))
        );
    });

    test('drafted players get their draft price', () => {
        const result = build();
        const adam = result.teams.find(t => t.owner_id === 1);
        assert.deepStrictEqual(adam.players.find(p => p.player_id === 4430737), {
            player_id: 4430737, name: 'Bijan Robinson', position: 'RB', nfl_team: 'ATL', price: 40, acquired: 'draft'
        });
    });

    test('D/ST is matched by nickname and keeps the players.json id', () => {
        const result = build();
        const adam = result.teams.find(t => t.owner_id === 1);
        assert.deepStrictEqual(adam.players.find(p => p.position === 'D/ST'), {
            player_id: 12, name: 'Green Bay Packers', position: 'D/ST', nfl_team: 'GB', price: 2, acquired: 'draft'
        });
    });

    test('added players get their last waiver bid amount', () => {
        const result = build();
        const jodi = result.teams.find(t => t.owner_id === 2);
        assert.deepStrictEqual(jodi.players.find(p => p.player_id === 4431452), {
            player_id: 4431452, name: 'Drake Maye', position: 'QB', nfl_team: 'NE', price: 3, acquired: 'waiver'
        });
    });

    test('the latest add wins when a player was added multiple times', () => {
        const espnData = makeEspnData();
        espnData.transactions.push({
            type: 'WAIVER',
            status: 'EXECUTED',
            bid_amount: 7,
            process_date: 250,
            items: [{ player_id: 4431452, type: 'ADD', to_team_id: 102, from_team_id: 0 }]
        });
        const result = build({ espnData });
        const jodi = result.teams.find(t => t.owner_id === 2);
        assert.strictEqual(jodi.players.find(p => p.player_id === 4431452).price, 7);
    });

    test('traded players retain their draft price', () => {
        const result = build();
        const adam = result.teams.find(t => t.owner_id === 1);
        assert.deepStrictEqual(adam.players.find(p => p.player_id === 555), {
            player_id: 555, name: 'Traded Guy', position: 'RB', nfl_team: 'CHI', price: 9, acquired: 'trade'
        });
    });

    test('ESPN owner first names map through aliases (Jacqueline -> Jackie)', () => {
        const result = build();
        const jackie = result.teams.find(t => t.owner_id === 3);
        assert.strictEqual(jackie.players.length, 1);
        assert.strictEqual(jackie.players[0].player_id, 888);
    });

    test('players missing from players.json fall back to ESPN name and position', () => {
        const espnData = makeEspnData();
        espnData.teams[1].players.push({ espn_player_id: 11122, name: 'Matt Prater', position: 'K', acquisition_type: 'ADD' });
        espnData.transactions.push({
            type: 'WAIVER',
            status: 'EXECUTED',
            bid_amount: 1,
            process_date: 400,
            items: [{ player_id: 11122, type: 'ADD', to_team_id: 102, from_team_id: 0 }]
        });
        const result = build({ espnData });
        const jodi = result.teams.find(t => t.owner_id === 2);
        assert.deepStrictEqual(jodi.players.find(p => p.player_id === 11122), {
            player_id: 11122, name: 'Matt Prater', position: 'K', nfl_team: '', price: 1, acquired: 'waiver'
        });
    });

    test('throws when a DRAFT player was drafted by a different owner', () => {
        const espnData = makeEspnData();
        // Davante (drafted by Jodi) claimed as DRAFT on Adam's ESPN roster
        espnData.teams[0].players.push({ espn_player_id: 15847, name: 'Davante Adams', position: 'WR', acquisition_type: 'DRAFT' });
        assert.throws(() => build({ espnData }), /drafted by/i);
    });

    test('throws when an added player has no acquisition transaction', () => {
        const espnData = makeEspnData();
        espnData.teams[1].players.push({ espn_player_id: 999, name: 'Cheap Guy', position: 'TE', acquisition_type: 'ADD' });
        assert.throws(() => build({ espnData }), /no.*transaction/i);
    });

    test('throws when a bid amount is not positive', () => {
        const espnData = makeEspnData();
        espnData.transactions[0].bid_amount = 0;
        assert.throws(() => build({ espnData }), /bid/i);
    });

    test('throws when an ESPN owner first name matches no owner', () => {
        const espnData = makeEspnData();
        espnData.teams[2].owner_first_name = 'Rando';
        assert.throws(() => build({ espnData }), /Rando/);
    });
});
