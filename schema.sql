CREATE TABLE IF NOT EXISTS plants (id TEXT PRIMARY KEY, crop TEXT NOT NULL, name TEXT NOT NULL, count INTEGER DEFAULT 0, area REAL DEFAULT 0, stage TEXT, season TEXT, lat REAL, lon REAL, last_check_at TEXT, last_observation TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS inventory (id TEXT PRIMARY KEY, name TEXT NOT NULL, active TEXT, crop TEXT, targets TEXT, label_verified INTEGER DEFAULT 0, dose TEXT, phi TEXT, stock REAL DEFAULT 0, unit TEXT DEFAULT 'đv', created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS recommendations (id TEXT PRIMARY KEY, plant_id TEXT NOT NULL, title TEXT, body TEXT, payload TEXT, status TEXT NOT NULL, source TEXT, created_at TEXT NOT NULL, updated_at TEXT, FOREIGN KEY(plant_id) REFERENCES plants(id));
CREATE TABLE IF NOT EXISTS tasks (id TEXT PRIMARY KEY, plant_id TEXT, rec_id TEXT, kind TEXT, title TEXT, scheduled_at TEXT, status TEXT NOT NULL, notes TEXT, meta TEXT, completed_at TEXT, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS observations (id TEXT PRIMARY KEY, plant_id TEXT, note TEXT, image_data TEXT, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS weather_snapshots (plant_id TEXT, captured_at TEXT, payload TEXT NOT NULL, PRIMARY KEY (plant_id, captured_at));
CREATE TABLE IF NOT EXISTS notification_log (fingerprint TEXT PRIMARY KEY, sent_at TEXT NOT NULL, channel TEXT NOT NULL, message TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT NOT NULL);
