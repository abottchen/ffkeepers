# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is a Fantasy Football keeper selection system built with Node.js and Express. The application allows team owners to select keeper players for the upcoming season with encrypted storage of their selections. It has been modernized from a legacy Perl CGI application.

## Key Components

### Backend (Node.js/Express)
- **src/server.js**: Main Express server, listens on configurable port (default 3000)
- **src/routes/keepers.js**: REST API endpoints for keeper selection
- **src/services/csvService.js**: Handles CSV parsing and roster data management
- **src/services/encryptionService.js**: AES-256-CBC encryption for keeper selections
- **src/decrypt.js**: Command-line utility to decrypt saved selections

### Frontend
- **public/index.html**: Single-page application structure
- **public/js/app.js**: Vanilla JavaScript application logic
- **public/css/style.css**: Responsive CSS with mobile support

### Data
- **ff*rosters.csv**: Yearly roster data files (CSV format with team names and player costs)
- **data/encrypted/**: Encrypted keeper selection files
- **data/keepers.log**: Password recovery log

## Architecture

### Data Flow
1. CSV roster files contain team/player data in double-comma separated format
2. Server reads roster file based on CURRENT_YEAR in .env
3. Frontend fetches data via REST API
4. Users select team and up to 3 keeper players
5. Selections encrypted with AES-256-CBC and saved to data/encrypted/{teamname}.enc
6. Passwords logged to data/keepers.log for recovery

### Key Functions
- `calculateKeeperCost()`: 10% increase rounded up, minimum $1 increase
- `encrypt()/decrypt()`: AES-256-CBC encryption using Node.js crypto
- `loadRosterData()`: Parses CSV files into structured data

## Development Commands

```bash
# Install dependencies
npm install

# Start production server
npm start

# Start development server with auto-reload
npm run dev

# Decrypt keeper selections
npm run decrypt <team-name> <password>
```

## API Endpoints

- `GET /api/keepers/teams`: Get all teams and rosters
- `GET /api/keepers/team/:teamName`: Get specific team roster
- `POST /api/keepers/submit`: Submit keeper selections
- `POST /api/keepers/decrypt`: Decrypt saved selections

## Configuration (.env)

- `PORT`: Server port (default: 3000)
- `CURRENT_YEAR`: Which roster CSV to use (e.g., 2023)
- `DATA_DIR`: Base data directory
- `ENCRYPTED_DIR`: Where to store encrypted files
- `LOG_FILE`: Password recovery log location

## Important Notes

- Maximum 3 keepers per team enforced in frontend and backend
- Passwords are logged in plaintext for recovery (legacy behavior maintained)
- Year must be updated in .env when new roster CSVs are added
- No authentication layer - consider adding for production use