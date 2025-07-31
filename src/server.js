const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
require('dotenv').config();

const keeperRoutes = require('./routes/keepers');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));

// Routes
app.use('/api/keepers', keeperRoutes);

// Serve main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

app.listen(PORT, () => {
    console.log(`Fantasy Football Keepers app listening on port ${PORT}`);
    console.log(`Visit http://localhost:${PORT} to access the application`);
});