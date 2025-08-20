# Fantasy Football Keeper Selection System

A web application for managing fantasy football keeper selections. Team owners can select up to 3 players to keep for the next season, with encrypted storage of their selections.

## Quick Start

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env to set your preferences
   ```

3. **Add roster data**
   Place your CSV roster files (e.g., `ff2023rosters.csv`) in the root directory

4. **Start the server**
   ```bash
   npm start
   ```

5. **Access the application**
   Open http://localhost:3000 in your browser

## CSV File Format

Roster CSV files should follow this format:
```
TEAM1,,TEAM2,,TEAM3,,... (team names separated by double commas)
Player,$,Player,$,Player,$,... (header row)
PlayerName1,Cost1,PlayerName2,Cost2,... (player data)
```

## Usage

### Web Interface
1. Select your team from the dropdown
2. Choose up to 3 keepers by checking the boxes
3. Enter a password to encrypt your selections
4. Submit your keepers

### Command Line Decrypt
```bash
npm run decrypt <team-name> <password>
```

### Draft Tracker API Integration
The decrypt tool can automatically submit keeper selections to a fantasy draft tracker API:

```bash
npm run decrypt <team-name> <password> api=<version>
```

**Parameters:**
- `<team-name>`: Team name (matches owner name or team name from API)
- `<password>`: Password used to encrypt the selections
- `api=<version>`: Starting version number for API submissions (e.g., `api=1`)

**Example:**
```bash
npm run decrypt ADAM mypassword api=1
```

**What it does:**
1. Decrypts and displays your keeper selections
2. Fetches current owners and players from the draft tracker API
3. Matches your keepers with API player data
4. Submits each keeper to the draft tracker with calculated prices
5. Shows success/failure status for each submission

**Requirements:**
- Draft tracker API must be running and accessible
- Configure `API_BASE_URL` in `.env` (defaults to `http://localhost`)

## Development

Run in development mode with auto-reload:
```bash
npm run dev
```

## Configuration

Edit `.env` file to configure:
- `PORT`: Server port (default: 3000)
- `CURRENT_YEAR`: Which year's roster file to use
- `DATA_DIR`: Where to store application data
- `ENCRYPTED_DIR`: Where to store encrypted keeper files
- `LOG_FILE`: Where to log password information
- `API_BASE_URL`: Base URL for draft tracker API (default: http://localhost)

