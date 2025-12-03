    let ws;
    document.getElementById('connect').onclick = () => {
      if (ws && ws.readyState === WebSocket.OPEN) { ws.close(); return; }
      const id = document.getElementById('deviceId').value || 'sim-01';
      ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host);
      ws.onopen = () => {
        document.getElementById('status').textContent = 'connected';
        ws.send(JSON.stringify({ role: 'device', deviceId: id }));
      };
      ws.onclose = () => document.getElementById('status').textContent = 'closed';
      ws.onerror = (e) => document.getElementById('status').textContent = 'error';
    };

    document.querySelectorAll('button[data-code]').forEach(b => {
      b.onclick = () => {
        if (!ws || ws.readyState !== WebSocket.OPEN) return alert('connect first');
        const code = b.getAttribute('data-code');
        const msg = { deviceId: document.getElementById('deviceId').value || 'sim-01',
                      seq: Date.now(),
                      type: 'keydown',
                      code: code,
                      char: null,
                      ts: Date.now() };
        ws.send(JSON.stringify(msg));
      };
    });