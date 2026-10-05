#!/usr/bin/env node
/**
 * TopoGIS 3D — serveur de collaboration de référence (sans dépendance, Node.js 18+).
 *
 *  - WebSocket  /ws?room=CODE&peer=ID[&token=…]  : relais temps réel entre participants d'une session
 *  - REST       GET  /api/health                  : état du serveur
 *               GET  /api/rooms/:room             : instantané { items, seq }
 *               GET  /api/rooms/:room/ops?since=n : modifications depuis n { ops, seq } ou { reset: true }
 *               POST /api/rooms/:room/ops         : { from, ops } → fusion (la plus récente gagne), relais
 *  - Persistance : un fichier JSON par session dans ./data (dossier configurable).
 *  - Sert aussi l'application (index.html du dossier parent) : http://localhost:8787
 *
 * Variables d'environnement : PORT (8787), HOST (0.0.0.0), TOPOGIS_TOKEN (jeton facultatif),
 * TOPOGIS_DATA (dossier des données), TOPOGIS_CORS (origine autorisée, * par défaut).
 */
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 8787;
const HOST = process.env.HOST || '0.0.0.0';
const TOKEN = process.env.TOPOGIS_TOKEN || '';
const DATA = path.resolve(process.env.TOPOGIS_DATA || path.join(DIR, 'data'));
const CORS = process.env.TOPOGIS_CORS || '*';
const APP = path.resolve(DIR, '..', 'index.html');
const MAX_BODY = 32 * 1024 * 1024, MAX_LOG = 5000, VERSION = '1.0.0';

fs.mkdirSync(DATA, { recursive: true });
const rooms = new Map();
const roomName = (r) => String(r || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);

function getRoom(name) {
  let r = rooms.get(name);
  if (r) return r;
  r = { name, items: new Map(), log: [], seq: 0, clients: new Set(), timer: null };
  try {
    const d = JSON.parse(fs.readFileSync(path.join(DATA, name + '.json'), 'utf8'));
    for (const it of d.items || []) r.items.set(it.k, it);
    r.seq = d.seq || 0;
  } catch { /* nouvelle session */ }
  rooms.set(name, r);
  return r;
}
function persist(r) {
  clearTimeout(r.timer);
  r.timer = setTimeout(() => {
    const tmp = path.join(DATA, r.name + '.json.tmp');
    fs.writeFile(tmp, JSON.stringify({ room: r.name, seq: r.seq, savedAt: new Date().toISOString(), items: [...r.items.values()] }), (err) => {
      if (err) return console.error('Écriture impossible', err);
      fs.rename(tmp, path.join(DATA, r.name + '.json'), (e) => e && console.error(e));
    });
  }, 800);
}
const newer = (a, b) => !b || a.ts > b.ts || (a.ts === b.ts && String(a.p) > String(b.p));
/** Fusionne des modifications (la plus récente gagne) ; renvoie celles qui ont été retenues. */
function merge(r, ops) {
  const ok = [];
  for (const op of Array.isArray(ops) ? ops : []) {
    if (!op || typeof op.k !== 'string' || typeof op.ts !== 'number') continue;
    if (!newer(op, r.items.get(op.k))) continue;
    const it = { k: op.k, v: op.v === undefined ? null : op.v, ts: op.ts, p: op.p };
    r.items.set(op.k, it);
    r.log.push({ seq: ++r.seq, op: it });
    ok.push(it);
  }
  if (r.log.length > MAX_LOG) r.log.splice(0, r.log.length - MAX_LOG);
  if (ok.length) persist(r);
  return ok;
}
function broadcast(r, msg, except) {
  const s = JSON.stringify(msg);
  for (const c of r.clients) if (c !== except) c.sendText(s);
}

/* ---------- HTTP / REST ---------- */
function authorized(req, url) {
  if (!TOKEN) return true;
  const h = req.headers.authorization || '';
  return h === 'Bearer ' + TOKEN || url.searchParams.get('token') === TOKEN;
}
function send(res, code, body, type) {
  res.writeHead(code, { 'Content-Type': type || 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': CORS, 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Cache-Control': 'no-store' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (req.method === 'OPTIONS') return send(res, 204, '');
  if (url.pathname === '/' || url.pathname === '/index.html') {
    return fs.readFile(APP, (err, buf) => (err ? send(res, 404, 'index.html introuvable', 'text/plain; charset=utf-8') : send(res, 200, buf, 'text/html; charset=utf-8')));
  }
  if (url.pathname === '/api/health') return send(res, 200, { ok: true, name: 'TopoGIS collab', version: VERSION, persistent: true, auth: !!TOKEN, rooms: rooms.size });
  const m = /^\/api\/rooms\/([^/]+)(\/ops)?$/.exec(url.pathname);
  if (!m) return send(res, 404, { error: 'introuvable' });
  if (!authorized(req, url)) return send(res, 401, { error: 'jeton invalide' });
  const r = getRoom(roomName(decodeURIComponent(m[1])));
  if (!r.name) return send(res, 400, { error: 'session invalide' });
  if (req.method === 'GET' && !m[2]) return send(res, 200, { room: r.name, seq: r.seq, items: [...r.items.values()] });
  if (req.method === 'GET' && m[2]) {
    const since = Number(url.searchParams.get('since')) || 0;
    if (r.log.length && since < r.log[0].seq - 1) return send(res, 200, { reset: true, seq: r.seq });
    return send(res, 200, { seq: r.seq, ops: r.log.filter((x) => x.seq > since).map((x) => x.op) });
  }
  if (req.method === 'POST' && m[2]) {
    let size = 0; const chunks = [];
    req.on('data', (c) => { size += c.length; if (size > MAX_BODY) { req.destroy(); } else chunks.push(c); });
    req.on('end', () => {
      let body;
      try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return send(res, 400, { error: 'JSON invalide' }); }
      const ok = merge(r, body.ops);
      if (ok.length) broadcast(r, { t: 'ops', room: r.name, from: 'server', mid: 'srv-' + crypto.randomUUID(), ops: ok });
      send(res, 200, { seq: r.seq, accepted: ok.length });
    });
    return;
  }
  send(res, 405, { error: 'méthode non autorisée' });
});

/* ---------- WebSocket (RFC 6455, messages texte) ---------- */
server.on('upgrade', (req, socket) => {
  const url = new URL(req.url, 'http://x');
  const room = roomName(url.searchParams.get('room'));
  if (url.pathname !== '/ws' || !room || !req.headers['sec-websocket-key'] || !authorized(req, url)) {
    socket.end('HTTP/1.1 ' + (authorized(req, url) ? '400 Bad Request' : '401 Unauthorized') + '\r\n\r\n');
    return;
  }
  const accept = crypto.createHash('sha1').update(req.headers['sec-websocket-key'] + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + accept + '\r\n\r\n');
  socket.setNoDelay(true);
  const r = getRoom(room);
  const client = {
    peer: String(url.searchParams.get('peer') || '').slice(0, 32),
    sendText(s) {
      const data = Buffer.from(s, 'utf8'), n = data.length;
      const head = n < 126 ? Buffer.from([0x81, n]) : n < 65536 ? Buffer.from([0x81, 126, n >> 8, n & 255]) : Buffer.concat([Buffer.from([0x81, 127]), (() => { const b = Buffer.alloc(8); b.writeBigUInt64BE(BigInt(n)); return b; })()]);
      if (!socket.destroyed) socket.write(Buffer.concat([head, data]));
    }
  };
  r.clients.add(client);
  client.sendText(JSON.stringify({ t: 'snap', room, from: 'server', mid: 'srv-' + crypto.randomUUID(), items: [...r.items.values()] }));
  let buf = Buffer.alloc(0), frag = [];
  let closed = false;
  const close = () => { if (closed) return; closed = true; r.clients.delete(client); if (client.peer) broadcast(r, { t: 'bye', room, from: client.peer, mid: 'srv-' + crypto.randomUUID() }); socket.destroy(); };
  socket.on('data', (chunk) => {
    buf = Buffer.concat([buf, chunk]);
    for (;;) {
      if (buf.length < 2) return;
      const fin = (buf[0] & 0x80) !== 0, op = buf[0] & 0x0f, masked = (buf[1] & 0x80) !== 0;
      let len = buf[1] & 0x7f, off = 2;
      if (len === 126) { if (buf.length < 4) return; len = buf.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (buf.length < 10) return; len = Number(buf.readBigUInt64BE(2)); off = 10; }
      if (len > MAX_BODY) return close();
      const need = off + (masked ? 4 : 0) + len;
      if (buf.length < need) return;
      let payload = buf.subarray(off + (masked ? 4 : 0), need);
      if (masked) { const k = buf.subarray(off, off + 4); payload = Buffer.from(payload); for (let i = 0; i < payload.length; i++) payload[i] ^= k[i & 3]; }
      buf = buf.subarray(need);
      if (op === 0x8) return close();
      if (op === 0x9) { socket.write(Buffer.concat([Buffer.from([0x8a, payload.length]), payload])); continue; }
      if (op === 0x1 || op === 0x0) {
        frag.push(payload);
        if (!fin) continue;
        const text = Buffer.concat(frag).toString('utf8'); frag = [];
        let msg; try { msg = JSON.parse(text); } catch { continue; }
        if (!msg || msg.room !== room) continue;
        if (msg.t === 'ops') { merge(r, msg.ops); broadcast(r, msg, client); }
        else if (msg.t === 'snap') { const ok = merge(r, msg.items); if (ok.length) broadcast(r, { t: 'ops', room, from: 'server', mid: 'srv-' + crypto.randomUUID(), ops: ok }, client); }
        else broadcast(r, msg, client);                          // présence, salutations, battements de cœur
      }
    }
  });
  socket.on('close', close);
  socket.on('error', close);
});

server.listen(PORT, HOST, () => console.log(`TopoGIS collab : http://localhost:${PORT} (données : ${DATA}${TOKEN ? ', jeton requis' : ''})`));
