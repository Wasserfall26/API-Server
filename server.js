const express = require('express');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(express.json());

// CORS für Minecraft Client
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// Supabase Client initialisieren
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// Health Check
app.get('/', async (req, res) => {
  try {
    // Zähle User ohne alle Daten zu laden
    const { count, error } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });
    
    if (error) throw error;
    
    res.json({ 
      status: 'online',
      database: 'connected',
      totalUsers: count || 0,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ 
      status: 'error',
      database: 'disconnected',
      error: err.message 
    });
  }
});

// Registrierung
app.post('/api/register', async (req, res) => {
  try {
    const { uuid, username } = req.body;
    
    if (!uuid || !username) {
      return res.status(400).json({ 
        error: 'Missing uuid or username' 
      });
    }

    // Upsert: Insert oder Update falls UUID schon existiert
    const { error: upsertError } = await supabase
      .from('users')
      .upsert({ 
        uuid: uuid,
        username: username,
        last_seen: new Date().toISOString()
      }, {
        onConflict: 'uuid'
      });
    
    if (upsertError) throw upsertError;

    // Zähle total users
    const { count, error: countError } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });
    
    if (countError) throw countError;

    console.log(`Registered: ${username} (${uuid})`);
    
    res.json({ 
      success: true,
      totalUsers: count || 0,
      message: 'Successfully registered'
    });
    
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ 
      error: err.message 
    });
  }
});

// Check ob User registriert ist
app.get('/api/check/:uuid', async (req, res) => {
  try {
    const { uuid } = req.params;
    
    if (!uuid) {
      return res.status(400).json({ error: 'Missing uuid' });
    }

    const { data, error } = await supabase
      .from('users')
      .select('uuid, username')
      .eq('uuid', uuid)
      .maybeSingle(); // Gibt null zurück statt Fehler wenn nicht gefunden
    
    if (error) throw error;

    res.json({ 
      hasMod: !!data,
      ...(data && { username: data.username })
    });
    
  } catch (err) {
    console.error('Check error:', err);
    res.status(500).json({ 
      error: err.message 
    });
  }
});

// Optional: Liste aller User (für Debugging)
app.get('/api/users', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('uuid, username, last_seen')
      .order('last_seen', { ascending: false })
      .limit(100); // Nur erste 100
    
    if (error) throw error;

    res.json({ 
      total: data.length,
      users: data 
    });
    
  } catch (err) {
    console.error('List error:', err);
    res.status(500).json({ 
      error: err.message 
    });
  }
});

// Optional: User löschen (für GDPR/Testing)
app.delete('/api/user/:uuid', async (req, res) => {
  try {
    const { uuid } = req.params;
    
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('uuid', uuid);
    
    if (error) throw error;

    res.json({ 
      success: true,
      message: 'User deleted'
    });
    
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ 
      error: err.message 
    });
  }
});

// Server starten
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Cape API Server running on port ${PORT}`);
  console.log(`📊 Using Supabase: ${process.env.SUPABASE_URL}`);
});

// Graceful Shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});
