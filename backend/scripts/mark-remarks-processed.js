'use strict';

/**
 *   node scripts/mark-remarks-processed.js <id> [id2 ...]
 *   node scripts/mark-remarks-processed.js --all-pending
 */

const WebSocket = require('ws');

const DEFAULT_WS = process.env.TASKFLOW_METACOM_URL || 'ws://127.0.0.1:8001/api';
const TIMEOUT_MS = Number(process.env.TASKFLOW_CALL_TIMEOUT_MS || 30_000);

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
        reject(new Error(`Таймаут: ${this.url}`));
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
  const args = process.argv.slice(2);
  const allPending = args.includes('--all-pending');
  const ids = args.filter((a) => !a.startsWith('--'));

  const client = new MetacomClient(DEFAULT_WS);
  await client.connect();
  await client.load('remarks');

  let toMark = ids;
  if (allPending) {
    const pending = await client.api.remarks.getPendingRemarks({ limit: 500 });
    if (pending?.status !== 'ok') throw new Error(JSON.stringify(pending));
    toMark = (pending.remarks || []).map((r) => r._id);
  }

  if (toMark.length === 0) {
    console.log('Нет id для пометки');
    client.close();
    return;
  }

  const result = await client.api.remarks.markRemarksProcessed({ ids: toMark });
  client.close();

  if (result?.status !== 'ok') {
    console.error(result);
    process.exit(1);
  }
  console.log(`Помечено processed: ${result.modified ?? 0} из ${toMark.length}`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
