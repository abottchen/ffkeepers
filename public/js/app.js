class KeeperApp {
    constructor() {
        this.currentTeam = null;
        this.teamsData = null;
        this.selectedPlayers = new Set();
        
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
        this.progressIndicator = document.getElementById('progressIndicator');
        this.salaryCapDisplay = document.getElementById('salaryCapDisplay');
        this.stickySubmit = document.getElementById('stickySubmit');
        this.stickyProgressText = document.getElementById('stickyProgressText');
        this.stickyBudgetText = document.getElementById('stickyBudgetText');
        this.passwordSection = document.getElementById('passwordSection');
        this.stickyErrorMessage = document.getElementById('stickyErrorMessage');
        this.themeToggle = document.getElementById('themeToggle');
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
        this.updateProgressAndSalaryCap();

        players.forEach((player, index) => {
            const playerCard = document.createElement('div');
            playerCard.className = 'player-card';
            playerCard.dataset.playerName = player.name;
            playerCard.dataset.cost = player.thisYearCost;
            
            playerCard.innerHTML = `
                <div class="player-info">
                    <div>
                        <div class="player-name">${player.name}</div>
                    </div>
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
                </div>
            `;
            
            playerCard.addEventListener('click', (e) => {
                this.handleCardSelection(playerCard, player);
            });
            
            this.playerList.appendChild(playerCard);
        });
    }

    
    handleCardSelection(playerCard, player) {
        const isSelected = playerCard.classList.contains('selected');
        const playerName = player.name;
        
        if (isSelected) {
            // Deselect player
            playerCard.classList.remove('selected');
            // Remove by finding the matching player object
            this.selectedPlayers.forEach(selectedPlayer => {
                if (selectedPlayer.name === playerName) {
                    this.selectedPlayers.delete(selectedPlayer);
                }
            });
        } else {
            // Check if we can select more players
            if (this.selectedPlayers.size >= 3) {
                this.showError('You can only select up to 3 keepers');
                return;
            }
            
            // Select player
            playerCard.classList.add('selected');
            this.selectedPlayers.add({ name: player.name, cost: player.thisYearCost });
        }
        
        this.updateProgressAndSalaryCap();
        this.updateStickySubmit();
        this.hideError();
    }

    handlePlayerSelection(event) {
        // Legacy method - can be removed if not used elsewhere
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
        
        this.updateProgressAndSalaryCap();
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
        this.stickySubmit.classList.remove('hidden');
        document.body.classList.add('sticky-submit-visible');
        this.updateStickySubmit();
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
        this.stickySubmit.classList.add('hidden');
        document.body.classList.remove('sticky-submit-visible');
        this.hideError();
    }

    resetForm() {
        this.teamSelect.value = '';
        this.passwordInput.value = '';
        this.selectedPlayers.clear();
        this.currentTeam = null;
    }

    showError(message) {
        // Clear any existing timeout
        if (this.errorTimeout) {
            clearTimeout(this.errorTimeout);
        }
        
        // Show error in sticky panel if it's visible, otherwise use regular error message
        if (!this.stickySubmit.classList.contains('hidden')) {
            this.stickyErrorMessage.textContent = message;
            this.stickyErrorMessage.classList.remove('hidden', 'fade-out');
            
            // Auto-fade after 3 seconds
            this.errorTimeout = setTimeout(() => {
                this.fadeOutStickyError();
            }, 3000);
        } else {
            this.errorMessage.textContent = message;
            this.errorMessage.classList.remove('hidden');
        }
    }

    fadeOutStickyError() {
        this.stickyErrorMessage.classList.add('fade-out');
        // Hide completely after fade animation completes
        setTimeout(() => {
            this.stickyErrorMessage.classList.add('hidden');
            this.stickyErrorMessage.classList.remove('fade-out');
        }, 300); // Match CSS animation duration
    }

    hideError() {
        // Clear any pending timeout
        if (this.errorTimeout) {
            clearTimeout(this.errorTimeout);
            this.errorTimeout = null;
        }
        
        this.errorMessage.classList.add('hidden');
        this.stickyErrorMessage.classList.add('hidden');
        this.stickyErrorMessage.classList.remove('fade-out');
    }

    updateProgressAndSalaryCap() {
        const selectedCount = this.selectedPlayers.size;
        const maxKeepers = 3;
        
        // Update progress indicator
        if (this.progressIndicator) {
            this.progressIndicator.textContent = `${selectedCount} of ${maxKeepers} keepers selected`;
            this.progressIndicator.className = 'progress-indicator';
            
            if (selectedCount === 0) {
                this.progressIndicator.classList.add('empty');
            } else if (selectedCount === maxKeepers) {
                this.progressIndicator.classList.add('complete');
            } else {
                this.progressIndicator.classList.add('partial');
            }
        }
        
        // Update salary cap display
        if (this.salaryCapDisplay) {
            const totalCost = Array.from(this.selectedPlayers).reduce((sum, player) => {
                return sum + parseInt(player.cost);
            }, 0);
            
            this.salaryCapDisplay.innerHTML = `
                <div class="salary-summary">
                    <span class="total-cost">Total Keeper Cost: <strong>$${totalCost}</strong></span>
                    <span class="remaining-budget">Remaining Budget: <strong>$${200 - totalCost}</strong></span>
                </div>
            `;
            
            // Add visual feedback for budget status
            this.salaryCapDisplay.className = 'salary-cap-display';
            if (totalCost > 200) {
                this.salaryCapDisplay.classList.add('over-budget');
            } else if (totalCost > 150) {
                this.salaryCapDisplay.classList.add('near-budget');
            } else {
                this.salaryCapDisplay.classList.add('under-budget');
            }
        }
    }

    updateStickySubmit() {
        const selectedCount = this.selectedPlayers.size;
        const totalCost = Array.from(this.selectedPlayers).reduce((sum, player) => {
            return sum + parseInt(player.cost);
        }, 0);
        
        // Update progress text
        if (selectedCount === 0) {
            this.stickyProgressText.textContent = 'Select up to 3 keepers';
        } else if (selectedCount === 1) {
            this.stickyProgressText.textContent = '1 keeper selected';
        } else if (selectedCount === 2) {
            this.stickyProgressText.textContent = '2 keepers selected';
        } else {
            this.stickyProgressText.textContent = '3 keepers selected';
        }
        
        // Update budget text
        this.stickyBudgetText.textContent = `Budget: $${200 - totalCost}`;
        this.stickyBudgetText.className = 'submit-budget';
        if (totalCost > 200) {
            this.stickyBudgetText.classList.add('over-budget');
            this.stickyBudgetText.textContent = `Over budget: -$${totalCost - 200}`;
        } else if (totalCost > 150) {
            this.stickyBudgetText.classList.add('near-budget');
        }
        
        // Show/hide password field and enable submit button
        if (selectedCount > 0) {
            this.passwordSection.classList.remove('hidden');
            this.submitKeepersBtn.disabled = false;
        } else {
            this.passwordSection.classList.add('hidden');
            this.submitKeepersBtn.disabled = true;
        }
    }

    initializeTheme() {
        // Load saved theme preference or default to dark
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