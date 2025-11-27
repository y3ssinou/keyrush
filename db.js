const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const DB_PATH = path.join(__dirname, "keyrush.db");

function getDb() {
  return new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
      console.error("Erreur ouverture DB:", err.message);
    } else {
      console.log("Connexion à SQLite réussie");
    }
  });
}

function initDb(callback) {
  const db = getDb();
  let completed = 0;
  const total = 3;

  db.run(`
    CREATE TABLE IF NOT EXISTS players (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      session_number INTEGER NOT NULL CHECK(session_number >= 1 AND session_number <= 5),
      total_points INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, () => {
    completed++;
    if (completed === total && callback) callback();
  });

  db.run(`
    CREATE TABLE IF NOT EXISTS snippet_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      player_id INTEGER NOT NULL,
      snippet_text TEXT NOT NULL,
      time_seconds REAL NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (player_id) REFERENCES players(id)
    )
  `, () => {
    completed++;
    if (completed === total && callback) callback();
  });

  db.run(`
    CREATE TABLE IF NOT EXISTS game_wins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      player_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (player_id) REFERENCES players(id)
    )
  `, () => {
    completed++;
    if (completed === total && callback) callback();
  });
}

module.exports = { getDb, initDb };

