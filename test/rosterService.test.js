const { test, describe } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { RosterService } = require('../src/services/rosterService');

const FIXTURES = path.join(__dirname, 'fixtures/rosters');

function makeService() {
    return new RosterService(FIXTURES);
}

describe('calculateKeeperCost', () => {
    test('adds 10% rounded for larger prices', () => {
        const service = makeService();
        assert.strictEqual(service.calculateKeeperCost(40), 44);
        assert.strictEqual(service.calculateKeeperCost(14), 15);
        assert.strictEqual(service.calculateKeeperCost(31), 34);
    });

    test('adds a minimum of $1 when 10% rounds to zero', () => {
        const service = makeService();
        assert.strictEqual(service.calculateKeeperCost(1), 2);
        assert.strictEqual(service.calculateKeeperCost(2), 3);
        assert.strictEqual(service.calculateKeeperCost(4), 5);
    });
});

describe('loadRosterData', () => {
    test('returns teams with owner metadata keyed by lowercased owner name', async () => {
        const { teams } = await makeService().loadRosterData(2099);
        assert.deepStrictEqual(teams, [
            { key: 'adam', ownerName: 'Adam', teamName: 'Call Me The Breece', color: '#21D4FD' },
            { key: 'jodi', ownerName: 'Jodi', teamName: 'Run CMC', color: '#FF5CA8' }
        ]);
    });

    test('exposes each roster from final_rosters.json with keeper costs applied', async () => {
        const { players } = await makeService().loadRosterData(2099);
        assert.deepStrictEqual(players.adam, [
            { name: 'Bijan Robinson', espnId: 4430737, position: 'RB', nflTeam: 'ATL', lastYearCost: 40, thisYearCost: 44 },
            { name: 'Cheap Guy', espnId: 999, position: 'TE', nflTeam: 'KC', lastYearCost: 1, thisYearCost: 2 },
            { name: 'Green Bay Packers', espnId: 12, position: 'D/ST', nflTeam: 'GB', lastYearCost: 2, thisYearCost: 3 }
        ]);
        assert.deepStrictEqual(players.jodi, [
            { name: 'Davante Adams', espnId: 15847, position: 'WR', nflTeam: 'LAR', lastYearCost: 14, thisYearCost: 15 }
        ]);
    });

    test('throws a helpful error when the year has no final_rosters.json', async () => {
        await assert.rejects(
            () => makeService().loadRosterData(1990),
            /Roster data for year 1990 not found/
        );
    });
});
