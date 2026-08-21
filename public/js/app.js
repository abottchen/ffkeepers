class KeeperApp {
    constructor() {
        this.currentTeam = null;
        this.teamsData = null;
        this.selectedPlayers = []; // ordered — index is the slip slot number
        this.maxKeepers = 3;
        this.budget = 200;

        this.initializeElements();
        this.attachEventListeners();
        this.initializeTheme();
        this.loadTeams();
    }

    initializeElements() {
        this.teamSelect = document.getElementById('teamSelect');
        this.selectTeamBtn = document.getElementById('selectTeamBtn');
        this.teamSection = document.getElementById('teamSelection');
        this.playerSection = document.getElementById('playerSelection');
        this.confirmationSection = document.getElementById('confirmation');
        this.playerList = document.getElementById('playerList');
        this.passwordInput = document.getElementById('password');
        this.submitKeepersBtn = document.getElementById('submitKeepers');
        this.changeTeamBtn = document.getElementById('changeTeam');
        this.selectAnotherBtn = document.getElementById('selectAnother');
        this.viewAllTeamsBtn = document.getElementById('viewAllTeamsBtn');
        this.viewAllTeamsSection = document.getElementById('viewAllTeams');
        this.allTeamsContainer = document.getElementById('allTeamsContainer');
        this.backToSelectionBtn = document.getElementById('backToSelection');
        this.errorMessage = document.getElementById('errorMessage');
        this.themeToggle = document.getElementById('themeToggle');
        this.rosterTeamName = document.getElementById('rosterTeamName');
        this.slipTeamName = document.getElementById('slipTeamName');
        this.slipSlots = document.getElementById('slipSlots');
        this.slipBudget = document.getElementById('slipBudget');
        this.slipTotal = document.getElementById('slipTotal');
        this.slipRemaining = document.getElementById('slipRemaining');
        this.budgetBarFill = document.getElementById('budgetBarFill');
        this.slipHint = document.getElementById('slipHint');
        this.slipError = document.getElementById('slipError');
        this.errorTimeout = null;
    }

    attachEventListeners() {
        this.selectTeamBtn.addEventListener('click', () => this.selectTeam());
        this.submitKeepersBtn.addEventListener('click', () => this.submitKeepers());
        this.changeTeamBtn.addEventListener('click', () => this.showTeamSelection());
        this.selectAnotherBtn.addEventListener('click', () => this.showTeamSelection());
        this.viewAllTeamsBtn.addEventListener('click', () => this.showAllTeams());
        this.backToSelectionBtn.addEventListener('click', () => this.showTeamSelection());
        this.themeToggle.addEventListener('click', () => this.toggleTheme());
        this.passwordInput.addEventListener('input', () => this.updateSlip());
    }

    async loadTeams() {
        try {
            const response = await fetch('/api/keepers/teams');
            const data = await response.json();

            if (response.ok) {
                this.teamsData = data;
                this.populateTeamSelect(data.teams);
            } else {
                this.showError(data.error || 'Failed to load teams');
            }
        } catch (error) {
            this.showError('Failed to connect to server');
        }
    }

    populateTeamSelect(teams) {
        this.teamSelect.innerHTML = '<option value="">Choose your team...</option>';
        teams.forEach(team => {
            const option = document.createElement('option');
            option.value = team;
            option.textContent = team;
            this.teamSelect.appendChild(option);
        });
    }

    selectTeam() {
        const selectedTeam = this.teamSelect.value;
        if (!selectedTeam) {
            this.showError('Please select a team');
            return;
        }

        this.currentTeam = selectedTeam;
        this.displayPlayers(this.teamsData.players[selectedTeam]);
        this.showPlayerSelection();
    }

    displayPlayers(players) {
        this.playerList.innerHTML = '';
        this.selectedPlayers = [];

        players.forEach(player => {
            const playerCard = document.createElement('div');
            playerCard.className = 'player-card';
            playerCard.dataset.playerName = player.name;
            playerCard.tabIndex = 0;
            playerCard.setAttribute('role', 'button');

            playerCard.innerHTML = `
                <span class="slot-badge"></span>
                <span class="player-name">${player.name}</span>
                <span class="player-costs">
                    <span class="cost-last">$${player.lastYearCost}</span>
                    <span class="cost-arrow">&rarr;</span>
                    <span class="cost-keep">$${player.thisYearCost}</span>
                </span>
            `;

            playerCard.addEventListener('click', () => this.togglePlayer(player));
            playerCard.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this.togglePlayer(player);
                }
            });

            this.playerList.appendChild(playerCard);
        });

        this.updateSlip();
    }

    togglePlayer(player) {
        const index = this.selectedPlayers.findIndex(p => p.name === player.name);

        if (index >= 0) {
            this.selectedPlayers.splice(index, 1);
        } else {
            if (this.selectedPlayers.length >= this.maxKeepers) {
                this.showError(`You can only select up to ${this.maxKeepers} keepers`);
                return;
            }
            this.selectedPlayers.push({ name: player.name, cost: player.thisYearCost });
        }

        this.hideError();
        this.updateSlip();
    }

    removePlayer(playerName) {
        this.selectedPlayers = this.selectedPlayers.filter(p => p.name !== playerName);
        this.hideError();
        this.updateSlip();
    }

    updateSlip() {
        // Sync roster cards with the slip (selected state + slot number badge)
        this.playerList.querySelectorAll('.player-card').forEach(card => {
            const slot = this.selectedPlayers.findIndex(p => p.name === card.dataset.playerName);
            card.classList.toggle('selected', slot >= 0);
            card.querySelector('.slot-badge').textContent = slot >= 0 ? slot + 1 : '';
        });

        // Render the three slots
        this.slipSlots.innerHTML = '';
        for (let i = 0; i < this.maxKeepers; i++) {
            const player = this.selectedPlayers[i];
            const slot = document.createElement('li');

            if (player) {
                slot.className = 'slip-slot filled';
                slot.innerHTML = `
                    <span class="slot-num">${i + 1}</span>
                    <span class="slot-name">${player.name}</span>
                    <span class="slot-cost">$${player.cost}</span>
                    <button class="slot-remove" title="Remove ${player.name}" aria-label="Remove ${player.name}">&times;</button>
                `;
                slot.querySelector('.slot-remove').addEventListener('click', () => this.removePlayer(player.name));
            } else {
                slot.className = 'slip-slot empty';
                slot.innerHTML = `
                    <span class="slot-num">${i + 1}</span>
                    <span class="slot-name">Empty slot</span>
                `;
            }

            this.slipSlots.appendChild(slot);
        }

        // Budget meter
        const totalCost = this.selectedPlayers.reduce((sum, p) => sum + parseInt(p.cost), 0);
        this.slipTotal.textContent = `$${totalCost}`;
        this.slipRemaining.textContent = totalCost > this.budget
            ? `-$${totalCost - this.budget}`
            : `$${this.budget - totalCost}`;
        this.budgetBarFill.style.width = `${Math.min(100, (totalCost / this.budget) * 100)}%`;

        this.slipBudget.className = 'slip-budget';
        if (totalCost > this.budget) {
            this.slipBudget.classList.add('over-budget');
        } else if (totalCost > 150) {
            this.slipBudget.classList.add('near-budget');
        }

        // Submit readiness + step hint
        const count = this.selectedPlayers.length;
        const hasPassword = this.passwordInput.value.trim().length > 0;
        this.submitKeepersBtn.disabled = count === 0 || !hasPassword;

        this.slipHint.classList.remove('ready');
        if (count === 0) {
            this.slipHint.textContent = 'Pick at least one player to get started';
        } else if (!hasPassword) {
            this.slipHint.textContent = 'Enter your team password to submit';
        } else {
            this.slipHint.textContent = `Ready to lock in ${count} keeper${count > 1 ? 's' : ''}`;
            this.slipHint.classList.add('ready');
        }
    }

    async submitKeepers() {
        const password = this.passwordInput.value.trim();

        if (!password) {
            this.showError('Please enter a password');
            return;
        }

        try {
            const response = await fetch('/api/keepers/submit', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    team: this.currentTeam,
                    players: this.selectedPlayers,
                    password: password
                })
            });

            const data = await response.json();

            if (response.ok) {
                this.showConfirmation(data);
            } else {
                this.showError(data.error || 'Failed to save keepers');
            }
        } catch (error) {
            this.showError('Failed to connect to server');
        }
    }

    showConfirmation(data) {
        const details = document.getElementById('confirmationDetails');

        if (data.keepers.length === 0) {
            details.innerHTML = `
                <h3>Team: ${data.team}</h3>
                <p>No keepers selected</p>
                <p><strong>Password saved successfully!</strong></p>
            `;
        } else {
            details.innerHTML = `
                <h3>Team: ${data.team}</h3>
                <p><strong>Keepers:</strong></p>
                <ul>
                    ${data.keepers.map(k => `<li>${k}</li>`).join('')}
                </ul>
                <p><strong>Password saved successfully!</strong></p>
                <p>Remember your password: <em>${this.passwordInput.value}</em></p>
            `;
        }

        this.hideAllSections();
        this.confirmationSection.classList.remove('hidden');
        this.resetForm();
    }

    showTeamSelection() {
        this.hideAllSections();
        this.teamSection.classList.remove('hidden');
        this.resetForm();
    }

    showPlayerSelection() {
        this.hideAllSections();
        const teamName = this.normalizeTeamName(this.currentTeam);
        this.rosterTeamName.textContent = teamName;
        this.slipTeamName.textContent = teamName;
        this.playerSection.classList.remove('hidden');
        this.updateSlip();
    }

    showAllTeams() {
        if (!this.teamsData) {
            this.showError('Teams data not loaded yet');
            return;
        }

        this.displayAllTeams();
        this.hideAllSections();
        this.viewAllTeamsSection.classList.remove('hidden');
    }

    displayAllTeams() {
        this.allTeamsContainer.innerHTML = '';

        const teams = this.teamsData.teams;
        teams.forEach(teamName => {
            const teamPlayers = this.teamsData.players[teamName];
            const normalizedTeamName = this.normalizeTeamName(teamName);

            const teamSection = document.createElement('div');
            teamSection.className = 'team-section';

            teamSection.innerHTML = `
                <h3 class="team-name">${normalizedTeamName}</h3>
                <div class="team-players-grid">
                    ${teamPlayers.map(player => `
                        <div class="compact-player-card">
                            <div class="compact-player-info">
                                <span class="compact-player-name">${player.name}</span>
                                <span class="compact-cost">$${player.thisYearCost}</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;

            this.allTeamsContainer.appendChild(teamSection);
        });
    }

    normalizeTeamName(teamName) {
        return teamName.toLowerCase()
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }

    hideAllSections() {
        this.teamSection.classList.add('hidden');
        this.playerSection.classList.add('hidden');
        this.confirmationSection.classList.add('hidden');
        this.viewAllTeamsSection.classList.add('hidden');
        this.hideError();
    }

    resetForm() {
        this.teamSelect.value = '';
        this.passwordInput.value = '';
        this.selectedPlayers = [];
        this.currentTeam = null;
    }

    showError(message) {
        if (this.errorTimeout) {
            clearTimeout(this.errorTimeout);
            this.errorTimeout = null;
        }

        // On the selection screen, errors surface inside the keeper slip
        if (!this.playerSection.classList.contains('hidden')) {
            this.slipError.textContent = message;
            this.slipError.classList.remove('hidden');
            this.errorTimeout = setTimeout(() => this.hideError(), 4000);
        } else {
            this.errorMessage.textContent = message;
            this.errorMessage.classList.remove('hidden');
        }
    }

    hideError() {
        if (this.errorTimeout) {
            clearTimeout(this.errorTimeout);
            this.errorTimeout = null;
        }

        this.errorMessage.classList.add('hidden');
        this.slipError.classList.add('hidden');
    }

    initializeTheme() {
        const savedTheme = localStorage.getItem('theme') || 'dark';
        this.setTheme(savedTheme);
    }

    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        this.setTheme(newTheme);
        localStorage.setItem('theme', newTheme);
    }

    setTheme(theme) {
        if (theme === 'light') {
            document.documentElement.setAttribute('data-theme', 'light');
            this.themeToggle.textContent = '☀️';
            this.themeToggle.title = 'Switch to dark theme';
        } else {
            document.documentElement.removeAttribute('data-theme');
            this.themeToggle.textContent = '🌙';
            this.themeToggle.title = 'Switch to light theme';
        }
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new KeeperApp();
});
