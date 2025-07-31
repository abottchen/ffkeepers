const express = require('express');
const router = express.Router();
const csvService = require('../services/csvService');
const encryptionService = require('../services/encryptionService');

// Get teams and roster data
router.get('/teams', async (req, res) => {
    try {
        const { teams, players } = await csvService.loadRosterData();
        res.json({ teams, players });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get players for a specific team
router.get('/team/:teamName', async (req, res) => {
    try {
        const { teamName } = req.params;
        const { teams, players } = await csvService.loadRosterData();
        
        if (!players[teamName]) {
            return res.status(404).json({ error: 'Team not found' });
        }
        
        res.json({ 
            team: teamName,
            players: players[teamName]
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Submit keeper selections
router.post('/submit', async (req, res) => {
    try {
        const { team, players, password } = req.body;
        
        // Validate input
        if (!team || !password) {
            return res.status(400).json({ error: 'Team and password are required' });
        }
        
        if (!players || !Array.isArray(players)) {
            return res.status(400).json({ error: 'Invalid player selection' });
        }
        
        if (players.length > 3) {
            return res.status(400).json({ error: 'Maximum 3 keepers allowed' });
        }
        
        // Save encrypted keepers
        const keepersData = players.join('/');
        await encryptionService.saveEncryptedKeepers(team, keepersData, password);
        
        res.json({ 
            success: true,
            message: 'Keepers saved successfully',
            team,
            keepers: players
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get saved keepers (for testing/admin)
router.post('/decrypt', async (req, res) => {
    try {
        const { team, password } = req.body;
        
        if (!team || !password) {
            return res.status(400).json({ error: 'Team and password are required' });
        }
        
        const keepersData = await encryptionService.loadEncryptedKeepers(team, password);
        const keepers = keepersData.split('/').filter(k => k);
        
        res.json({ 
            team,
            keepers 
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;