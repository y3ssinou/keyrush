const ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host);
    const typedEl = document.getElementById('typed');
    const deviceEl = document.getElementById('device');
    const logEl = document.getElementById('log');

    // minimal KEY_* -> char map for demo (US layout)
    const keyMap = {
      "KEY_A":"a","KEY_B":"b","KEY_C":"c","KEY_D":"d","KEY_E":"e","KEY_F":"f","KEY_G":"g",
      "KEY_H":"h","KEY_I":"i","KEY_J":"j","KEY_K":"k","KEY_L":"l","KEY_M":"m","KEY_N":"n",
      "KEY_O":"o","KEY_P":"p","KEY_Q":"q","KEY_R":"r","KEY_S":"s","KEY_T":"t","KEY_U":"u",
      "KEY_V":"v","KEY_W":"w","KEY_X":"x","KEY_Y":"y","KEY_Z":"z",
      "KEY_SPACE":" ", "KEY_ENTER":"\n", "KEY_COMMA":",", "KEY_DOT":".",
      "KEY_1":"1","KEY_2":"2","KEY_3":"3","KEY_4":"4","KEY_5":"5","KEY_6":"6","KEY_7":"7","KEY_8":"8","KEY_9":"9","KEY_0":"0"
    };

    // track per-device shift state
    const deviceState = {};

    ws.onopen = () => console.log('connected to server');
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      deviceEl.textContent = msg.deviceId || '-';
      if (!deviceState[msg.deviceId]) deviceState[msg.deviceId] = { shift:false };

      // shift handling
      if (msg.code === 'KEY_LEFTSHIFT' || msg.code === 'KEY_RIGHTSHIFT') {
        deviceState[msg.deviceId].shift = (msg.type === 'keydown');
        return;
      }

      if (msg.type === 'keydown') {
        let ch = msg.char;
        if (!ch && msg.code) {
          const base = keyMap[msg.code] || '';
          ch = deviceState[msg.deviceId].shift ? base.toUpperCase() : base;
        }
        typedEl.textContent += (ch === undefined ? '' : ch);
      }

      // log
      const line = `[${new Date(msg.ts).toLocaleTimeString()}] ${msg.deviceId} ${msg.type} ${msg.code || ''}`;
      const d = document.createElement('div'); d.textContent = line;
      logEl.prepend(d);
    };