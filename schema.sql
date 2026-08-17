CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS plants (id TEXT PRIMARY KEY, crop TEXT NOT NULL, name TEXT NOT NULL, count INTEGER, area REAL, stage TEXT, season TEXT, lat REAL, lon REAL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS inventory (id TEXT PRIMARY KEY, name TEXT NOT NULL, active TEXT, crop TEXT, targets TEXT, label_verified INTEGER DEFAULT 0, dose TEXT, phi TEXT, stock REAL DEFAULT 0, unit TEXT DEFAULT 'đv', created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS recommendations (id TEXT PRIMARY KEY, plant_id TEXT NOT NULL, title TEXT, body TEXT, payload TEXT, status TEXT NOT NULL, created_at TEXT NOT NULL, FOREIGN KEY(plant_id) REFERENCES plants(id));
CREATE TABLE IF NOT EXISTS tasks (id TEXT PRIMARY KEY, plant_id TEXT, rec_id TEXT, kind TEXT, title TEXT, scheduled_at TEXT, status TEXT NOT NULL, notes TEXT, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS observations (id TEXT PRIMARY KEY, plant_id TEXT, note TEXT, image_data TEXT, created_at TEXT NOT NULL);
