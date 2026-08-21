const fs = require('fs').promises;
const path = require('path');

// Reads the single source of truth produced by scripts/build-rosters.js:
// rosters/{year}/final_rosters.json
class RosterService {
    constructor(rostersDir = process.env.ROSTERS_DIR || path.join(__dirname, '../../rosters')) {
        this.rostersDir = rostersDir;
        this.currentYear = process.env.CURRENT_YEAR || new Date().getFullYear();
    }

    async loadRosterData(year = null) {
        const targetYear = year || this.currentYear;
        const filepath = path.join(this.rostersDir, String(targetYear), 'final_rosters.json');

        let data;
        try {
            data = JSON.parse(await fs.readFile(filepath, 'utf-8'));
        } catch (error) {
            console.error(`Error loading roster data for ${targetYear}:`, error.message);
            throw new Error(`Roster data for year ${targetYear} not found`);
        }

        const teams = [];
        const players = {};

        for (const team of data.teams) {
            const key = team.owner_name.toLowerCase();
            teams.push({
                key,
                ownerName: team.owner_name,
                teamName: team.team_name,
                color: team.color
            });

            players[key] = team.players.map(player => ({
                name: player.name,
                espnId: player.player_id,
                position: player.position,
                nflTeam: player.nfl_team,
                lastYearCost: player.price,
                thisYearCost: this.calculateKeeperCost(player.price)
            }));
        }

        return { teams, players };
    }

    calculateKeeperCost(lastYearCost) {
        const increase = Math.round(lastYearCost * 0.1);
        return lastYearCost + (increase > 0 ? increase : 1);
    }
}

module.exports = new RosterService();
module.exports.RosterService = RosterService;
