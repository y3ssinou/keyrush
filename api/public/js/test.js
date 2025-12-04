// test_device_text.js
(function(){
  const connectBtn = document.getElementById('connect');
  const disconnectBtn = document.getElementById('disconnect');
  const deviceIdInput = document.getElementById('deviceId');
  const typingArea = document.getElementById('typingArea');
  const statusEl = document.getElementById('status');
  const debugEl = document.getElementById('debug');

  let ws = null;
  let seq = 0;
  let lastSentText = '';

  function log(...args) {
    debugEl.textContent = new Date().toLocaleTimeString() + ' — ' + args.map(a=> (typeof a==='object'?JSON.stringify(a):a)).join(' ') + '\n' + debugEl.textContent;
  }

  function setStatus(s) {
    statusEl.textContent = s;
    log(s);
  }

  function buildWsUrl() {
    if (location.host) {
      return (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host;
    }
    return 'ws://localhost:4000';
  }

  function connect() {
    if (ws && ws.readyState === WebSocket.OPEN) return;
    const url = buildWsUrl();
    setStatus('Connecting to ' + url + ' ...');
    ws = new WebSocket(url);

    ws.onopen = () => {
      setStatus('Connected to ' + url);
      const did = deviceIdInput.value || 'sim-01';
      ws.send(JSON.stringify({ role: 'device', deviceId: did }));
      seq = 0;
      connectBtn.disabled = true;
      disconnectBtn.disabled = false;
      typingArea.focus();
    };

    ws.onmessage = (ev) => {
      // show server ack / messages
      log('server →', ev.data);
    };

    ws.onclose = (ev) => {
      setStatus('Disconnected (code=' + ev.code + ')');
      connectBtn.disabled = false;
      disconnectBtn.disabled = true;
    };

    ws.onerror = (err) => {
      setStatus('WebSocket error (see console)');
      console.error(err);
    };
  }

  function disconnect() {
    if (ws) ws.close();
    ws = null;
    setStatus('Not connected');
  }

  // send full-text payload
  function sendTextUpdate() {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const text = typingArea.value;
    const caret = typingArea.selectionStart;
    // optional: avoid sending duplicates too often
    if (text === lastSentText) return;
    const payload = {
      deviceId: deviceIdInput.value || 'sim-01',
      seq: ++seq,
      type: 'text',
      text,
      caret,
      ts: Date.now()
    };
    try {
      ws.send(JSON.stringify(payload));
      lastSentText = text;
      log('sent →', payload);
    } catch (e) {
      log('send failed', e && e.message);
    }
  }

  // Debounce to avoid flooding: send at most every 50ms while typing
  let debounceTimer = null;
  function scheduleSend() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      sendTextUpdate();
      debounceTimer = null;
    }, 40); // 25Hz
  }

  // events
  connectBtn.addEventListener('click', connect);
  disconnectBtn.addEventListener('click', disconnect);

  // send on input, paste, cut
  typingArea.addEventListener('input', scheduleSend);
  typingArea.addEventListener('paste', () => setTimeout(scheduleSend, 10));
  typingArea.addEventListener('cut', () => setTimeout(scheduleSend, 10));
  // optional: also send when textarea loses focus
  typingArea.addEventListener('blur', sendTextUpdate);

  // allow Ctrl+Enter to send a final "submit" message (optional)
  typingArea.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'Enter') {
      if (ws && ws.readyState === WebSocket.OPEN) {
        const payload = {
          deviceId: deviceIdInput.value || 'sim-01',
          seq: ++seq,
          type: 'submit',
          text: typingArea.value,
          ts: Date.now()
        };
        ws.send(JSON.stringify(payload));
        log('sent submit →', payload);
      }
    }
  });

  // autofocus
  typingArea.focus();
})();
