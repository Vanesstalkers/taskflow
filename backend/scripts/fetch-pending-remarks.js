'use strict';

/**
 * Необработанные замечания через Metacom (как фронтенд).
 *
 *   cd backend
 *   node scripts/fetch-pending-remarks.js
 *   node scripts/fetch-pending-remarks.js --json
 *   node scripts/fetch-pending-remarks.js --limit 20
 *
 *   TASKFLOW_METACOM_URL=ws://127.0.0.1:8001/api
 */

const WebSocket = require('ws');

const DEFAULT_WS = process.env.TASKFLOW_METACOM_URL || 'ws://127.0.0.1:8001/api';
const TIMEOUT_MS = Number(process.env.TASKFLOW_CALL_TIMEOUT_MS || 30_000);

const args = process.argv.slice(2);
const jsonOut = args.includes('--json');
const limitIdx = args.indexOf('--limit');
const limit = limitIdx >= 0 ? Number(args[limitIdx + 1]) : 100;

class MetacomClient {
  constructor(url) {
    this.url = url;
    this.socket = null;
    this.connected = false;
    this.callId = 0;
    this.calls = new Map();
    this.api = {};
  }

  async connect() {
    await new Promise((resolve, reject) => {
      const socket = new WebSocket(this.url);
      this.socket = socket;
      const timer = setTimeout(() => {
        socket.close();
        reject(new Error(`Таймаут подключения: ${this.url}`));
      }, TIMEOUT_MS);
      socket.once('open', () => {
        clearTimeout(timer);
        this.connected = true;
        resolve();
      });
      socket.once('error', reject);
      socket.on('message', (data) => {
        const text = Buffer.isBuffer(data) ? data.toString('utf8') : String(data);
        if (text === '{}') return;
        let packet;
        try {
          packet = JSON.parse(text);
        } catch {
          return;
        }
        if (packet.type !== 'callback' || packet.id == null) return;
        const pending = this.calls.get(packet.id);
        if (!pending) return;
        const [res, rej, t] = pending;
        this.calls.delete(packet.id);
        clearTimeout(t);
        if (packet.error) rej(new Error(JSON.stringify(packet.error)));
        else res(packet.result);
      });
    });
  }

  #scaffold(unit) {
    return (method) => async (args = {}) => {
      const id = ++this.callId;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          this.calls.delete(id);
          reject(new Error(`Timeout: ${unit}/${method}`));
        }, TIMEOUT_MS);
        this.calls.set(id, [resolve, reject, timer]);
        this.socket.send(JSON.stringify({ type: 'call', id, method: `${unit}/${method}`, args }));
      });
    };
  }

  async load(...units) {
    const introspect = this.#scaffold('system')('introspect');
    const introspection = await introspect(units);
    for (const unit of units) {
      if (!introspection?.[unit]) continue;
      const request = this.#scaffold(unit);
      this.api[unit] = {};
      for (const name of Object.keys(introspection[unit])) {
        this.api[unit][name] = request(name);
      }
    }
  }

  close() {
    this.socket?.close();
  }
}

async function main() {
  const client = new MetacomClient(DEFAULT_WS);
  await client.connect();
  await client.load('remarks');

  const result = await client.api.remarks.getPendingRemarks({ limit });
  client.close();

  if (result?.status !== 'ok') {
    console.error('Ошибка:', result);
    process.exit(1);
  }

  if (jsonOut) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    const remarks = result.remarks || [];
    console.log(`Необработанных замечаний: ${remarks.length}\n`);
    for (const r of remarks) {
      console.log(`--- ${r._id} ---`);
      console.log(`devId: ${r.devId || r.partialDevId || '—'}`);
      console.log(`route: ${r.route || '—'}`);
      console.log(`comment: ${r.comment}`);
      if (r.domain?.schemaFile) console.log(`schema: ${r.domain.schemaFile}`);
      if (r.ui?.file) console.log(`ui: ${r.ui.file}${r.ui.line ? `:${r.ui.line}` : ''}`);
      console.log('');
    }
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
