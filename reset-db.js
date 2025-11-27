const { getDb, initDb } = require("./db");
const fs = require("fs");
const path = require("path");

const DB_PATH = path.join(__dirname, "keyrush.db");

function resetDatabase() {
  console.log("Réinitialisation de la base de données...\n");
  
  if (fs.existsSync(DB_PATH)) {
    try {
      const db = getDb();
      db.close((err) => {
        if (err) {
          console.log("Fermeture de la connexion existante...");
        }
        
        try {
          fs.unlinkSync(DB_PATH);
          console.log("Fichier keyrush.db supprimé");
        } catch (unlinkErr) {
          console.error("Erreur lors de la suppression du fichier:", unlinkErr.message);
          console.log("Tentative de suppression des tables...");
          
          const db2 = getDb();
          db2.serialize(() => {
            db2.run("DROP TABLE IF EXISTS game_wins");
            db2.run("DROP TABLE IF EXISTS snippet_records");
            db2.run("DROP TABLE IF EXISTS players", () => {
              db2.close();
              recreateTables();
            });
          });
          return;
        }
        
        recreateTables();
      });
    } catch (err) {
      console.error("Erreur:", err.message);
      try {
        fs.unlinkSync(DB_PATH);
        console.log("Fichier keyrush.db supprimé");
        recreateTables();
      } catch (e) {
        console.error("Impossible de supprimer le fichier:", e.message);
        process.exit(1);
      }
    }
  } else {
    console.log("Base de données n'existe pas encore, création...");
    recreateTables();
  }
}

function recreateTables() {
  console.log("\nRecréation des tables...");
  
  initDb(() => {
    console.log("Tables recréées");
    console.log("\nBase de données réinitialisée avec succès!");
    console.log("\nPour remplir la base avec des données de test, exécutez:");
    console.log("npm run seed");
    process.exit(0);
  });
}

resetDatabase();

