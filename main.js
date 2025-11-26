const SNIPPETS = [
  'for (let i = 0; i < 3; i++) {\n  console.log(i);\n}',
  'const sum = (a, b) => a + b;',
  'if (value === null || value === undefined) {\n  return;\n}',
  'const nums = [1, 2, 3].map(n => n * 2);',
  'function greet(name) {\n  return `Hello ${name}`;\n}',
  'const user = { id: 1, name: "Ada" };',
  'const filtered = items.filter(x => x.active);',
  'const total = prices.reduce((acc, p) => acc + p, 0);',
  'try {\n  risky();\n} catch (err) {\n  console.error(err);\n}',
  'const delay = ms => new Promise(r => setTimeout(r, ms));',
  'import fs from "fs";',
  'console.log("Hello, world!");',
];

const MAX_SCORE = 10;
const GAME_DURATION_SECONDS = 10 * 60; // 10 minutes

const snippetP1 = document.getElementById("snippet-p1");
const snippetP2 = document.getElementById("snippet-p2");
const inputP1 = document.getElementById("input-p1");
const inputP2 = document.getElementById("input-p2");
const scoreP1 = document.getElementById("score-p1");
const scoreP2 = document.getElementById("score-p2");
const stateP1 = document.getElementById("state-p1");
const stateP2 = document.getElementById("state-p2");
const btnNext = document.getElementById("btn-next");
const timerEl = document.getElementById("timer");
const infoEl = document.getElementById("info");

let currentSnippet = "";
let scores = { p1: 0, p2: 0 };
let remainingSeconds = GAME_DURATION_SECONDS;
let timerId = null;
let gameOver = false;
let timerStarted = false;

function pickSnippet() {
  const index = Math.floor(Math.random() * SNIPPETS.length);
  return SNIPPETS[index];
}

function setNewSnippet() {
  if (gameOver) return;
  currentSnippet = pickSnippet();
  snippetP1.textContent = currentSnippet;
  snippetP2.textContent = currentSnippet;
  inputP1.value = "";
  inputP2.value = "";
  setState("p1", "Prêt");
  setState("p2", "Prêt");
}

function setState(player, text, type = "") {
  const el = player === "p1" ? stateP1 : stateP2;
  if (!el) return;
  el.textContent = text;
  el.classList.remove("ok", "error");
  if (type) el.classList.add(type);
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function updateTimer() {
  timerEl.textContent = formatTime(remainingSeconds);
}

function startTimer() {
  clearInterval(timerId);
  updateTimer();

  timerId = setInterval(() => {
    remainingSeconds -= 1;
    if (remainingSeconds < 0) remainingSeconds = 0;
    updateTimer();

    if (remainingSeconds <= 0) {
      endGame("Temps écoulé, match nul !");
    }
  }, 1000);
}

function endGame(message, winnerPlayer = null) {
  if (gameOver) return;
  gameOver = true;
  clearInterval(timerId);

  inputP1.disabled = true;
  inputP2.disabled = true;
  btnNext.disabled = true;

  setState("p1", "Terminé");
  setState("p2", "Terminé");

  if (infoEl) {
    if (winnerPlayer === "p1") {
      infoEl.textContent = "Joueur 1 a atteint 10 points. Victoire !";
    } else if (winnerPlayer === "p2") {
      infoEl.textContent = "Joueur 2 a atteint 10 points. Victoire !";
    } else {
      infoEl.textContent = message;
    }
  }
}

function handleValidate(player) {
  if (gameOver) return;
  if (!timerStarted) {
    timerStarted = true;
    startTimer();
  }

  const input = player === "p1" ? inputP1 : inputP2;
  const stateEl = player === "p1" ? stateP1 : stateP2;
  const scoreEl = player === "p1" ? scoreP1 : scoreP2;

  if (!currentSnippet.trim()) return;

  if (input.value.trim() === currentSnippet.trim()) {
    scores[player] += 1;
    scoreEl.textContent = String(scores[player]);
    setState(player, "OK", "ok");

    if (scores[player] >= MAX_SCORE) {
      endGame("", player);
    } else {
      setNewSnippet();
    }
  } else {
    setState(player, "Erreur", "error");
  }
}

inputP1.addEventListener("keydown", (e) => {
  if (!timerStarted && !gameOver) {
    timerStarted = true;
    startTimer();
  }
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    handleValidate("p1");
  }
});

inputP2.addEventListener("keydown", (e) => {
  if (!timerStarted && !gameOver) {
    timerStarted = true;
    startTimer();
  }
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    handleValidate("p2");
  }
});

btnNext.addEventListener("click", () => {
  setNewSnippet();
});

setNewSnippet();
updateTimer();


