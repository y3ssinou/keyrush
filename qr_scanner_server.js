const { spawn } = require("child_process");
const path = require("path");

function scanQRCode() {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, "qr_scanner.py");
    const fs = require("fs");
    
    let pythonPath;
    const venvWinPath = path.join(__dirname, "venv", "Scripts", "python.exe");
    const venvUnixPath = path.join(__dirname, "venv", "bin", "python");
    
    if (fs.existsSync(venvWinPath)) {
      pythonPath = venvWinPath;
    } else if (fs.existsSync(venvUnixPath)) {
      pythonPath = venvUnixPath;
    } else {
      pythonPath = process.platform === "win32" ? "python" : "python3";
    }
    
    console.log(`Lancement du scanner avec: ${pythonPath}`);
    
    const env = { ...process.env };
    if (!process.env.DISPLAY) {
      env.HEADLESS = 'true';
    }
    
    const pythonProcess = spawn(pythonPath, [scriptPath], { env });

    let output = "";
    let errorOutput = "";

    pythonProcess.stdout.on("data", (data) => {
      output += data.toString();
    });

    pythonProcess.stderr.on("data", (data) => {
      errorOutput += data.toString();
    });

    pythonProcess.on("error", (err) => {
      reject(new Error(`Impossible de lancer le scanner Python: ${err.message}. Vérifie que Python est installé et que le venv existe.`));
    });

    pythonProcess.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`Scanner terminé avec le code ${code}: ${errorOutput || "Aucun QR code détecté"}`));
        return;
      }

      try {
        const data = JSON.parse(output.trim());
        if (data.nom && data.session) {
          const result = { nom: data.nom, session: parseInt(data.session, 10) };
          if (data.timestamp) {
            result.timestamp = data.timestamp;
          }
          resolve(result);
        } else {
          reject(new Error("Données QR code incomplètes"));
        }
      } catch (err) {
        reject(new Error("Impossible de parser les données du QR code: " + err.message));
      }
    });

    setTimeout(() => {
      pythonProcess.kill();
      reject(new Error("Timeout: le scanner a pris trop de temps"));
    }, 60000);
  });
}

module.exports = { scanQRCode };

