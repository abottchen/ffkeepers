const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs').promises;
const os = require('os');
const path = require('path');

process.env.ROSTERS_DIR = path.join(__dirname, 'fixtures/rosters');
process.env.CURRENT_YEAR = '2099';

const express = require('express');
const request = require('supertest');
const keeperRoutes = require('../src/routes/keepers');
const encryptionService = require('../src/services/encryptionService');

function makeApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/keepers', keeperRoutes);
    return app;
}

describe('keeper routes', () => {
    let tmpDir;
    const app = makeApp();

    before(async () => {
        tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ffkeepers-routes-'));
        encryptionService.encryptedDir = path.join(tmpDir, 'encrypted');
        process.env.LOG_FILE = path.join(tmpDir, 'keepers.log');
    });

    after(async () => {
        await fs.rm(tmpDir, { recursive: true, force: true });
    });

    test('GET /teams returns owner-keyed teams and rosters', async () => {
        const res = await request(app).get('/api/keepers/teams').expect(200);

        assert.deepStrictEqual(res.body.teams[0], {
            key: 'adam',
            ownerName: 'Adam',
            teamName: 'Call Me The Breece',
            color: '#21D4FD'
        });
        assert.strictEqual(res.body.players.adam.length, 3);
        assert.deepStrictEqual(res.body.players.jodi[0], {
            name: 'Davante Adams',
            espnId: 15847,
            position: 'WR',
            nflTeam: 'LAR',
            lastYearCost: 14,
            thisYearCost: 15
        });
    });

    test('GET /team/:teamName matches the owner key case-insensitively', async () => {
        const res = await request(app).get('/api/keepers/team/ADAM').expect(200);
        assert.strictEqual(res.body.team, 'adam');
        assert.strictEqual(res.body.players.length, 3);
    });

    test('GET /team/:teamName returns 404 for unknown owners', async () => {
        const res = await request(app).get('/api/keepers/team/nobody').expect(404);
        assert.match(res.body.error, /not found/i);
    });

    test('POST /submit rejects more than 3 keepers', async () => {
        const players = [1, 2, 3, 4].map(n => ({ name: `Player ${n}`, cost: n }));
        const res = await request(app)
            .post('/api/keepers/submit')
            .send({ team: 'adam', players, password: 'pw' })
            .expect(400);
        assert.match(res.body.error, /Maximum 3 keepers/);
    });

    test('POST /submit rejects missing team or password', async () => {
        await request(app)
            .post('/api/keepers/submit')
            .send({ players: [], password: 'pw' })
            .expect(400);
        await request(app)
            .post('/api/keepers/submit')
            .send({ team: 'adam', players: [] })
            .expect(400);
    });

    test('submit then decrypt roundtrips the keeper selections', async () => {
        const players = [
            { name: 'Bijan Robinson', cost: 44 },
            { name: 'Green Bay Packers', cost: 3 }
        ];
        await request(app)
            .post('/api/keepers/submit')
            .send({ team: 'adam', players, password: 'hunter2' })
            .expect(200);

        const res = await request(app)
            .post('/api/keepers/decrypt')
            .send({ team: 'adam', password: 'hunter2' })
            .expect(200);
        assert.deepStrictEqual(res.body.keepers, ['Bijan Robinson $44', 'Green Bay Packers $3']);
    });
});
