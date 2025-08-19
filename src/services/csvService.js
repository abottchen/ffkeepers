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
        const filepath = path.join(__dirname, '../../rosters/', filename);
        
        try {
            const fileContent = await fs.readFile(filepath, 'utf-8');
            return this.parseRosterData(fileContent);
        } catch (error) {
            console.error(`Error loading roster file ${filename}:`, error);
            throw new Error(`Roster file for year ${targetYear} not found`);
        }
    }

    parseRosterData(csvContent) {
        // Parse CSV using the csv-parse library
        const records = parse(csvContent, {
            skip_empty_lines: true,
            relax_quotes: true,
            relax_column_count: true
        });

        const teams = [];
        const players = {};

        // First line contains team names (separated by empty columns)
        const teamLine = records[0];
        for (let i = 0; i < teamLine.length; i += 2) {
            if (teamLine[i]) {
                teams.push(teamLine[i]);
                players[teamLine[i]] = [];
            }
        }

        // Skip header line with "Player,$,Player,$..." at index 1
        // Process player data starting from line 2
        for (let i = 2; i < records.length; i++) {
            const row = records[i];

            teams.forEach((team, teamIndex) => {
                const colIndex = teamIndex * 2;
                const rawPlayerName = row[colIndex];
                const playerCost = row[colIndex + 1];

                if (rawPlayerName && playerCost) {
                    // Handle "lastname, firstname" format - convert to "firstname lastname"
                    let playerName = rawPlayerName;
                    if (rawPlayerName.includes(',')) {
                        const [lastName, firstName] = rawPlayerName.split(',').map(s => s.trim());
                        playerName = `${firstName} ${lastName}`;
                    }

                    players[team].push({
                        name: playerName,
                        lastYearCost: parseInt(playerCost) || 0,
                        thisYearCost: this.calculateKeeperCost(parseInt(playerCost) || 0)
                    });
                }
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