const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs').promises;
const os = require('os');
const path = require('path');

const encryptionService = require('../src/services/encryptionService');

describe('encryptionService', () => {
    let tmpDir;
    let originalEncryptedDir;
    let originalLogFile;

    before(async () => {
        tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ffkeepers-test-'));
        originalEncryptedDir = encryptionService.encryptedDir;
        originalLogFile = process.env.LOG_FILE;
        encryptionService.encryptedDir = path.join(tmpDir, 'encrypted');
        process.env.LOG_FILE = path.join(tmpDir, 'keepers.log');
    });

    after(async () => {
        encryptionService.encryptedDir = originalEncryptedDir;
        if (originalLogFile === undefined) {
            delete process.env.LOG_FILE;
        } else {
            process.env.LOG_FILE = originalLogFile;
        }
        await fs.rm(tmpDir, { recursive: true, force: true });
    });

    test('encrypt/decrypt roundtrips with the right password', () => {
        const encrypted = encryptionService.encrypt('Bijan Robinson $44/Davante Adams $15', 'hunter2');
        assert.match(encrypted, /^[0-9a-f]{32}:[0-9a-f]+$/);
        assert.strictEqual(
            encryptionService.decrypt(encrypted, 'hunter2'),
            'Bijan Robinson $44/Davante Adams $15'
        );
    });

    test('decrypt with the wrong password throws', () => {
        const encrypted = encryptionService.encrypt('secret keepers', 'rightpass');
        assert.throws(() => encryptionService.decrypt(encrypted, 'wrongpass'));
    });

    test('save/load roundtrips through a .enc file and logs the password', async () => {
        await encryptionService.saveEncryptedKeepers('adam', 'Bijan Robinson $44', 'hunter2');

        const loaded = await encryptionService.loadEncryptedKeepers('adam', 'hunter2');
        assert.strictEqual(loaded, 'Bijan Robinson $44');

        const log = await fs.readFile(process.env.LOG_FILE, 'utf-8');
        assert.match(log, /adam used password 'hunter2'/);
    });

    test('loading a team with no saved keepers throws a friendly error', async () => {
        await assert.rejects(
            () => encryptionService.loadEncryptedKeepers('nobody', 'pass'),
            /No saved keepers found for this team/
        );
    });
});
