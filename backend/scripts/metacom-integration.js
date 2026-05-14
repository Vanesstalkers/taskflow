'use strict';

/**
 * Интеграционная проверка Metacom API (WebSocket), как у фронтенда.
 *
 * Переменные окружения:
 *   TASKFLOW_METACOM_URL — по умолчанию ws://127.0.0.1:8001/api
 *     (порт worker, как target в frontend/vite.config.js; :8000 часто даёт 302)
 *   TASKFLOW_CONNECT_TIMEOUT_MS — таймаут TCP/WS (по умолчанию 15000)
 *   TASKFLOW_CALL_TIMEOUT_MS — таймаут RPC (по умолчанию 120000)
 *   TASKFLOW_LOGIN — если задан: signin и одиночный сценарий (TASKFLOW_TASK_TYPE).
 *     Если не задан: register нового пользователя и посев всех типов из lst.taskTypes.
 *   TASKFLOW_PASSWORD — для signin обязателен вместе с LOGIN; без LOGIN — пароль нового
 *     пользователя (по умолчанию Itest!9same).
 *   TASKFLOW_TASK_TYPE — при режиме с LOGIN (по умолчанию createSubdivision)
 *
 * Запуск:
 *   cd backend && set TASKFLOW_LOGIN=... && set TASKFLOW_PASSWORD=... &&
 *   npm run integration:metacom
 *
 * При ошибке в backend/log/ создаются last-integration-error.json и
 * last-integration-error.txt (stack, фаза, URL, сырое packet.error Metacom).
 */

const fs = require('node:fs');
const path = require('node:path');
const WebSocket = require('ws');

const LOG_DIR = path.join(__dirname, '..', 'log');
const LAST_ERR_JSON = path.join(LOG_DIR, 'last-integration-error.json');
const LAST_ERR_TXT = path.join(LOG_DIR, 'last-integration-error.txt');

const CALL_TIMEOUT_MS = Number(process.env.TASKFLOW_CALL_TIMEOUT_MS || 120_000);
const DEFAULT_WS = 'ws://127.0.0.1:8001/api';

function env(name, fallback = '') {
  const v = process.env[name];
  if (v === undefined || v === null || String(v).trim() === '') return fallback;
  return String(v).trim();
}

class MetacomError extends Error {
  /**
   * @param {object|string} serverError — тело packet.error с сервера
   * @param {object} [callbackPacket] — полный callback-пакет (type, id, error|result)
   */
  constructor(serverError, callbackPacket) {
    let msg = 'Metacom error';
    if (serverError && typeof serverError === 'object' && serverError.message) {
      msg = String(serverError.message);
    } else if (typeof serverError === 'string') {
      msg = serverError;
    }
    super(msg);
    const code = serverError && typeof serverError === 'object' ? serverError.code : undefined;
    this.code = code;
    this.raw = serverError;
    this.metacomPacket = callbackPacket;
  }
}

/** Текстовый кадр Metacom: в браузере string, в Node `ws` — часто Buffer. */
function wsTextFrameToString(data) {
  if (typeof data === 'string') return data;
  if (Buffer.isBuffer(data)) return data.toString('utf8');
  if (data instanceof ArrayBuffer) return Buffer.from(data).toString('utf8');
  if (ArrayBuffer.isView(data)) {
    return Buffer.from(data.buffer, data.byteOffset, data.byteLength).toString('utf8');
  }
  return '';
}

class MetacomIntegrationClient {
  constructor(url, options = {}) {
    this.url = url;
    this.callTimeout = options.callTimeout ?? CALL_TIMEOUT_MS;
    this.connectTimeout = options.connectTimeout ?? 15_000;
    this.socket = null;
    this.connected = false;
    this.callId = 0;
    this.calls = new Map();
    this.api = {};
  }

  connect() {
    return new Promise((resolve, reject) => {
      let settled = false;
      let timer = null;
      const socket = new WebSocket(this.url);
      this.socket = socket;

      const finish = (err, ok) => {
        if (settled) return;
        settled = true;
        if (timer) clearTimeout(timer);
        if (ok) {
          this.connected = true;
          resolve();
        } else {
          reject(err);
        }
      };

      timer = setTimeout(() => {
        socket.close();
        const msg =
          'Таймаут WebSocket. Проверьте URL и что сервер запущен. ' +
          'Подсказка: TASKFLOW_METACOM_URL=ws://127.0.0.1:8001/api';
        finish(new Error(msg), false);
      }, this.connectTimeout);

      socket.on('message', (data) => {
        const text = wsTextFrameToString(data);
        if (!text) return;
        this.#onMessage(text);
      });
      socket.once('open', () => finish(null, true));
      socket.once('error', (err) => finish(err, false));
      socket.once('close', () => {
        this.connected = false;
      });
    });
  }

  close() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.connected = false;
  }

  #onMessage(data) {
    if (data === '{}') return;
    let packet;
    try {
      packet = JSON.parse(data);
    } catch {
      return;
    }
    const { type, id } = packet;
    if (type === 'event') return;
    if (!id) return;
    if (type === 'callback') {
      const promised = this.calls.get(id);
      if (!promised) return;
      const [res, rej, timeout] = promised;
      this.calls.delete(id);
      clearTimeout(timeout);
      if (packet.error) {
        rej(new MetacomError(packet.error, packet));
        return;
      }
      res(packet.result);
    }
  }

  #scaffold(unit) {
    return (method) =>
      async (args = {}) => {
        const id = ++this.callId;
        const target = `${unit}/${method}`;
        if (!this.connected) {
          throw new Error('WebSocket не подключён');
        }
        return new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            if (this.calls.has(id)) {
              this.calls.delete(id);
              reject(new Error(`Request timeout: ${target}`));
            }
          }, this.callTimeout);
          this.calls.set(id, [resolve, reject, timeout]);
          const packet = { type: 'call', id, method: target, args };
          this.socket.send(JSON.stringify(packet));
        });
      };
  }

  async load(...units) {
    const introspect = this.#scaffold('system')('introspect');
    const introspection = await introspect(units);
    const available = Object.keys(introspection || {});
    for (const unit of units) {
      if (!available.includes(unit)) continue;
      const instance = introspection[unit];
      const request = this.#scaffold(unit);
      const methods = {};
      for (const methodName of Object.keys(instance || {})) {
        methods[methodName] = request(methodName);
      }
      this.api[unit] = methods;
    }
  }

  async call(unit, method, args = {}) {
    const fn = this.api?.[unit]?.[method];
    if (typeof fn !== 'function') {
      throw new Error(`Метод недоступен: ${unit}/${method}`);
    }
    return fn(args);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

function assertOk(result, label) {
  const ok = result && typeof result === 'object' && result.status === 'ok';
  assert(ok, `${label}: ожидался { status: 'ok' }`);
}

function assertRegisterOk(result, label) {
  const ok = result && typeof result === 'object' && result.status === 'success';
  assert(ok, `${label}: ожидался { status: 'success' }`);
  assert(result.user && result.user.userId, `${label}: нет user.userId`);
}

function rpcErrorText(err) {
  if (!err) return '';
  const parts = [err.message, err.stack].filter(Boolean);
  return parts.join('\n');
}

/** Ошибка из getUserTaskList при отсутствии domain.collections.task[taskType]. */
function looksLikeMissingTaskSchemaError(text) {
  const s = String(text || '');
  if (!s.includes('schema')) return false;
  return s.includes('undefined') || s.includes('getUserTaskList') || s.includes('Cannot read properties of undefined');
}

function printMissingTaskSchemaHint() {
  console.error(
    '\n[диагностика] Похоже, в MongoDB есть задача с полем taskType, для которого нет модуля схемы на бэкенде.',
  );
  console.error(
    'Ожидается файл: application/domain/collections/task/<taskType>.js ' +
      '(ключ domain.collections.task[<taskType>]).',
  );
  console.error(
    'Проверьте документы в коллекции task (поле taskType) и справочник ' +
      'domain/lst/taskTypes.js — code должен совпадать с именем файла схемы.',
  );
  console.error('Пример в mongosh: db.task.distinct(\'taskType\')');
}

/**
 * Задачи, у которых taskType не входит в переданный lst.taskTypes (опечатка / старый код).
 */
function warnTasksNotInTaskTypesLst(list, taskTypesFromLst) {
  const codes = new Set((taskTypesFromLst || []).map((t) => String(t?.code || '').trim()).filter(Boolean));
  for (const task of list.tasks || []) {
    const tt = String(task.taskType || '').trim();
    if (tt && !codes.has(tt)) {
      console.warn(`[диагностика] задача ${task._id}: taskType «${tt}» отсутствует в lst.taskTypes`);
    }
  }
}

function clearIntegrationLogArtifacts() {
  for (const p of [LAST_ERR_JSON, LAST_ERR_TXT]) {
    try {
      fs.unlinkSync(p);
    } catch {
      /* нет файла */
    }
  }
}

/** Снимок ошибки для JSON (включая сырое тело Metacom). */
function errorToPlain(err, depth = 0) {
  if (!err || depth > 8) return null;
  const plain = {
    type: err.constructor?.name || typeof err,
    name: err.name,
    message: err.message,
    stack: err.stack,
    code: err.code,
  };
  if (err instanceof MetacomError) {
    plain.metacomErrorPayload = err.raw;
    plain.metacomCallbackPacket = err.metacomPacket;
  }
  if (err.cause) plain.cause = errorToPlain(err.cause, depth + 1);
  return plain;
}

/**
 * Пишет последнюю ошибку в backend/log/ — её можно открыть в Cursor (Read),
 * форма та же, что в консоли + полный Metacom callback при RPC.
 */
function writeLastIntegrationFailure(err, meta) {
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  } catch {
    return;
  }
  const payload = {
    ...meta,
    capturedAt: new Date().toISOString(),
    error: errorToPlain(err),
  };
  let json;
  try {
    json = JSON.stringify(payload, null, 2);
  } catch (serErr) {
    json = JSON.stringify({
      ...meta,
      capturedAt: payload.capturedAt,
      jsonStringifyError: String(serErr?.message || serErr),
      errorMessage: err?.message,
      errorStack: err?.stack,
    });
  }
  const txt = [
    `# capturedAt: ${payload.capturedAt}`,
    `# phase: ${meta.phase || ''}`,
    `# url: ${meta.url || ''}`,
    '',
    '##-- JSON (same as last-integration-error.json) --##',
    json,
    '',
    '##-- stack --##',
    err?.stack || String(err),
  ].join('\n');
  try {
    fs.writeFileSync(LAST_ERR_JSON, `${json}\n`, 'utf8');
    fs.writeFileSync(LAST_ERR_TXT, txt, 'utf8');
  } catch {
    /* нет прав / диск */
  }
}

async function callGetUserTaskList(client) {
  try {
    return await client.call('core', 'getUserTaskList', {});
  } catch (e) {
    const text = rpcErrorText(e);
    if (looksLikeMissingTaskSchemaError(text)) {
      printMissingTaskSchemaHint();
    }
    throw e;
  }
}

async function fetchLst(client, ph, name) {
  ph.phase = `getLst.${name}`;
  const r = await client.call('core', 'getLst', { name });
  return Array.isArray(r?.items) ? r.items : [];
}

function seedTitle(loginLabel, taskTypeCode) {
  return `[seed ${loginLabel}] ${taskTypeCode} ${new Date().toISOString()}`;
}

function randomSuffix() {
  return Math.random().toString(36).slice(2, 10);
}

async function createOneTask(client, ph, userId, loginLabel, taskTypeCode) {
  ph.phase = `addObject.task.${taskTypeCode}`;
  const title = seedTitle(loginLabel, taskTypeCode);
  const addRes = await client.call('core', 'addObject', {
    collection: 'task',
    document: {
      title,
      taskType: taskTypeCode,
      status: 'todo',
      userLinks: { [userId]: {} },
    },
  });
  assertOk(addRes, `addObject(task ${taskTypeCode})`);
  const list = await callGetUserTaskList(client);
  const created = list.tasks.find((t) => t.title === title && String(t.taskType) === taskTypeCode);
  assert(created?._id, `задача типа ${taskTypeCode} не найдена в списке`);
  return { taskId: String(created._id), title };
}

async function seedCreateSubdivision(client, ph, taskId) {
  ph.phase = 'addObject.subdivision';
  const stamp = Date.now();
  const linkRes = await client.call('core', 'addObject', {
    collection: 'subdivision',
    document: {
      name: `Подразделение ${stamp}`,
      description: 'integration seed',
    },
    link: {
      collection: 'task',
      _id: taskId,
      linkField: 'createdSubdivisionLinks',
    },
  });
  assertOk(linkRes, 'addObject(subdivision+link)');
}

async function seedAddUserFull(client, ph, taskId, caches) {
  ph.phase = 'addObject.user.createdUserLinks';
  const subLogin = `seed_u_${Date.now()}_${randomSuffix()}`;
  const ures = await client.call('core', 'addObject', {
    collection: 'user',
    document: {
      login: subLogin,
      password: 'Seed1!pass',
    },
    link: {
      collection: 'task',
      _id: taskId,
      linkField: 'createdUserLinks',
    },
  });
  assertOk(ures, 'addObject(user+createdUserLinks)');

  ph.phase = 'getTask.afterUser';
  const d0 = await client.call('core', 'getTask', { _id: taskId });
  const cLinks = d0?.store?.task?.[taskId]?.createdUserLinks || {};
  const childUserId = Object.keys(cLinks).filter(Boolean)[0];
  assert(childUserId, 'нет id созданного пользователя в createdUserLinks');

  const roleCode = String(caches.userRoles[0]?.code || 'dev');
  ph.phase = 'addObject.userRole';
  const rres = await client.call('core', 'addObject', {
    collection: 'userRole',
    document: { type: roleCode },
    link: {
      collection: 'user',
      _id: childUserId,
      linkField: 'userRoleList',
    },
  });
  assertOk(rres, 'addObject(userRole)');

  ph.phase = 'addObject.pp';
  const pres = await client.call('core', 'addObject', {
    collection: 'pp',
    document: {
      firstName: 'Интег',
      lastName: 'Сид',
      middleName: 'П',
      birthDate: '1990-01-15',
      gender: 'unspecified',
    },
    link: {
      collection: 'user',
      _id: childUserId,
      linkField: 'ppList',
    },
  });
  assertOk(pres, 'addObject(pp)');

  ph.phase = 'getTask.afterPp';
  const d1 = await client.call('core', 'getTask', { _id: taskId });
  const ppMap = d1?.store?.user?.[childUserId]?.ppList || {};
  const ppId = Object.keys(ppMap).filter(Boolean)[0];
  assert(ppId, 'нет pp в ppList');

  const phoneType = String(caches.phoneTypes[0]?.code || '');
  assert(phoneType, 'phoneTypes: пустой справочник');
  ph.phase = 'addObject.phone';
  const phres = await client.call('core', 'addObject', {
    collection: 'phone',
    document: {
      phoneType,
      number: '+79991112233',
    },
    link: {
      collection: 'pp',
      _id: ppId,
      linkField: 'phoneList',
    },
  });
  assertOk(phres, 'addObject(phone)');
}

async function assertSeedTaskIntegrity(client, ph, taskId, taskTypeCode) {
  ph.phase = `getTask.assert.${taskTypeCode}`;
  const detail = await client.call('core', 'getTask', { _id: taskId });
  const t = detail?.store?.task?.[taskId];
  assert(t, 'getTask: нет задачи');
  assert(String(t.taskType) === taskTypeCode, 'getTask: неверный taskType');
  if (taskTypeCode === 'createSubdivision') {
    const ids = Object.keys(t.createdSubdivisionLinks || {}).filter(Boolean);
    assert(ids.length > 0, 'createSubdivision: нет связей');
    const sub = detail.store.subdivision?.[ids[0]];
    assert(sub && sub.name, 'createSubdivision: нет subdivision в store');
  }
  if (taskTypeCode === 'addUser') {
    const uids = Object.keys(t.createdUserLinks || {}).filter(Boolean);
    assert(uids.length > 0, 'addUser: нет createdUserLinks');
    const u = detail.store.user?.[uids[0]];
    assert(u && u.login, 'addUser: нет user в store');
    assert(Object.keys(u.userRoleList || {}).length > 0, 'addUser: нет ролей');
    assert(Object.keys(u.ppList || {}).length > 0, 'addUser: нет pp');
    const ppId = Object.keys(u.ppList).filter(Boolean)[0];
    const pp = detail.store.pp?.[ppId];
    assert(pp && pp.firstName, 'addUser: нет pp в store');
    assert(Object.keys(pp.phoneList || {}).length > 0, 'addUser: нет телефона у pp');
  }
}

async function runRegisterAndSeedAllTaskTypes(client, ph) {
  const stamp = Date.now();
  const loginUsed = `it_${stamp}_${randomSuffix()}`;
  const passwordUsed = env('TASKFLOW_PASSWORD') || env('TASKFLOW_AUTO_PASSWORD', 'Itest!9same');
  ph.phase = 'auth.register';
  const reg = await client.call('auth', 'register', {
    login: loginUsed,
    password: passwordUsed,
  });
  assertRegisterOk(reg, 'register');
  const userId = String(reg.user.userId);
  console.log(`Зарегистрирован пользователь: ${loginUsed} (userId=${userId})`);

  const taskTypeItems = await fetchLst(client, ph, 'taskTypes');
  assert(taskTypeItems.length > 0, 'getLst(taskTypes): пустой список');
  const userRoles = await fetchLst(client, ph, 'userRoles');
  const phoneTypes = await fetchLst(client, ph, 'phoneTypes');
  const caches = { userRoles, phoneTypes };

  for (const entry of taskTypeItems) {
    const code = String(entry?.code || '').trim();
    if (!code) continue;
    const { taskId } = await createOneTask(client, ph, userId, loginUsed, code);
    if (code === 'createSubdivision') {
      await seedCreateSubdivision(client, ph, taskId);
    } else if (code === 'addUser') {
      await seedAddUserFull(client, ph, taskId, caches);
    }
    await assertSeedTaskIntegrity(client, ph, taskId, code);
    console.log(`Посев OK: тип=${code}, taskId=${taskId}`);
  }

  ph.phase = 'getUserTaskList.afterSeed';
  const fin = await callGetUserTaskList(client);
  const needle = `[seed ${loginUsed}]`;
  const mine = (fin.tasks || []).filter((t) => String(t.title || '').includes(needle));
  assert(mine.length >= taskTypeItems.length, `ожидалось не меньше ${taskTypeItems.length} задач с префиксом seed`);
  console.log(`В списке пользователя задач с префиксом seed: ${mine.length}`);
}

async function runSigninSingleTaskScenario(client, ph, taskType, userId) {
  ph.phase = 'getUserTaskList';
  const list = await callGetUserTaskList(client);
  assert(Array.isArray(list?.tasks), 'getUserTaskList: нет массива tasks');
  const taskTypes = list?.lst?.taskTypes;
  assert(Array.isArray(taskTypes), 'getUserTaskList: нет lst.taskTypes');
  warnTasksNotInTaskTypesLst(list, taskTypes);
  const hasType = taskTypes.some((t) => String(t?.code) === taskType);
  const msgNoType = `getUserTaskList: в справочнике нет taskType «${taskType}»`;
  assert(hasType, msgNoType);
  const n = list.tasks.length;
  console.log(`getUserTaskList: ok, задач: ${n}, тип «${taskType}» в справочнике`);

  const title = `[integration] ${taskType} ${new Date().toISOString()}`;
  ph.phase = 'addObject.task';
  const addRes = await client.call('core', 'addObject', {
    collection: 'task',
    document: {
      title,
      taskType,
      status: 'todo',
      userLinks: { [userId]: {} },
    },
  });
  assertOk(addRes, 'addObject(task)');
  console.log('addObject(task): ok');

  ph.phase = 'getUserTaskList.afterAdd';
  const tasksAfter = await callGetUserTaskList(client);
  const created = tasksAfter.tasks.find((t) => t.title === title && String(t.taskType) === taskType);
  assert(created?._id, 'Созданная задача не найдена в getUserTaskList');
  const taskId = String(created._id);
  console.log(`Задача в списке: _id=${taskId}`);

  ph.phase = 'getTask';
  const detail = await client.call('core', 'getTask', { _id: taskId });
  assert(detail?.store?.task?.[taskId], 'getTask: нет store.task[_id]');
  const taskDoc = detail.store.task[taskId];
  assert(String(taskDoc.taskType) === taskType, 'getTask: неверный taskType');
  console.log('getTask: ok');

  if (taskType === 'createSubdivision') {
    await seedCreateSubdivision(client, ph, taskId);
    const msgLink = 'addObject(subdivision + createdSubdivisionLinks): ok';
    console.log(msgLink);
  } else if (taskType === 'addUser') {
    const userRoles = await fetchLst(client, ph, 'userRoles');
    const phoneTypes = await fetchLst(client, ph, 'phoneTypes');
    await seedAddUserFull(client, ph, taskId, { userRoles, phoneTypes });
    console.log('addUser: связанный user + роль + pp + phone');
  }

  await assertSeedTaskIntegrity(client, ph, taskId, taskType);
}

async function main() {
  const url = env('TASKFLOW_METACOM_URL', DEFAULT_WS);
  const loginEnv = env('TASKFLOW_LOGIN');
  const passwordEnv = env('TASKFLOW_PASSWORD');
  const taskType = env('TASKFLOW_TASK_TYPE', 'createSubdivision');
  const connectTimeout = Number(env('TASKFLOW_CONNECT_TIMEOUT_MS', '15000'));

  if (loginEnv && !passwordEnv) {
    console.error('С TASKFLOW_LOGIN нужен TASKFLOW_PASSWORD.');
    process.exitCode = 1;
    return;
  }

  const client = new MetacomIntegrationClient(url, {
    callTimeout: CALL_TIMEOUT_MS,
    connectTimeout,
  });
  console.log(`Подключение: ${url}`);

  const ph = { phase: 'init' };

  try {
    ph.phase = 'ws.connect';
    await client.connect();
    ph.phase = 'metacom.load';
    await client.load('auth', 'core');

    if (loginEnv) {
      ph.phase = 'auth.signin';
      const signin = await client.call('auth', 'signin', { login: loginEnv, password: passwordEnv });
      const logged = signin?.status === 'logged' && signin?.user?.userId;
      assert(logged, 'signin: нет status=logged или user.userId');
      const userId = String(signin.user.userId);
      console.log(`Вход: ok, userId=${userId} (${loginEnv})`);
      await runSigninSingleTaskScenario(client, ph, taskType, userId);
    } else {
      await runRegisterAndSeedAllTaskTypes(client, ph);
    }

    clearIntegrationLogArtifacts();
    console.log('\nВсе проверки прошли успешно.');
  } catch (e) {
    writeLastIntegrationFailure(e, { phase: ph.phase, url });
    console.error('\nОшибка:', e?.message || e);
    const code = e && e.code;
    if (code !== undefined && code !== null) {
      console.error('code:', code);
    }
    const errStr = rpcErrorText(e);
    if (looksLikeMissingTaskSchemaError(errStr)) {
      printMissingTaskSchemaHint();
    }
    const hint302 = String(e?.message || '').includes('302');
    if (hint302) {
      const hint =
        'Подсказка: балансер :8000 часто отвечает редиректом на WebSocket. ' +
        'Укажите TASKFLOW_METACOM_URL=ws://127.0.0.1:8001/api';
      console.error(hint);
    }
    process.exitCode = 1;
    const relTxt = path.relative(process.cwd(), LAST_ERR_TXT);
    const relJson = path.relative(process.cwd(), LAST_ERR_JSON);
    console.error(`Полный дамп (открой в Cursor): ${relTxt} и ${relJson}`);
  } finally {
    client.close();
  }
}

main();
