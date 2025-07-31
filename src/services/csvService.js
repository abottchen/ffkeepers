const fs = require('fs').promises;
const path = require('path');
const { parse } = require('csv-parse/sync');

class CsvService {
    constructor() {
        this.currentYear = process.env.CURRENT_YEAR || new Date().getFullYear();
    }

    async loadRosterData(year = null) {
        const targetYear = year || this.currentYear;
        const filename = `ff${targetYear}rosters.csv`;
        const filepath = path.join(__dirname, '../../', filename);
        
        try {
            const fileContent = await fs.readFile(filepath, 'utf-8');
            return this.parseRosterData(fileContent);
        } catch (error) {
            console.error(`Error loading roster file ${filename}:`, error);
            throw new Error(`Roster file for year ${targetYear} not found`);
        }
    }

    parseRosterData(csvContent) {
        const lines = csvContent.trim().split('\n');
        const teams = [];
        const players = {};
        
        // First line contains team names
        const teamLine = lines[0].replace(/"/g, '').split(',,');
        teamLine.forEach(team => {
            if (team) {
                teams.push(team);
                players[team] = [];
            }
        });
        
        // Skip header line with "Player,$,Player,$..."
        for (let i = 2; i < lines.length; i++) {
            const line = lines[i].replace(/"/g, '');
            if (!line.trim()) continue;
            
            const values = line.split(',');
            let valueIndex = 0;
            
            teams.forEach((team, teamIndex) => {
                const playerName = values[valueIndex];
                const playerCost = values[valueIndex + 1];
                
                if (playerName && playerCost) {
                    players[team].push({
                        name: playerName,
                        lastYearCost: parseInt(playerCost) || 0,
                        thisYearCost: this.calculateKeeperCost(parseInt(playerCost) || 0)
                    });
                }
                
                valueIndex += 2;
            });
        }
        
        return { teams, players };
    }

    calculateKeeperCost(lastYearCost) {
        const increase = Math.round(lastYearCost * 0.1);
        return lastYearCost + (increase > 0 ? increase : 1);
    }
}

module.exports = new CsvService();