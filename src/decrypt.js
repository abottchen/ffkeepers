#!/usr/bin/env node

const encryptionService = require('./services/encryptionService');
const csvService = require('./services/csvService');
const path = require('path');
const https = require('https');
const http = require('http');
require('dotenv').config();

async function fetchApiData(url) {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https:') ? https : http;
        client.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (error) {
                    reject(new Error(`Failed to parse JSON: ${error.message}`));
                }
            });
        }).on('error', reject);
    });
}

async function postApiData(url, data) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const client = url.startsWith('https:') ? https : http;
        const postData = JSON.stringify(data);
        
        const options = {
            hostname: urlObj.hostname,
            port: urlObj.port,
            path: urlObj.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };
        
        const req = client.request(options, (res) => {
            let responseData = '';
            res.on('data', chunk => responseData += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                        resolve(JSON.parse(responseData || '{}'));
                    } catch (error) {
                        resolve({ success: true, statusCode: res.statusCode });
                    }
                } else {
                    reject(new Error(`HTTP ${res.statusCode}: ${responseData}`));
                }
            });
        });
        
        req.on('error', reject);
        req.write(postData);
        req.end();
    });
}

async function decrypt() {
    const args = process.argv.slice(2);
    let apiStartVersion = null;
    let teamName, password;
    
    // Parse arguments - check for api=<int> parameter
    if (args.length === 2) {
        [teamName, password] = args;
    } else if (args.length === 3) {
        if (args[2].startsWith('api=')) {
            apiStartVersion = parseInt(args[2].split('=')[1]);
            if (isNaN(apiStartVersion)) {
                console.log('Error: api parameter must be a number (e.g., api=1)');
                process.exit(1);
            }
            [teamName, password] = args;
        } else {
            console.log('Usage: npm run decrypt <team-name> <password> [api=<int>]');
            console.log('   or: node src/decrypt.js <team-name> <password> [api=<int>]');
            process.exit(1);
        }
    } else {
        console.log('Usage: npm run decrypt <team-name> <password> [api=<int>]');
        console.log('   or: node src/decrypt.js <team-name> <password> [api=<int>]');
        process.exit(1);
    }
    
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
        
        // If api parameter provided, submit to draft tracker API
        if (apiStartVersion !== null) {
            console.log('\nSubmitting keepers to draft tracker API...');
            await submitToApi(teamName, keepers, apiStartVersion);
        }
        
        console.log('');
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

async function submitToApi(teamName, keepers, startVersion) {
    try {
        // Fetch API data
        console.log('Fetching API data...');
        const apiBaseUrl = process.env.API_BASE_URL || 'http://localhost';
        const [owners, players] = await Promise.all([
            fetchApiData(`${apiBaseUrl}:8176/api/v1/owners`),
            fetchApiData(`${apiBaseUrl}:8176/api/v1/players`)
        ]);
        
        // Load roster data to get player costs
        const rosterData = await csvService.loadRosterData(process.env.CURRENT_YEAR);
        
        // Find owner_id by matching owner name or team name (case-insensitive)
        const owner = owners.find(o => 
            o.owner_name.toLowerCase() === teamName.toLowerCase() ||
            o.team_name.toLowerCase() === teamName.toLowerCase()
        );
        if (!owner) {
            console.log(`Error: Team "${teamName}" not found in API owners data`);
            return;
        }
        
        console.log(`\nFound owner: ${owner.owner_name} (ID: ${owner.id})`);
        console.log('Submitting keeper selections:\n');
        
        let currentVersion = startVersion;
        let successCount = 0;
        let errorCount = 0;
        
        for (const keeperName of keepers) {
            // Parse keeper name to get player name and find cost
            const playerInfo = findPlayerInRoster(keeperName, rosterData.players[teamName]);
            if (!playerInfo) {
                console.log(`FAILED: ${keeperName} - Could not find roster info`);
                errorCount++;
                continue;
            }
            
            // Extract first and last name
            const nameParts = playerInfo.name.split(' ');
            const firstName = nameParts[0];
            const lastName = nameParts.slice(1).join(' ');
            
            // Find player_id from API
            const apiPlayer = players.find(p => 
                p.first_name.toLowerCase() === firstName.toLowerCase() && 
                p.last_name.toLowerCase() === lastName.toLowerCase()
            );
            
            if (!apiPlayer) {
                console.log(`FAILED: ${playerInfo.name} - Could not find matching API player`);
                errorCount++;
                continue;
            }
            
            // Generate curl command
            const curlData = {
                owner_id: owner.id,
                player_id: apiPlayer.id,
                price: playerInfo.thisYearCost,
                expected_version: currentVersion
            };
            
            try {
                await postApiData(`${apiBaseUrl}:8175/api/v1/admin/draft`, curlData);
                console.log(`SUCCESS: ${playerInfo.name} - Submitted $${playerInfo.thisYearCost} (version ${currentVersion})`);
                successCount++;
            } catch (error) {
                console.log(`FAILED: ${playerInfo.name} - API error: ${error.message}`);
                errorCount++;
            }
            
            currentVersion++;
        }
        
        console.log(`\nSummary: ${successCount} successful, ${errorCount} failed`);
        
    } catch (error) {
        console.error('Error submitting to API:', error.message);
    }
}

function findPlayerInRoster(keeperName, teamRoster) {
    if (!teamRoster) return null;
    
    // Try exact match first
    let player = teamRoster.find(p => p.name === keeperName);
    if (player) return player;
    
    // Try case-insensitive match
    player = teamRoster.find(p => p.name.toLowerCase() === keeperName.toLowerCase());
    if (player) return player;
    
    // Try partial match (in case there are formatting differences)
    player = teamRoster.find(p => 
        p.name.toLowerCase().includes(keeperName.toLowerCase()) ||
        keeperName.toLowerCase().includes(p.name.toLowerCase())
    );
    
    return player;
}

decrypt();