const { getDb, initDb } = require("./db");

const SNIPPETS = [
  "if (value === null || value === undefined) {\n  return;\n}",
  "function greet(name) {\n  return `Hello ${name}`;\n}",
  "const user = { id: 1, name: \"Ada\" };",
  "try {\n  risky();\n} catch (err) {\n  console.error(err);\n}",
  "import fs from \"fs\";",
  "console.log(\"Hello, world!\");",
];

const PLAYERS = [
  { name: "Ahmed", session: 5 },
  { name: "Koffi", session: 5 },
  { name: "Nour", session: 5 },
  { name: "Antoine", session: 5 },
  { name: "Fabio", session: 5 },
  { name: "Ludo", session: 5 },
  { name: "Félix-Antoine", session: 5 },
  { name: "Xavier", session: 5 },
  { name: "Andres", session: 5 },
  { name: "Maxime", session: 5 },
  { name: "Nazarie", session: 5 },
];

function seed() {
  initDb(() => {
    const db = getDb();
    runSeeds(db);
  });
}

function runSeeds(db) {
  db.serialize(() => {
    const insertPlayer = db.prepare(
      "INSERT INTO players (name, session_number, total_points) VALUES (?, ?, ?)"
    );

    PLAYERS.forEach((p) => {
      insertPlayer.run(p.name, p.session, Math.floor(Math.random() * 2000) + 100);
    });

    insertPlayer.finalize(() => {
      db.all("SELECT id FROM players", [], (err, players) => {
        if (err) {
          console.error(err);
          return;
        }

        if (!players || players.length === 0) {
          console.error("Aucun joueur trouvé pour créer les records");
          return;
        }

        const insertRecord = db.prepare(
          "INSERT INTO snippet_records (player_id, snippet_text, time_seconds) VALUES (?, ?, ?)"
        );

        SNIPPETS.forEach((snippet) => {
          const numRecords = Math.floor(Math.random() * 3) + 3;
          for (let i = 0; i < numRecords; i++) {
            const randomIndex = Math.floor(Math.random() * players.length);
            const player = players[randomIndex];
            if (player && player.id) {
              const time = Math.random() * 30 + 5;
              insertRecord.run(player.id, snippet, time);
            }
          }
        });

        insertRecord.finalize(() => {
          const insertWin = db.prepare(
            "INSERT INTO game_wins (player_id) VALUES (?)"
          );

          players.forEach((player) => {
            const numWins = Math.floor(Math.random() * 6);
            for (let i = 0; i < numWins; i++) {
              insertWin.run(player.id);
            }
          });

          insertWin.finalize(() => {
            db.all("SELECT id FROM players", [], (err, allPlayers) => {
              if (err) {
                console.error(err);
                return;
              }

              let completed = 0;
              const total = allPlayers.length;

              if (total === 0) {
                console.log("Seeds terminés !");
                return;
              }

              allPlayers.forEach((player) => {
                db.get(
                  "SELECT COUNT(*) as count FROM game_wins WHERE player_id = ?",
                  [player.id],
                  (err, result) => {
                    if (err) {
                      console.error(err);
                      completed++;
                      if (completed === total) {
                        console.log("Seeds terminés !");
                      }
                      return;
                    }
                    const wins = result.count;
                    const totalPoints = wins * 250 + 5;
                    db.run("UPDATE players SET total_points = ? WHERE id = ?", [
                      totalPoints,
                      player.id,
                    ], (err) => {
                      completed++;
                      if (completed === total) {
                        console.log("Seeds terminés !");
                      }
                    });
                  }
                );
              });
            });
          });
        });
      });
    });
  });
}

function seedDatabase() {
  const db = getDb();
  runSeeds(db);
}

if (require.main === module) {
  seed();
}

module.exports = { seedDatabase, runSeeds, PLAYERS, SNIPPETS };

