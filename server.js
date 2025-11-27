const express = require("express");
const cors = require("cors");
const { getDb, initDb } = require("./db");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const db = getDb();
initDb(() => {
  console.log("Tables créées");
  
  db.get("SELECT COUNT(*) as count FROM players", [], (err, result) => {
    if (err) {
      console.error("Erreur vérification DB:", err);
      return;
    }
    
    if (result && result.count === 0) {
      console.log("Base de données vide, initialisation avec des données de test...");
      const { seedDatabase } = require("./seeds");
      seedDatabase();
    } else {
      console.log(`Base de données contient ${result ? result.count : 0} joueurs`);
    }
  });
});

app.get("/api/snippet-records", (req, res) => {
  db.all(
    `SELECT 
      sr.snippet_text,
      sr.time_seconds,
      p.name as player_name,
      p.session_number,
      sr.created_at
    FROM snippet_records sr
    JOIN players p ON sr.player_id = p.id
    ORDER BY sr.snippet_text, sr.time_seconds ASC`,
    [],
    (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }

      const bestBySnippet = {};
      rows.forEach((row) => {
        if (
          !bestBySnippet[row.snippet_text] ||
          bestBySnippet[row.snippet_text].time_seconds > row.time_seconds
        ) {
          bestBySnippet[row.snippet_text] = row;
        }
      });

      res.json(Object.values(bestBySnippet));
    }
  );
});

app.get("/api/top-players", (req, res) => {
  db.all(
    `SELECT 
      p.id,
      p.name,
      p.session_number,
      p.total_points,
      COUNT(gw.id) as wins
    FROM players p
    LEFT JOIN game_wins gw ON p.id = gw.player_id
    GROUP BY p.id
    ORDER BY p.total_points DESC
    LIMIT 20`,
    [],
    (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
        db.close();
        return;
      }
      res.json(rows);
    }
  );
});

app.post("/api/snippet-records", (req, res) => {
  const { player_id, snippet_text, time_seconds } = req.body;
  db.run(
    "INSERT INTO snippet_records (player_id, snippet_text, time_seconds) VALUES (?, ?, ?)",
    [player_id, snippet_text, time_seconds],
    function (err) {
      if (err) {
        res.status(500).json({ error: err.message });
        db.close();
        return;
      }
      res.json({ id: this.lastID });
    }
  );
});

app.post("/api/game-wins", (req, res) => {
  const { player_id } = req.body;
  db.run("INSERT INTO game_wins (player_id) VALUES (?)", [player_id], function (err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    db.get("SELECT COUNT(*) as count FROM game_wins WHERE player_id = ?", [player_id], (err, result) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      const totalPoints = result.count * 250 + 5;
      db.run("UPDATE players SET total_points = ? WHERE id = ?", [totalPoints, player_id], function (err) {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        res.json({ id: this.lastID, total_points: totalPoints });
      });
    });
  });
});

app.post("/api/players", (req, res) => {
  const { name, session_number } = req.body;
  
  if (!name || !session_number) {
    res.status(400).json({ error: "name et session_number requis" });
    return;
  }

  db.get(
    "SELECT * FROM players WHERE name = ?",
    [name],
    (err, existingPlayer) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }

      if (existingPlayer) {
        if (existingPlayer.session_number !== session_number) {
          db.run(
            "UPDATE players SET session_number = ? WHERE id = ?",
            [session_number, existingPlayer.id],
            (updateErr) => {
              if (updateErr) {
                res.status(500).json({ error: updateErr.message });
                return;
              }
              res.json({
                id: existingPlayer.id,
                name: existingPlayer.name,
                session_number: session_number,
                total_points: existingPlayer.total_points,
                isNew: false
              });
            }
          );
        } else {
          res.json({
            id: existingPlayer.id,
            name: existingPlayer.name,
            session_number: existingPlayer.session_number,
            total_points: existingPlayer.total_points,
            isNew: false
          });
        }
      } else {
        db.run(
          "INSERT INTO players (name, session_number, total_points) VALUES (?, ?, 5)",
          [name, session_number],
          function (err) {
            if (err) {
              if (err.message.includes("UNIQUE constraint")) {
                db.get("SELECT * FROM players WHERE name = ?", [name], (retryErr, player) => {
                  if (retryErr) {
                    res.status(500).json({ error: retryErr.message });
                    return;
                  }
                  if (player) {
                    res.json({
                      id: player.id,
                      name: player.name,
                      session_number: player.session_number,
                      total_points: player.total_points,
                      isNew: false
                    });
                  } else {
                    res.status(500).json({ error: "Erreur lors de la création du joueur" });
                  }
                });
              } else {
                res.status(500).json({ error: err.message });
              }
              return;
            }
            res.json({
              id: this.lastID,
              name: name,
              session_number: session_number,
              total_points: 5,
              isNew: true
            });
          }
        );
      }
    }
  );
});

app.get("/api/players", (req, res) => {
  const { name, session_number } = req.query;
  
  if (!name) {
    res.status(400).json({ error: "name requis" });
    return;
  }
  
  db.get(
    "SELECT * FROM players WHERE name = ?",
    [name],
    (err, row) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      if (!row) {
        res.status(404).json({ error: "Joueur non trouvé" });
        return;
      }
      res.json(row);
    }
  );
});

app.post("/api/players/:id/add-points", (req, res) => {
  const playerId = parseInt(req.params.id, 10);
  const { points } = req.body;

  if (!points || isNaN(points)) {
    res.status(400).json({ error: "points requis" });
    return;
  }

  db.get("SELECT total_points FROM players WHERE id = ?", [playerId], (err, player) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }

    if (!player) {
      res.status(404).json({ error: "Joueur non trouvé" });
      return;
    }

    const newTotal = player.total_points + points;
    db.run("UPDATE players SET total_points = ? WHERE id = ?", [newTotal, playerId], function (err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ id: playerId, total_points: newTotal });
    });
  });
});

app.post("/api/seed", (req, res) => {
  db.get("SELECT COUNT(*) as count FROM players", [], (err, result) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    if (result && result.count > 0) {
      res.status(400).json({ error: "La base de données contient déjà des données. Utilisez /api/reset-seed pour réinitialiser." });
      return;
    }
    
    console.log("Initialisation de la base de données avec des données de test...");
    const { seedDatabase } = require("./seeds");
    seedDatabase();
    res.json({ message: "Base de données initialisée avec des données de test" });
  });
});

app.post("/api/reset-seed", (req, res) => {
  const { getDb } = require("./db");
  const db2 = getDb();
  
  db2.serialize(() => {
    db2.run("DELETE FROM game_wins", (err) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      db2.run("DELETE FROM snippet_records", (err) => {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        db2.run("DELETE FROM players", (err) => {
          if (err) {
            res.status(500).json({ error: err.message });
            return;
          }
          console.log("Base de données réinitialisée, ajout des seeds...");
          const { seedDatabase } = require("./seeds");
          seedDatabase();
          res.json({ message: "Base de données réinitialisée et remplie avec des données de test" });
        });
      });
    });
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
});

