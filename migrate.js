const { getDb } = require("./db");
const fs = require("fs");
const path = require("path");

const DB_PATH = path.join(__dirname, "keyrush.db");

function migrate() {
  console.log("Début de la migration...");
  
  if (!fs.existsSync(DB_PATH)) {
    console.log("Base de données n'existe pas encore, pas besoin de migration");
    return;
  }

  const db = getDb();

  db.all(
    `SELECT name, COUNT(*) as count 
     FROM players 
     GROUP BY name 
     HAVING count > 1`,
    [],
    (err, duplicates) => {
      if (err) {
        console.error("Erreur lors de la vérification des doublons:", err);
        db.close();
        return;
      }

      if (duplicates.length > 0) {
        console.log("ATTENTION: Des joueurs avec le même nom ont été trouvés:");
        duplicates.forEach(dup => {
          console.log(`  - ${dup.name}: ${dup.count} occurrences`);
        });
        console.log("\nPour appliquer la contrainte UNIQUE, vous devez:");
        console.log("1. Supprimer les doublons manuellement");
        console.log("2. Ou supprimer la base de données (keyrush.db) et relancer les seeds");
        console.log("\nPour supprimer la base de données, exécutez:");
        console.log("  rm keyrush.db  (Linux/WSL)");
        console.log("  del keyrush.db  (Windows)");
        db.close();
        return;
      }

      console.log("Aucun doublon trouvé. Application de la contrainte UNIQUE...");

      db.serialize(() => {
        db.run(`
          CREATE TABLE IF NOT EXISTS players_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            session_number INTEGER NOT NULL CHECK(session_number >= 1 AND session_number <= 5),
            total_points INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `, (err) => {
          if (err) {
            console.error("Erreur création table temporaire:", err);
            db.close();
            return;
          }

          db.run(`
            INSERT INTO players_new (id, name, session_number, total_points, created_at)
            SELECT id, name, session_number, total_points, created_at
            FROM players
          `, (err) => {
            if (err) {
              console.error("Erreur copie des données:", err);
              db.close();
              return;
            }

            db.run("DROP TABLE players", (err) => {
              if (err) {
                console.error("Erreur suppression ancienne table:", err);
                db.close();
                return;
              }

              db.run("ALTER TABLE players_new RENAME TO players", (err) => {
                if (err) {
                  console.error("Erreur renommage table:", err);
                  db.close();
                  return;
                }

                console.log("Migration terminée avec succès!");
                db.close();
              });
            });
          });
        });
      });
    }
  );
}

migrate();

