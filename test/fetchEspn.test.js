const { test, describe } = require('node:test');
const assert = require('node:assert');
const { trimEspnData } = require('../scripts/fetch-espn');

const league = {
    seasonId: 2099,
    id: 577910,
    members: [
        { id: '{AAA}', firstName: 'Jodi', lastName: 'S' },
        { id: '{BBB}', firstName: 'Adam', lastName: 'B' }
    ],
    teams: [
        {
            id: 1,
            name: "Don't Joe Chasin' Waterfalls ",
            primaryOwner: '{AAA}',
            roster: {
                entries: [
                    {
                        playerId: 4431452,
                        acquisitionType: 'ADD',
                        playerPoolEntry: { player: { id: 4431452, fullName: 'Drake Maye', defaultPositionId: 1 } }
                    },
                    {
                        playerId: -16007,
                        acquisitionType: 'DRAFT',
                        playerPoolEntry: { player: { id: -16007, fullName: 'Broncos D/ST', defaultPositionId: 16 } }
                    }
                ]
            }
        },
        {
            id: 2,
            name: 'Call Me The Breece',
            primaryOwner: '{BBB}',
            roster: { entries: [] }
        }
    ]
};

const periodTransactions = [
    [
        {
            id: 'tx-1',
            type: 'WAIVER',
            status: 'EXECUTED',
            bidAmount: 3,
            processDate: 200,
            scoringPeriodId: 5,
            items: [
                { playerId: 4431452, type: 'ADD', toTeamId: 1, fromTeamId: 0 },
                { playerId: 4239993, type: 'DROP', toTeamId: 0, fromTeamId: 1 }
            ]
        },
        {
            id: 'tx-2',
            type: 'WAIVER',
            status: 'FAILED_ROSTERLIMIT',
            bidAmount: 9,
            processDate: 201,
            scoringPeriodId: 5,
            items: [{ playerId: 111, type: 'ADD', toTeamId: 1, fromTeamId: 0 }]
        },
        {
            id: 'tx-3',
            type: 'ROSTER',
            status: 'EXECUTED',
            bidAmount: 0,
            processDate: 202,
            scoringPeriodId: 5,
            items: [{ playerId: 222, type: 'LINEUP', toTeamId: 1, fromTeamId: 1 }]
        }
    ],
    // same executed transaction seen again in another period's fetch
    [
        {
            id: 'tx-1',
            type: 'WAIVER',
            status: 'EXECUTED',
            bidAmount: 3,
            processDate: 200,
            scoringPeriodId: 5,
            items: [{ playerId: 4431452, type: 'ADD', toTeamId: 1, fromTeamId: 0 }]
        }
    ]
];

describe('trimEspnData', () => {
    test('extracts teams with owner first names and typed roster entries', () => {
        const data = trimEspnData(league, periodTransactions);
        assert.strictEqual(data.year, 2099);
        assert.strictEqual(data.league_id, 577910);
        assert.deepStrictEqual(data.teams[0], {
            espn_team_id: 1,
            team_name: "Don't Joe Chasin' Waterfalls",
            owner_first_name: 'Jodi',
            players: [
                { espn_player_id: 4431452, name: 'Drake Maye', position: 'QB', acquisition_type: 'ADD' },
                { espn_player_id: -16007, name: 'Broncos D/ST', position: 'D/ST', acquisition_type: 'DRAFT' }
            ]
        });
    });

    test('keeps only executed transactions that add or trade a player, deduped by id', () => {
        const data = trimEspnData(league, periodTransactions);
        assert.deepStrictEqual(data.transactions, [
            {
                type: 'WAIVER',
                status: 'EXECUTED',
                bid_amount: 3,
                process_date: 200,
                scoring_period: 5,
                items: [{ player_id: 4431452, type: 'ADD', to_team_id: 1, from_team_id: 0 }]
            }
        ]);
    });
});
