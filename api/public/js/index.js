// public/js/index.js
(() => {
  const devicesContainer = document.getElementById('devices');
  const DEVICE_TIMEOUT_MS = 30_000; // remove device if no update in 30s
  const CLEANUP_INTERVAL_MS = 5_000;

  // deviceId -> { el:cardEl, textEl, metaEl, lastSeen, caretEl }
  const devices = new Map();

  function createDeviceCard(deviceId) {
    const card = document.createElement('div');
    card.className = 'device-card';
    card.dataset.deviceId = deviceId;

    const head = document.createElement('div');
    head.className = 'device-head';

    const idEl = document.createElement('div');
    idEl.className = 'device-id';
    idEl.textContent = deviceId;

    const metaEl = document.createElement('div');
    metaEl.className = 'meta';
    metaEl.textContent = 'just now';

    head.appendChild(idEl);
    head.appendChild(metaEl);

    const textBox = document.createElement('div');
    textBox.className = 'text-box empty';
    textBox.textContent = ''; // will be set when text arrives

    // caret indicator (optional small vertical bar)
    const caretEl = document.createElement('span');
    caretEl.className = 'caret';
    caretEl.style.display = 'none'; // shown only when caret position is meaningful

    // attach caret visually at end; we'll append it to the text box as last child if present
    const wrapper = document.createElement('div');
    wrapper.style.position = 'relative';
    wrapper.appendChild(textBox);

    card.appendChild(head);
    card.appendChild(wrapper);

    devicesContainer.prepend(card); // newest first

    const state = { el: card, textEl: textBox, metaEl, lastSeen: Date.now(), caretEl };
    devices.set(deviceId, state);
    return state;
  }

  function updateDevice(deviceId, payload) {
    let state = devices.get(deviceId);
    if (!state) state = createDeviceCard(deviceId);

    // update last seen
    state.lastSeen = Date.now();

    // Visual: if payload.type === 'text', update the displayed text
    if (payload.type === 'text') {
      const text = payload.text ?? '';
      state.textEl.textContent = text.length ? text : '';
      state.textEl.classList.toggle('empty', !text.length);

      // caret display: show caret at end if caret index provided
      if (typeof payload.caret === 'number' && payload.caret >= 0) {
        // show caret (simple approach: append a caret element at end)
        if (state.caretEl.parentElement !== state.textEl) {
          // append caret node
          state.textEl.appendChild(state.caretEl);
        }
        state.caretEl.style.display = 'inline-block';
      } else {
        state.caretEl.style.display = 'none';
        if (state.caretEl.parentElement === state.textEl) {
          // leaving it is fine; hide only
        }
      }
    } else if (payload.type === 'submit') {
      // mark as submitted (for example visually)
      state.textEl.textContent = payload.text ?? state.textEl.textContent;
      state.textEl.classList.remove('empty');
      // optionally add a small meta note
      const note = document.createElement('div');
      note.className = 'meta';
      note.textContent = 'Submitted at ' + new Date(payload.ts || Date.now()).toLocaleTimeString();
      state.el.querySelector('.device-head').appendChild(note);
    }

    // update meta time (simple "last seen Xs ago")
    state.metaEl.textContent = 'last seen ' + timeSince(state.lastSeen);
  }

  function timeSince(ts) {
    const diff = Date.now() - ts;
    if (diff < 1000) return 'just now';
    const s = Math.floor(diff / 1000);
    if (s < 60) return s + 's ago';
    const m = Math.floor(s / 60);
    if (m < 60) return m + 'm ago';
    const h = Math.floor(m / 60);
    return h + 'h ago';
  }

  function cleanupDevices() {
    const now = Date.now();
    for (const [deviceId, state] of devices.entries()) {
      if (now - state.lastSeen > DEVICE_TIMEOUT_MS) {
        // remove UI element
        state.el.remove();
        devices.delete(deviceId);
      } else {
        // update meta timestamp string
        state.metaEl.textContent = 'last seen ' + timeSince(state.lastSeen);
      }
    }
  }

  setInterval(cleanupDevices, CLEANUP_INTERVAL_MS);

  // --- WebSocket connection ---
  const ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host);

  ws.addEventListener('open', () => {
    console.log('index ws open');
  });

  ws.addEventListener('message', (ev) => {
    let msg;
    try { msg = JSON.parse(ev.data); } catch (e) { console.warn('bad json', ev.data); return; }
    if (!msg || !msg.deviceId) return;

    // route the message to the appropriate device card
    updateDevice(msg.deviceId, msg);
  });

  ws.addEventListener('close', () => {
    console.log('index ws closed');
    // Optionally show a banner / try reconnect logic
  });

  ws.addEventListener('error', (err) => {
    console.error('WebSocket error', err);
  });

})();
