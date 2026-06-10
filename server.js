const http = require("http");
const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const os = require("os");

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || "0.0.0.0";
const ROOT = __dirname;
const WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
const rooms = new Map();
const DB_FILE = path.join(ROOT, "stats_history.json");

async function loadStats() {
  try {
    const data = await fs.readFile(DB_FILE, "utf8");
    const json = JSON.parse(data);
    for (const [code, roomData] of Object.entries(json)) {
      const room = {
        code: roomData.code,
        createdAt: roomData.createdAt || Date.now(),
        clients: new Set(),
        players: new Map(),
        events: roomData.events || []
      };
      if (roomData.players) {
        for (const [playerId, playerData] of Object.entries(roomData.players)) {
          room.players.set(playerId, {
            id: playerData.id,
            name: playerData.name,
            role: playerData.role,
            online: false,
            joinedAt: playerData.joinedAt || Date.now(),
            lastSeen: playerData.lastSeen || Date.now(),
            current: playerData.current || null,
            runs: playerData.runs || []
          });
        }
      }
      rooms.set(code, room);
    }
    console.log(`[DB] Načteny statistiky pro ${Object.keys(json).length} místností.`);
  } catch (err) {
    if (err.code !== "ENOENT") {
      console.error("[DB ERROR] Chyba při načítání statistik:", err);
    } else {
      console.log("[DB] Statistický soubor zatím neexistuje, bude vytvořen při prvním zápisu.");
    }
  }
}

async function saveStats() {
  try {
    const backup = {};
    for (const [code, room] of rooms.entries()) {
      const playersObj = {};
      for (const [playerId, player] of room.players.entries()) {
        playersObj[playerId] = {
          id: player.id,
          name: player.name,
          role: player.role,
          joinedAt: player.joinedAt,
          lastSeen: player.lastSeen,
          current: player.current,
          runs: player.runs
        };
      }
      backup[code] = {
        code: room.code,
        createdAt: room.createdAt,
        events: room.events,
        players: playersObj
      };
    }
    await fs.writeFile(DB_FILE, JSON.stringify(backup, null, 2), "utf8");
  } catch (err) {
    console.error("[DB ERROR] Chyba při ukládání statistik:", err);
  }
}

let _saveTimeout = null;
let _saving = false;
function scheduleSave() {
  if (_saveTimeout) clearTimeout(_saveTimeout);
  _saveTimeout = setTimeout(async () => {
    if (_saving) { scheduleSave(); return; }
    _saving = true;
    try { await saveStats(); } finally { _saving = false; }
  }, 500);
}

function sanitizeName(raw, fallback) {
  return String(raw || fallback).trim().slice(0, 40).replace(/[<>"'&]/g, "");
}

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml; charset=utf-8"
};

function safeJoin(filePath) {
  const resolved = path.resolve(ROOT, filePath);
  if (!resolved.startsWith(ROOT)) return null;
  return resolved;
}

function getNetworkAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const [name, nets] of Object.entries(interfaces)) {
    for (const net of nets) {
      if (net.family === "IPv4" && !net.internal) {
        addresses.push({ name, address: net.address });
      }
    }
  }
  return addresses;
}

async function serveStatic(req, res) {
  try {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

    // API endpoint: vrátí síťové adresy serveru pro QR kódy
    if (url.pathname === "/api/network-info") {
      const addresses = getNetworkAddresses();
      const body = JSON.stringify({ port: PORT, addresses });
      res.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": "*"
      });
      res.end(body);
      return;
    }

    // API endpoint: vrátí seznam existujících studentů v místnosti
    if (url.pathname.startsWith("/api/room/") && url.pathname.endsWith("/players")) {
      const code = url.pathname.split("/")[3];
      const room = getRoom(code);
      const players = [...room.players.values()]
        .filter(p => p.role !== "teacher")
        .map(p => ({ id: p.id, name: p.name, online: p.online }));
      res.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": "*"
      });
      res.end(JSON.stringify(players));
      return;
    }

    const requestPath = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
    const file = safeJoin(`.${requestPath}`);
    if (!file) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }
    const data = await fs.readFile(file);
    const ext = path.extname(file).toLowerCase();
    res.writeHead(200, {
      "Content-Type": mimeTypes[ext] || "application/octet-stream",
      "Cache-Control": "no-store"
    });
    res.end(data);
  } catch (err) {
    res.writeHead(err.code === "ENOENT" ? 404 : 500, { "Content-Type": "text/plain; charset=utf-8" });
    res.end(err.code === "ENOENT" ? "Nenalezeno" : "Chyba serveru");
  }
}

function getRoom(code) {
  const normalized = String(code || "KLEMENTINUM").trim().toUpperCase().slice(0, 24) || "KLEMENTINUM";
  if (!rooms.has(normalized)) {
    rooms.set(normalized, {
      code: normalized,
      createdAt: Date.now(),
      clients: new Set(),
      players: new Map(),
      events: []
    });
  }
  return rooms.get(normalized);
}

function compactRun(run) {
  const safe = run || {};
  return {
    id: String(safe.id || `${Date.now()}`),
    runNo: Number(safe.runNo || 1),
    levelId: Number(safe.levelId || 0),
    levelTitle: String(safe.levelTitle || ""),
    ok: Boolean(safe.ok),
    score: Number(safe.score || 0),
    accuracy: Number(safe.accuracy || 0),
    avgReaction: Number(safe.avgReaction || 0),
    totalAnswers: Number(safe.totalAnswers || 0),
    correctAnswers: Number(safe.correctAnswers || 0),
    wrongAnswers: Number(safe.wrongAnswers || 0),
    hints: Number(safe.hints || 0),
    memoryIndex: Number(safe.memoryIndex || 0),
    forgettingRisk: Number(safe.forgettingRisk || 0),
    durationMs: Number(safe.durationMs || 0),
    completedAt: Number(safe.completedAt || Date.now()),
    concepts: Array.isArray(safe.concepts) ? safe.concepts.slice(0, 50) : []
  };
}

function summarizePlayer(player) {
  const runs = player.runs || [];
  const lastRun = runs[runs.length - 1] || null;
  const previousRun = runs[runs.length - 2] || null;
  const delta = lastRun && previousRun ? {
    score: lastRun.score - previousRun.score,
    accuracy: Math.round((lastRun.accuracy - previousRun.accuracy) * 100) / 100,
    avgReaction: Math.round((lastRun.avgReaction - previousRun.avgReaction) * 100) / 100,
    memoryIndex: Math.round((lastRun.memoryIndex - previousRun.memoryIndex) * 100) / 100,
    forgettingRisk: Math.round((lastRun.forgettingRisk - previousRun.forgettingRisk) * 100) / 100
  } : null;
  const totals = runs.reduce((acc, run) => {
    acc.score += run.score;
    acc.answers += run.totalAnswers;
    acc.correct += run.correctAnswers;
    acc.hints += run.hints;
    return acc;
  }, { score: 0, answers: 0, correct: 0, hints: 0 });

  return {
    id: player.id,
    name: player.name,
    role: player.role,
    online: player.online,
    joinedAt: player.joinedAt,
    lastSeen: player.lastSeen,
    current: player.current || null,
    totals: {
      score: totals.score,
      answers: totals.answers,
      correct: totals.correct,
      hints: totals.hints,
      accuracy: totals.answers ? Math.round((totals.correct / totals.answers) * 1000) / 10 : 0
    },
    runs,
    lastRun,
    delta
  };
}

function roomSnapshot(room) {
  const players = [...room.players.values()].map(summarizePlayer);
  const students = players.filter(player => player.role !== "teacher");
  const leaderboard = students
    .slice()
    .sort((a, b) => (b.totals.score - a.totals.score) || ((b.lastRun?.memoryIndex || 0) - (a.lastRun?.memoryIndex || 0)))
    .slice(0, 12);
  const activeStudents = students.filter(player => player.online).length;
  const classStats = students.reduce((acc, player) => {
    acc.score += player.totals.score;
    acc.answers += player.totals.answers;
    acc.correct += player.totals.correct;
    acc.memory += player.lastRun?.memoryIndex || 0;
    acc.risk += player.lastRun?.forgettingRisk || 0;
    acc.runs += player.runs.length;
    return acc;
  }, { score: 0, answers: 0, correct: 0, memory: 0, risk: 0, runs: 0 });
  const lastRunCount = students.filter(player => player.lastRun).length || 1;

  return {
    type: "room:state",
    serverTime: Date.now(),
    room: {
      code: room.code,
      createdAt: room.createdAt,
      activeStudents,
      playerCount: students.length,
      classStats: {
        score: classStats.score,
        answers: classStats.answers,
        accuracy: classStats.answers ? Math.round((classStats.correct / classStats.answers) * 1000) / 10 : 0,
        avgMemoryIndex: Math.round((classStats.memory / lastRunCount) * 10) / 10,
        avgForgettingRisk: Math.round((classStats.risk / lastRunCount) * 10) / 10,
        runs: classStats.runs
      },
      leaderboard,
      players,
      events: room.events.slice(-30)
    }
  };
}

function addEvent(room, event) {
  room.events.push({
    id: crypto.randomUUID(),
    at: Date.now(),
    ...event
  });
  if (room.events.length > 80) room.events.splice(0, room.events.length - 80);
}

function broadcast(room) {
  const snapshot = roomSnapshot(room);
  const payload = JSON.stringify(snapshot);
  for (const client of room.clients) sendFrame(client.socket, payload);
}

function sendFrame(socket, payload) {
  const data = Buffer.from(payload);
  let header;
  if (data.length < 126) {
    header = Buffer.from([0x81, data.length]);
  } else if (data.length < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(data.length, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(data.length), 2);
  }
  socket.write(Buffer.concat([header, data]));
}

function sendJson(client, payload) {
  sendFrame(client.socket, JSON.stringify(payload));
}

function handleMessage(client, raw) {
  let message;
  try {
    message = JSON.parse(raw);
  } catch (err) {
    return;
  }

  if (message.type === "hello") {
    const room = getRoom(message.room);
    const id = String(message.playerId || crypto.randomUUID());
    const role = message.role === "teacher" ? "teacher" : "student";
    const name = sanitizeName(message.name, role === "teacher" ? "Vyučující" : "Student");
    client.id = id;
    client.room = room;
    client.role = role;
    room.clients.add(client);
    const existing = room.players.get(id) || { id, runs: [], joinedAt: Date.now() };
    existing.name = name;
    existing.role = role;
    existing.online = true;
    existing.lastSeen = Date.now();
    room.players.set(id, existing);
    addEvent(room, { kind: "join", playerId: id, playerName: name, role });
    sendJson(client, { type: "hello:ok", playerId: id, room: room.code, serverTime: Date.now() });
    broadcast(room);
    scheduleSave();
    return;
  }

  if (!client.room || !client.id) return;
  const room = client.room;
  const player = room.players.get(client.id);
  if (!player) return;
  player.lastSeen = Date.now();
  player.online = true;

  if (message.type === "player:update") {
    player.current = message.current || null;
    player.name = sanitizeName(message.name || player.name, player.name);
    broadcast(room);
    scheduleSave();
    return;
  }

  if (message.type === "run:complete") {
    const run = compactRun(message.run);
    player.runs = [...(player.runs || []), run].slice(-20);
    player.current = null;
    addEvent(room, {
      kind: run.ok ? "run-win" : "run-loss",
      playerId: player.id,
      playerName: player.name,
      levelId: run.levelId,
      score: run.score,
      memoryIndex: run.memoryIndex,
      forgettingRisk: run.forgettingRisk
    });
    broadcast(room);
    scheduleSave();
    return;
  }

  if (message.type === "teacher:reset" && player.role === "teacher") {
    room.events = [];
    for (const target of room.players.values()) {
      if (target.role !== "teacher") {
        target.runs = [];
        target.current = null;
      }
    }
    addEvent(room, { kind: "reset", playerId: player.id, playerName: player.name, role: "teacher" });
    broadcast(room);
    scheduleSave();
  }
}

function parseFrames(client, chunk) {
  client.buffer = Buffer.concat([client.buffer || Buffer.alloc(0), chunk]);
  while (client.buffer.length >= 2) {
    const first = client.buffer[0];
    const second = client.buffer[1];
    const opcode = first & 0x0f;
    const masked = Boolean(second & 0x80);
    let length = second & 0x7f;
    let offset = 2;
    if (length === 126) {
      if (client.buffer.length < 4) return;
      length = client.buffer.readUInt16BE(2);
      offset = 4;
    } else if (length === 127) {
      if (client.buffer.length < 10) return;
      length = Number(client.buffer.readBigUInt64BE(2));
      offset = 10;
    }
    const maskOffset = offset;
    const dataOffset = masked ? offset + 4 : offset;
    const frameLength = dataOffset + length;
    if (client.buffer.length < frameLength) return;
    const payload = client.buffer.subarray(dataOffset, frameLength);
    let data = payload;
    if (masked) {
      const mask = client.buffer.subarray(maskOffset, maskOffset + 4);
      data = Buffer.alloc(length);
      for (let index = 0; index < length; index += 1) data[index] = payload[index] ^ mask[index % 4];
    }
    client.buffer = client.buffer.subarray(frameLength);

    if (opcode === 0x8) {
      client.socket.end();
      return;
    }
    if (opcode === 0x9) {
      client.socket.write(Buffer.from([0x8a, 0x00]));
      continue;
    }
    if (opcode === 0x1) handleMessage(client, data.toString("utf8"));
  }
}

function closeClient(client) {
  if (!client.room) return;
  const room = client.room;
  room.clients.delete(client);
  const player = room.players.get(client.id);
  if (player) {
    const stillConnected = [...room.clients].some(other => other.id === client.id);
    if (!stillConnected) {
      player.online = false;
      player.lastSeen = Date.now();
      addEvent(room, { kind: "leave", playerId: player.id, playerName: player.name, role: player.role });
    }
  }
  broadcast(room);
  scheduleSave();
}

const server = http.createServer(serveStatic);

server.on("upgrade", (req, socket) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  if (url.pathname !== "/ws") {
    socket.destroy();
    return;
  }
  const key = req.headers["sec-websocket-key"];
  if (!key) {
    socket.destroy();
    return;
  }
  const accept = crypto.createHash("sha1").update(key + WS_GUID).digest("base64");
  socket.write([
    "HTTP/1.1 101 Switching Protocols",
    "Upgrade: websocket",
    "Connection: Upgrade",
    `Sec-WebSocket-Accept: ${accept}`,
    "\r\n"
  ].join("\r\n"));

  const client = { socket, buffer: Buffer.alloc(0), id: null, room: null, role: "student" };
  socket.on("data", chunk => parseFrames(client, chunk));
  socket.on("close", () => closeClient(client));
  socket.on("error", () => closeClient(client));
});

(async () => {
  await loadStats();
  server.listen(PORT, HOST, () => {
    console.log(`Klementinum 2099 online běží na http://localhost:${PORT}`);
    console.log(`Dashboard učitele: http://localhost:${PORT}/?teacher=1`);
    const addresses = getNetworkAddresses();
    if (addresses.length) {
      console.log(`\n--- Sdílení na lokální síti ---`);
      for (const { name, address } of addresses) {
        console.log(`  Studenti:  http://${address}:${PORT}/?room=KLEMENTINUM`);
        console.log(`  Učitel:    http://${address}:${PORT}/?room=KLEMENTINUM&teacher=1`);
        console.log(`  (síťové rozhraní: ${name})`);
      }
      console.log(`-------------------------------\n`);
    }
  });
})();
