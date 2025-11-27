const SNIPPETS = [
  'if (!array.includes(item)) array.push(item);',
  'for (let i = 0; i < 10; i++) console.log(i);',
  'while (queue.length) queue.shift();',
  '[...document.querySelectorAll("button")].forEach(b => b.disabled = true);',
  'fetch("/api/data").then(r => r.json()).then(console.log);',
  'new Date().toISOString();',
  'document.body.classList.toggle("dark");',
  'input.addEventListener("input", e => console.log(e.target.value));',
  'throw new Error("Something broke!");',
  'Array.from("hello").reverse().join("");',
  'Math.max(...numbers);',
  'Math.min(...numbers);',
  'JSON.parse("{\\"a\\":1}");',
  'JSON.stringify({ x: 42 });',
  'document.title = "Typing Game";',
  'location.reload();',
  'history.back();',
  'window.addEventListener("resize", () => console.log("resized"));',
  '"hello".repeat(3);',
  '/[A-Z]+/.test("HELLO");',
  '"123".padStart(5, "0");',
  '"test".includes("es");',
  'new Promise(res => setTimeout(res, 500));',
  'URL.createObjectURL(new Blob(["hi"]));',
  'Object.entries({ a:1, b:2 });',
  'Object.values({ a:1, b:2 });',
  'Object.keys({ a:1, b:2 });',
  '[1,2,3].map(n => n * 2);',
  '[1,2,3].filter(n => n > 1);',
  '[1,2,3].reduce((a,b) => a + b, 0);',
  'document.body.appendChild(document.createElement("hr"));',
  'navigator.clipboard.readText();',
  'navigator.geolocation.getCurrentPosition(console.log);',
  'Math.floor(Math.random() * 100);',
  'crypto.getRandomValues(new Uint8Array(4));',
  'new Set([1,1,2,2,3]);',
  '[...new Set([1,2,2,3])];',
  '(/^hello/.test("hello world"));',
  'new RegExp("ab+c").test("abbbc");',
  'class Point { constructor(x,y){ this.x=x; this.y=y; } }',
  'document.cookie = "mode=dark; path=/";',
  'localStorage.removeItem("theme");',
  'sessionStorage.setItem("token", "123");',
  'performance.now();',
  'new Intl.NumberFormat("en-US").format(12345.6);',
  'Promise.resolve(42).then(console.log);',
  'structuredClone({ nested:{ x:1 } });',
  'queueMicrotask(() => console.log("microtask"));',
  'document.querySelector("img")?.remove();'
];


const MAX_SCORE = 10;
const GAME_DURATION_SECONDS = 10 * 60;
const API_URL = (window.location.origin + "/api").replace(/\/$/, "");

const player1Data = JSON.parse(localStorage.getItem("player1") || "null");
const player2Data = JSON.parse(localStorage.getItem("player2") || "null");

const player1NameEl = document.querySelector('[data-player="1"] h2');
const player2NameEl = document.querySelector('[data-player="2"] h2');
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
const countdownOverlay = document.getElementById("countdown-overlay");
const countdownMessage = document.getElementById("countdown-message");
const roundWinnerMessage = document.getElementById("round-winner-message");
const gameWinnerMessage = document.getElementById("game-winner-message");
const returnHomeMessage = document.getElementById("return-home-message");

let lastCorrectLengthP1 = 0;
let lastCorrectLengthP2 = 0;

function playErrorSound() {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 200;
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.1);
  } catch (error) {
    console.warn('Could not play error sound:', error);
  }
}

if (player1NameEl && player1Data) {
  player1NameEl.textContent = player1Data.name || "Joueur 1";
}
if (player2NameEl && player2Data) {
  player2NameEl.textContent = player2Data.name || "Joueur 2";
}

let currentSnippet = "";
let currentSnippetRaw = "";
let scores = { p1: 0, p2: 0 };
let remainingSeconds = GAME_DURATION_SECONDS;
let timerId = null;
let gameOver = false;
let timerStarted = false;
let usedSnippets = [];

function pickSnippet() {
  if (usedSnippets.length >= SNIPPETS.length) {
    usedSnippets = [];
  }
  
  let availableSnippets = SNIPPETS.filter(s => !usedSnippets.includes(s));
  
  if (availableSnippets.length === 0) {
    usedSnippets = [];
    availableSnippets = SNIPPETS;
  }
  
  const index = Math.floor(Math.random() * availableSnippets.length);
  const snippet = availableSnippets[index];
  usedSnippets.push(snippet);
  return snippet;
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function getSyntaxClass(code, index) {
  const char = code[index];
  const before = code.substring(0, index);
  const after = code.substring(index);
  
  if (char.match(/[0-9]/)) {
    const numMatch = before.match(/\b(\d+)$/);
    if (numMatch) {
      const numEnd = index;
      const numStart = index - numMatch[1].length;
      if (index >= numStart && index < numEnd) {
        return 'number';
      }
    }
  }
  
  const keywordMatch = before.match(/\b(const|let|var|function|if|else|for|while|return|try|catch|import|from|export|default|new|async|await|Promise|setTimeout|console|log|Math|Number|String|Array|Object|Boolean)$/);
  if (keywordMatch && index < before.length) {
    return 'keyword';
  }
  
  if (char === '{' || char === '[' || char === '(') {
    return 'bracket';
  }
  
  if (char === '}' || char === ']' || char === ')') {
    return 'bracket-close';
  }
  
  if (char.match(/[+\-*/%=!&|]/)) {
    return 'operator';
  }
  
  const stringMatch = before.match(/(["'`])((?:\\.|(?!\1)[^\\])*?)$/);
  if (stringMatch && !after.match(/^\1/)) {
    return 'string';
  }
  
  const funcMatch = before.match(/\b([a-zA-Z_$][a-zA-Z0-9_$]*)\s*$/);
  if (funcMatch && after.match(/^\s*\(/)) {
    return 'function';
  }
  
  const methodMatch = before.match(/\.([a-zA-Z_$][a-zA-Z0-9_$]*)\s*$/);
  if (methodMatch && after.match(/^\s*\(/)) {
    return 'method';
  }
  
  const varMatch = before.match(/\b([a-zA-Z_$][a-zA-Z0-9_$]*)\s*$/);
  if (varMatch && after.match(/^\s*\./)) {
    return 'variable';
  }
  
  return null;
}

function updateSnippetDisplay(player) {
  if (!currentSnippetRaw) return;
  
  const input = player === "p1" ? inputP1 : inputP2;
  const snippetEl = player === "p1" ? snippetP1 : snippetP2;
  const inputValue = input.value;
  const targetValue = currentSnippetRaw;
  
  const lastCorrectLength = player === "p1" ? lastCorrectLengthP1 : lastCorrectLengthP2;
  const lastInputLength = player === "p1" ? (parseInt(inputP1.dataset.lastLength) || 0) : (parseInt(inputP2.dataset.lastLength) || 0);
  
  let correctLength = 0;
  for (let i = 0; i < Math.min(inputValue.length, targetValue.length); i++) {
    if (inputValue[i] === targetValue[i]) {
      correctLength++;
    } else {
      break;
    }
  }
  
  const currentInputLength = inputValue.length;
  const inputIncreased = currentInputLength > lastInputLength;
  const madeError = inputIncreased && correctLength <= lastCorrectLength && currentInputLength > correctLength;
  
  if (madeError) {
    playErrorSound();
  }
  
  if (player === "p1") {
    lastCorrectLengthP1 = correctLength;
    inputP1.dataset.lastLength = String(currentInputLength);
  } else {
    lastCorrectLengthP2 = correctLength;
    inputP2.dataset.lastLength = String(currentInputLength);
  }
  
  const getCharState = (index) => {
    if (index < correctLength) {
      return 'typed-correct';
    } else if (index === correctLength) {
      return inputValue.length > correctLength ? 'typed-wrong' : 'typed-current';
    }
    return null;
  };
  
  let result = '';
  
  for (let i = 0; i < targetValue.length; i++) {
    const char = targetValue[i];
    const state = getCharState(i);
    const syntaxClass = getSyntaxClass(targetValue, i);
    
    const classes = [];
    if (syntaxClass) {
      classes.push(syntaxClass);
    }
    if (state) {
      classes.push(state);
    }
    
    if (classes.length > 0) {
      result += `<span class="${classes.join(' ')}">${escapeHtml(char)}</span>`;
    } else {
      result += escapeHtml(char);
    }
  }
  
  snippetEl.innerHTML = result;
}

function showRoundWinner(winnerPlayer, callback) {
  if (!countdownOverlay || !roundWinnerMessage) {
    if (callback) callback();
    return;
  }
  
  if (!winnerPlayer) {
    if (callback) callback();
    return;
  }
  
  const winnerData = winnerPlayer === "p1" ? player1Data : player2Data;
  const winnerName = winnerData ? winnerData.name : (winnerPlayer === "p1" ? "Joueur 1" : "Joueur 2");
  
  countdownOverlay.style.display = "flex";
  roundWinnerMessage.textContent = `${winnerName} a gagné la round !`;
  roundWinnerMessage.style.display = "block";
  countdownMessage.style.display = "none";
  
  setTimeout(() => {
    roundWinnerMessage.style.display = "none";
    countdownMessage.style.display = "block";
    if (callback) callback();
  }, 2000);
}

function showCountdown(callback) {
  if (!countdownOverlay || !countdownMessage) {
    if (callback) callback();
    return;
  }
  
  countdownOverlay.style.display = "flex";
  countdownMessage.style.display = "block";
  let count = 3;
  
  const updateCountdown = () => {
    if (count > 0) {
      countdownMessage.textContent = count.toString();
      count--;
      setTimeout(updateCountdown, 1000);
    } else {
      countdownMessage.textContent = "GO!";
      setTimeout(() => {
        countdownOverlay.style.display = "none";
        if (callback) callback();
      }, 500);
    }
  };
  
  updateCountdown();
}

function setNewSnippet(winnerPlayer = null) {
  if (gameOver) return;
  
  inputP1.value = "";
  inputP2.value = "";
  lastCorrectLengthP1 = 0;
  lastCorrectLengthP2 = 0;
  updateSnippetDisplay("p1");
  updateSnippetDisplay("p2");
  setState("p1", "Prêt");
  setState("p2", "Prêt");
  
  showRoundWinner(winnerPlayer, () => {
    showCountdown(() => {
      currentSnippetRaw = pickSnippet();
      currentSnippet = currentSnippetRaw;
      lastCorrectLengthP1 = 0;
      lastCorrectLengthP2 = 0;
      updateSnippetDisplay("p1");
      updateSnippetDisplay("p2");
    });
  });
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

async function endGame(message, winnerPlayer = null) {
  if (gameOver) return;
  gameOver = true;
  clearInterval(timerId);

  inputP1.disabled = true;
  inputP2.disabled = true;
  btnNext.disabled = true;

  setState("p1", "Terminé");
  setState("p2", "Terminé");

  if (winnerPlayer) {
    const winnerData = winnerPlayer === "p1" ? player1Data : player2Data;
    const loserData = winnerPlayer === "p1" ? player2Data : player1Data;
    const winnerName = winnerData ? winnerData.name : (winnerPlayer === "p1" ? "Joueur 1" : "Joueur 2");
    const loserName = loserData ? loserData.name : (winnerPlayer === "p1" ? "Joueur 2" : "Joueur 1");

    if (countdownOverlay && gameWinnerMessage && returnHomeMessage) {
      countdownOverlay.style.display = "flex";
      gameWinnerMessage.textContent = `${winnerName} a gagné contre ${loserName} !`;
      gameWinnerMessage.style.display = "block";
      returnHomeMessage.style.display = "block";
      countdownMessage.style.display = "none";
      roundWinnerMessage.style.display = "none";
    }

    if (winnerData && winnerData.id) {
      try {
        await fetch(`${API_URL}/game-wins`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ player_id: winnerData.id })
        });
      } catch (err) {
        console.error("Erreur lors de l'enregistrement du win:", err);
      }
    }

    setTimeout(() => {
      window.location.href = "index.html";
    }, 3000);
  } else {
    if (countdownOverlay && gameWinnerMessage && returnHomeMessage) {
      countdownOverlay.style.display = "flex";
      gameWinnerMessage.textContent = message || "Match nul !";
      gameWinnerMessage.style.display = "block";
      returnHomeMessage.style.display = "block";
      countdownMessage.style.display = "none";
      roundWinnerMessage.style.display = "none";
    }

    setTimeout(() => {
      window.location.href = "index.html";
    }, 3000);
    if (infoEl) {
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

  if (!currentSnippetRaw || !currentSnippetRaw.trim()) return;

  if (input.value.trim() === currentSnippetRaw.trim()) {
    scores[player] += 1;
    scoreEl.textContent = String(scores[player]);
    setState(player, "OK", "ok");

    if (scores[player] >= MAX_SCORE) {
      endGame("", player);
    } else {
      setNewSnippet(player);
    }
  } else {
    setState(player, "Erreur", "error");
  }
}

inputP1.addEventListener("input", () => {
  updateSnippetDisplay("p1");
});

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

inputP2.addEventListener("input", () => {
  updateSnippetDisplay("p2");
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

const btnHome = document.getElementById("btn-home");
if (btnHome) {
  btnHome.addEventListener("click", () => {
    window.location.href = "index.html";
  });
}

if (infoEl) {
  infoEl.style.display = "block";
}

setNewSnippet();
updateTimer();


