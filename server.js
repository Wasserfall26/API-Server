const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// In-Memory Speicher für registrierte Mod-Users
// Format: { uuid: { lastSeen: timestamp, username: string } }
const modUsers = new Map();

// Cleanup alte Einträge (älter als 30 Tage)
setInterval(() => {
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    for (const [uuid, data] of modUsers.entries()) {
        if (data.lastSeen < thirtyDaysAgo) {
            modUsers.delete(uuid);
        }
    }
}, 24 * 60 * 60 * 1000); // Täglich checken

// Health Check
app.get('/', (req, res) => {
    res.json({ 
        status: 'online',
        modUsers: modUsers.size,
        version: '1.0.0'
    });
});

// Registriere einen Mod-User (Heartbeat)
// POST /api/register
// Body: { uuid: string, username: string }
app.post('/api/register', (req, res) => {
    const { uuid, username } = req.body;
    
    if (!uuid || typeof uuid !== 'string') {
        return res.status(400).json({ error: 'Invalid UUID' });
    }
    
    modUsers.set(uuid, {
        lastSeen: Date.now(),
        username: username || 'Unknown'
    });
    
    res.json({ 
        success: true,
        registered: true,
        totalUsers: modUsers.size
    });
});

// Prüfe ob ein User die Mod hat
// GET /api/check/:uuid
app.get('/api/check/:uuid', (req, res) => {
    const { uuid } = req.params;
    
    if (!uuid) {
        return res.status(400).json({ error: 'UUID required' });
    }
    
    const userData = modUsers.get(uuid);
    const hasModUser = !!userData;
    
    res.json({
        uuid: uuid,
        hasMod: hasModUser,
        lastSeen: userData ? userData.lastSeen : null,
        username: userData ? userData.username : null
    });
});

// Batch-Check für mehrere UUIDs
// POST /api/check-batch
// Body: { uuids: [string] }
app.post('/api/check-batch', (req, res) => {
    const { uuids } = req.body;
    
    if (!Array.isArray(uuids)) {
        return res.status(400).json({ error: 'UUIDs array required' });
    }
    
    const results = {};
    for (const uuid of uuids) {
        const userData = modUsers.get(uuid);
        results[uuid] = {
            hasMod: !!userData,
            lastSeen: userData ? userData.lastSeen : null
        };
    }
    
    res.json({ results });
});

// Statistiken
app.get('/api/stats', (req, res) => {
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);
    const oneDayAgo = now - (24 * 60 * 60 * 1000);
    
    let activeLastHour = 0;
    let activeLastDay = 0;
    
    for (const [uuid, data] of modUsers.entries()) {
        if (data.lastSeen > oneHourAgo) activeLastHour++;
        if (data.lastSeen > oneDayAgo) activeLastDay++;
    }
    
    res.json({
        totalRegistered: modUsers.size,
        activeLastHour,
        activeLastDay
    });
});

app.listen(PORT, () => {
    console.log(`KK Mod Cape API running on port ${PORT}`);
    console.log(`Registered users: ${modUsers.size}`);
});
