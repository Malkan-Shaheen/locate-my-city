const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();


// Allow your Vercel frontend in production, localhost in dev
const allowedOrigins = [
  'http://localhost:3000',             // local dev
  'https://locate-my-city.vercel.app' , // your Vercel frontend
  'https://locate-my-city-blue.vercel.app'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
}));

// Load data at startup
let rockCities = [];
let springCities = {};

function flattenStateGroupedData(data) {
    return Object.keys(data).flatMap(state => 
        data[state].map(item => ({ ...item, state }))
    );
}

try {
    rockCities = JSON.parse(fs.readFileSync(path.join(__dirname, 'rock_cities.json'), 'utf8'));
} catch (error) {
    console.error('Error loading rock_cities.json:', error.message);
    rockCities = [];
}

try {
    springCities = JSON.parse(fs.readFileSync(path.join(__dirname, 'spring_cities.json'), 'utf8'));
} catch (error) {
    console.error('Error loading spring_cities.json:', error.message);
    springCities = {};
}

// Routes
app.get('/api/locations', (req, res) => {
    res.json(rockCities);
});

app.get('/api/states', (req, res) => {
    const states = [...new Set(rockCities.map(item => item.state))].sort();
    res.json(states);
});

app.get('/api/locations/:state', (req, res) => {
    const stateLocations = rockCities.filter(item => item.state === req.params.state);
    res.json(stateLocations);
});

app.get('/api/springs', (req, res) => {
    res.json(springCities);
});

app.get('/api/springs/flat', (req, res) => {
    res.json(flattenStateGroupedData(springCities));
});

app.get('/api/springs/states', (req, res) => {
    res.json(Object.keys(springCities).sort());
});

app.get('/api/springs/:state', (req, res) => {
    res.json(springCities[req.params.state] || []);
});

app.get('/api/stats', (req, res) => {
    const flatSprings = flattenStateGroupedData(springCities);
    res.json({
        rockCities: {
            total: rockCities.length,
            states: [...new Set(rockCities.map(item => item.state))].length
        },
        springCities: {
            total: flatSprings.length,
            states: Object.keys(springCities).length
        }
    });
});

// Simple test route
app.get('/ping', (req, res) => {
    res.json({ message: 'Backend is running!' });
});

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
