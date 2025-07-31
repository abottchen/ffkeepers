const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');

class EncryptionService {
    constructor() {
        this.algorithm = 'aes-256-cbc';
        this.encryptedDir = process.env.ENCRYPTED_DIR || './data/encrypted';
    }

    async ensureDirectoryExists() {
        try {
            await fs.mkdir(this.encryptedDir, { recursive: true });
        } catch (error) {
            console.error('Error creating encrypted directory:', error);
        }
    }

    generateKey(password) {
        // Create a 32-byte key from password
        return crypto.createHash('sha256').update(password).digest();
    }

    encrypt(text, password) {
        const key = this.generateKey(password);
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv(this.algorithm, key, iv);
        
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        
        // Prepend IV to encrypted data
        return iv.toString('hex') + ':' + encrypted;
    }

    decrypt(encryptedData, password) {
        const key = this.generateKey(password);
        const parts = encryptedData.split(':');
        const iv = Buffer.from(parts[0], 'hex');
        const encrypted = parts[1];
        
        const decipher = crypto.createDecipheriv(this.algorithm, key, iv);
        
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        
        return decrypted;
    }

    async saveEncryptedKeepers(teamName, keepersData, password) {
        await this.ensureDirectoryExists();
        
        const encryptedData = this.encrypt(keepersData, password);
        const filename = `${teamName}.enc`;
        const filepath = path.join(this.encryptedDir, filename);
        
        await fs.writeFile(filepath, encryptedData, 'utf8');
        
        // Log the password (matching original behavior)
        await this.logPassword(teamName, password);
        
        return filepath;
    }

    async loadEncryptedKeepers(teamName, password) {
        const filename = `${teamName}.enc`;
        const filepath = path.join(this.encryptedDir, filename);
        
        try {
            const encryptedData = await fs.readFile(filepath, 'utf8');
            return this.decrypt(encryptedData, password);
        } catch (error) {
            if (error.code === 'ENOENT') {
                throw new Error('No saved keepers found for this team');
            }
            throw error;
        }
    }

    async logPassword(teamName, password) {
        const logFile = process.env.LOG_FILE || './data/keepers.log';
        const logEntry = `${new Date().toISOString()} - ${teamName} used password '${password}'\n`;
        
        await fs.appendFile(logFile, logEntry, 'utf8');
    }
}

module.exports = new EncryptionService();