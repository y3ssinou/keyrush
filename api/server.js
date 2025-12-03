const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const helmet = require('helmet');

const app = express();
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.static('public'));

const server = http.createServer(app);

// debug log for HTTP upgrade attempts
server.on('upgrade', (req, socket, head) => {
  console.log('[upgrade] from', req.socket.remoteAddress, 'url', req.url);
});

const wss = new WebSocket.Server({ port: 8080 });

// track clients and roles
const clients = new Map(); // ws -> { role, deviceId? }

function safeSend(ws, obj) {
  if (ws.readyState === WebSocket.OPEN) {
    try { ws.send(JSON.stringify(obj)); } catch (e) { /* ignore */ }
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
  console.log('[wss] connection established from', req.socket.remoteAddress);
  // optimistic default: browser until an init message says otherwise
  clients.set(ws, { role: 'browser' });

  // require first message to optionally change role
  let first = true;
  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch (e) {
      console.log('[wss] received non-json message:', raw.toString());
      return;
    }

    if (first) {
      first = false;
      // role init message from client
      if (msg.role === 'device' && msg.deviceId) {
        clients.set(ws, { role: 'device', deviceId: msg.deviceId });
        console.log(`[wss] client identified as device: ${msg.deviceId}`);
        // let device know server got it
        safeSend(ws, { server: 'ok', note: 'registered as device', deviceId: msg.deviceId });
        return;
      } else {
        // leave as browser
        clients.set(ws, { role: 'browser' });
        console.log('[wss] client defaulted to browser');
        // continue — browser may not send further messages
        return;
      }
    }

    // handle subsequent messages
    const meta = clients.get(ws) || {};
    if (meta.role === 'device') {
      // stamp then broadcast to browsers
      msg.serverTs = Date.now();
      console.log(`[device ${meta.deviceId}] ->`, msg);
      broadcastToBrowsers(msg);
      // echo ack back to device
      safeSend(ws, { ack: msg.seq ?? null, serverTs: Date.now() });
    } else {
      // message from browser (if any) - just log
      console.log('[browser] sent message', msg);
    }
  });

  ws.on('close', () => {
    const meta = clients.get(ws) || {};
    console.log('[wss] connection closed', meta.role, meta.deviceId || '');
    clients.delete(ws);
  });

  ws.on('error', (err) => {
    console.log('[wss] error', err && err.message);
    clients.delete(ws);
  });
});

// explicitly accept upgrades and pass to wss
server.on('upgrade', (req, socket, head) => {
  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit('connection', ws, req);
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`debug broadcast server listening on http://localhost:${PORT}`));
