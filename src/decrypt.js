#!/usr/bin/env node

const encryptionService = require('./services/encryptionService');
const path = require('path');
require('dotenv').config();

async function decrypt() {
    const args = process.argv.slice(2);
    
    if (args.length !== 2) {
        console.log('Usage: npm run decrypt <team-name> <password>');
        console.log('   or: node src/decrypt.js <team-name> <password>');
        process.exit(1);
    }
    
    const [teamName, password] = args;
    
    try {
        const decryptedData = await encryptionService.loadEncryptedKeepers(teamName, password);
        const keepers = decryptedData.split('/').filter(k => k);
        
        console.log(`\nTeam: ${teamName}`);
        console.log('Keepers:');
        
        if (keepers.length === 0) {
            console.log('  No keepers selected');
        } else {
            keepers.forEach(keeper => {
                console.log(`  - ${keeper}`);
            });
        }
        
        console.log('');
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

decrypt();