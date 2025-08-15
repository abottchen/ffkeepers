class KeeperApp {
    constructor() {
        this.currentTeam = null;
        this.teamsData = null;
        this.selectedPlayers = new Set();
        
        this.initializeElements();
        this.attachEventListeners();
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
        this.errorMessage = document.getElementById('errorMessage');
    }

    attachEventListeners() {
        this.selectTeamBtn.addEventListener('click', () => this.selectTeam());
        this.submitKeepersBtn.addEventListener('click', () => this.submitKeepers());
        this.changeTeamBtn.addEventListener('click', () => this.showTeamSelection());
        this.selectAnotherBtn.addEventListener('click', () => this.showTeamSelection());
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
        this.selectedPlayers.clear();

        players.forEach((player, index) => {
            const playerDiv = document.createElement('div');
            playerDiv.className = 'player-item';
            
            playerDiv.innerHTML = `
                <input type="checkbox" id="player-${index}" value="${player.name}" 
                       data-name="${player.name}">
                <label for="player-${index}" class="player-info">
                    <span class="player-name">${player.name}</span>
                    <div class="player-costs">
                        <div class="cost">
                            <span class="cost-label">Last Year</span>
                            <span class="cost-value">$${player.lastYearCost}</span>
                        </div>
                        <div class="cost">
                            <span class="cost-label">This Year</span>
                            <span class="cost-value">$${player.thisYearCost}</span>
                        </div>
                    </div>
                </label>
            `;

            const checkbox = playerDiv.querySelector('input[type="checkbox"]');
            checkbox.addEventListener('change', (e) => this.handlePlayerSelection(e));

            this.playerList.appendChild(playerDiv);
        });
    }

    handlePlayerSelection(event) {
        const playerName = event.target.dataset.name;
        const playerDiv = event.target.closest('.player-item');
        const thisYearCostElements = playerDiv.querySelectorAll('.cost-value');
        const thisYearCost = thisYearCostElements[1].textContent.replace('$', ''); // Second cost-value is "This Year"
        
        if (event.target.checked) {
            if (this.selectedPlayers.size >= 3) {
                event.target.checked = false;
                this.showError('Maximum 3 keepers allowed');
                return;
            }
            this.selectedPlayers.add({name: playerName, cost: thisYearCost});
        } else {
            // Remove by name since we're storing objects now
            this.selectedPlayers.forEach(player => {
                if (player.name === playerName) {
                    this.selectedPlayers.delete(player);
                }
            });
        }
        
        this.hideError();
    }

    async submitKeepers() {
        const password = this.passwordInput.value.trim();
        
        if (!password) {
            this.showError('Please enter a password');
            return;
        }

        const keepersArray = Array.from(this.selectedPlayers);
        
        try {
            const response = await fetch('/api/keepers/submit', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    team: this.currentTeam,
                    players: keepersArray,
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
        this.playerSection.classList.remove('hidden');
    }

    hideAllSections() {
        this.teamSection.classList.add('hidden');
        this.playerSection.classList.add('hidden');
        this.confirmationSection.classList.add('hidden');
        this.hideError();
    }

    resetForm() {
        this.teamSelect.value = '';
        this.passwordInput.value = '';
        this.selectedPlayers.clear();
        this.currentTeam = null;
    }

    showError(message) {
        this.errorMessage.textContent = message;
        this.errorMessage.classList.remove('hidden');
    }

    hideError() {
        this.errorMessage.classList.add('hidden');
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new KeeperApp();
});