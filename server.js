if (process.env.NODE_ENV !== "production") {
  try {
    require("dotenv").config();
  } catch (e) {
  }
}

const express = require("express");
const cors = require("cors");
const http = require("http");
const WebSocket = require("ws");
const { getDb, initDb } = require("./db");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const WS_PORT = process.env.WS_PORT || 8080;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

app.get("/secrethihi", (req, res) => {
  res.sendFile(path.join(__dirname, "admin.html"));
});

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

app.get("/api/admin/players", requireAdminKey, (req, res) => {
  db.all(
    `SELECT 
      p.id,
      p.name,
      p.session_number,
      p.total_points,
      p.created_at,
      COUNT(gw.id) as wins
    FROM players p
    LEFT JOIN game_wins gw ON p.id = gw.player_id
    GROUP BY p.id
    ORDER BY p.created_at DESC`,
    [],
    (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json(rows);
    }
  );
});

app.get("/api/admin/snippet-records", requireAdminKey, (req, res) => {
  db.all(
    `SELECT 
      sr.id,
      sr.player_id,
      sr.snippet_text,
      sr.time_seconds,
      sr.created_at,
      p.name as player_name,
      p.session_number
    FROM snippet_records sr
    JOIN players p ON sr.player_id = p.id
    ORDER BY sr.created_at DESC`,
    [],
    (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json(rows);
    }
  );
});

app.put("/api/admin/players/:id", requireAdminKey, (req, res) => {
  const playerId = parseInt(req.params.id, 10);
  const { name, session_number, total_points } = req.body;

  if (!name || !session_number || total_points === undefined) {
    res.status(400).json({ error: "name, session_number et total_points requis" });
    return;
  }

  db.run(
    "UPDATE players SET name = ?, session_number = ?, total_points = ? WHERE id = ?",
    [name, session_number, total_points, playerId],
    function (err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      if (this.changes === 0) {
        res.status(404).json({ error: "Joueur non trouvé" });
        return;
      }
      db.get("SELECT * FROM players WHERE id = ?", [playerId], (err, player) => {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        res.json(player);
      });
    }
  );
});

app.delete("/api/admin/players/:id", requireAdminKey, (req, res) => {
  const playerId = parseInt(req.params.id, 10);

  db.serialize(() => {
    db.run("DELETE FROM game_wins WHERE player_id = ?", [playerId], (err) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      db.run("DELETE FROM snippet_records WHERE player_id = ?", [playerId], (err) => {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        db.run("DELETE FROM players WHERE id = ?", [playerId], function (err) {
          if (err) {
            res.status(500).json({ error: err.message });
            return;
          }
          if (this.changes === 0) {
            res.status(404).json({ error: "Joueur non trouvé" });
            return;
          }
          res.json({ message: "Joueur supprimé avec succès" });
        });
      });
    });
  });
});

app.put("/api/admin/snippet-records/:id", requireAdminKey, (req, res) => {
  const recordId = parseInt(req.params.id, 10);
  const { snippet_text, time_seconds } = req.body;

  if (!snippet_text || time_seconds === undefined) {
    res.status(400).json({ error: "snippet_text et time_seconds requis" });
    return;
  }

  db.run(
    "UPDATE snippet_records SET snippet_text = ?, time_seconds = ? WHERE id = ?",
    [snippet_text, time_seconds, recordId],
    function (err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      if (this.changes === 0) {
        res.status(404).json({ error: "Record non trouvé" });
        return;
      }
      db.get(
        `SELECT sr.*, p.name as player_name, p.session_number 
         FROM snippet_records sr 
         JOIN players p ON sr.player_id = p.id 
         WHERE sr.id = ?`,
        [recordId],
        (err, record) => {
          if (err) {
            res.status(500).json({ error: err.message });
            return;
          }
          res.json(record);
        }
      );
    }
  );
});

app.delete("/api/admin/snippet-records/:id", requireAdminKey, (req, res) => {
  const recordId = parseInt(req.params.id, 10);

  db.run("DELETE FROM snippet_records WHERE id = ?", [recordId], function (err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (this.changes === 0) {
      res.status(404).json({ error: "Record non trouvé" });
      return;
    }
    res.json({ message: "Record supprimé avec succès" });
  });
});

app.get("/api/stats", requireAdminKey, (req, res) => {
  db.get("SELECT COUNT(*) as count FROM players", [], (err, playersResult) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    db.get("SELECT COUNT(*) as count FROM snippet_records", [], (err, recordsResult) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      db.get("SELECT COUNT(*) as count FROM game_wins", [], (err, winsResult) => {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        
        res.json({
          players: playersResult.count,
          records: recordsResult.count,
          wins: winsResult.count
        });
      });
    });
  });
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

function requireAdminKey(req, res, next) {
  const adminKey = process.env.ADMIN_KEY || "mdp1234";
  const providedKey = req.headers["x-admin-key"] || req.body.adminKey;
  
  if (!providedKey || providedKey !== adminKey) {
    res.status(401).json({ error: "Accès non autorisé. Clé admin requise." });
    return;
  }
  next();
}

app.post("/api/seed", requireAdminKey, (req, res) => {
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

app.post("/api/reset-seed", requireAdminKey, (req, res) => {
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

app.post("/api/clear-db", requireAdminKey, (req, res) => {
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
          console.log("Base de données vidée");
          res.json({ message: "Base de données vidée avec succès" });
        });
      });
    });
  });
});

const server = http.createServer(app);

const wss = new WebSocket.Server({ port: WS_PORT });
const clients = new Map();

function safeSend(ws, obj) {
  if (ws.readyState === WebSocket.OPEN) {
    try { ws.send(JSON.stringify(obj)); } catch (e) {}
  }
}

function broadcastToBrowsers(obj) {
  const raw = JSON.stringify(obj);
  for (const [c, meta] of clients.entries()) {
    if (meta && meta.role === 'browser' && c.readyState === WebSocket.OPEN) {
      try { c.send(raw); } catch (e) {}
    }
  }
}

wss.on('connection', (ws, req) => {
  console.log('[WebSocket] Connexion établie depuis', req.socket.remoteAddress);
  clients.set(ws, { role: 'browser' });

  let first = true;
  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch (e) {
      console.log('[WebSocket] Message non-JSON reçu:', raw.toString());
      return;
    }

    if (first) {
      first = false;
      if (msg.role === 'device' && msg.deviceId) {
        clients.set(ws, { role: 'device', deviceId: msg.deviceId });
        console.log(`[WebSocket] Client identifié comme device: ${msg.deviceId}`);
        safeSend(ws, { server: 'ok', note: 'registered as device', deviceId: msg.deviceId });
        return;
      } else {
        clients.set(ws, { role: 'browser' });
        console.log('[WebSocket] Client par défaut: browser');
        return;
      }
    }

    const meta = clients.get(ws) || {};
    if (meta.role === 'device') {
      msg.serverTs = Date.now();
      console.log(`[device ${meta.deviceId}] ->`, msg);
      broadcastToBrowsers(msg);
      safeSend(ws, { ack: msg.seq ?? null, serverTs: Date.now() });
    } else {
      console.log('[browser] Message reçu', msg);
    }
  });

  ws.on('close', () => {
    const meta = clients.get(ws) || {};
    console.log('[WebSocket] Connexion fermée', meta.role, meta.deviceId || '');
    clients.delete(ws);
  });

  ws.on('error', (err) => {
    console.log('[WebSocket] Erreur', err && err.message);
    clients.delete(ws);
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
  console.log(`WebSocket serveur démarré sur le port ${WS_PORT}`);
});

