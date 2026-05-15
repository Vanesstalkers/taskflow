import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { globSync } from 'glob';
import { parse as parseSfc } from '@vue/compiler-sfc';
import { parse as parseTemplate, NodeTypes } from '@vue/compiler-dom';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(FRONTEND_ROOT, '..');

const ANCHOR_TAGS = new Set([
  'Input',
  'InputInline',
  'InputFile',
  'Select',
  'Textarea',
  'Radio',
  'Checkbox',
]);

function pascalFileBaseToTaskType(base) {
  if (!base) return '';
  return base.charAt(0).toLowerCase() + base.slice(1);
}

function fileToScopePrefix(relativeFromSrc) {
  const normalized = relativeFromSrc.replace(/\\/g, '/');
  const tasksMatch = normalized.match(/^components\/tasks\/([^/]+)\.vue$/);
  if (tasksMatch) {
    return pascalFileBaseToTaskType(tasksMatch[1].replace(/\.vue$/i, ''));
  }
  return normalized
    .replace(/^components\//, 'components.')
    .replace(/\.vue$/i, '')
    .replace(/\//g, '.');
}

function kebabToCamel(name) {
  return name.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

function getStaticAttrs(node) {
  const out = {};
  for (const prop of node.props || []) {
    if (prop.type === NodeTypes.ATTRIBUTE) {
      out[kebabToCamel(prop.name)] = prop.value?.content ?? '';
    }
  }
  return out;
}

function literalFromExprNode(exprNode) {
  if (!exprNode) return null;
  if (exprNode.type === NodeTypes.SIMPLE_EXPRESSION) {
    const raw = String(exprNode.content || '').trim();
    return raw.replace(/^['"]|['"]$/g, '');
  }
  return null;
}

function objectExpressionToMap(objExpr) {
  const out = {};
  if (!objExpr || objExpr.type !== NodeTypes.OBJECT_EXPRESSION) return out;
  for (const prop of objExpr.properties || []) {
    if (prop.type !== NodeTypes.PROPERTY) continue;
    let key = '';
    if (prop.key.type === NodeTypes.SIMPLE_EXPRESSION) {
      key = String(prop.key.content || '').trim();
    } else if (prop.key.type === NodeTypes.COMPOUND_EXPRESSION) {
      continue;
    } else {
      key = String(prop.key.name || prop.key.value || '').trim();
    }
    if (!key) continue;
    const camelKey = kebabToCamel(key);
    const val = literalFromExprNode(prop.value);
    if (val != null) out[camelKey] = val;
  }
  return out;
}

function parseObjectLiteralContent(content) {
  const out = {};
  const text = String(content || '');
  const re = /([a-zA-Z_$][\w$]*)\s*:\s*['"]([^'"]*)['"]/g;
  let match = re.exec(text);
  while (match) {
    out[kebabToCamel(match[1])] = match[2];
    match = re.exec(text);
  }
  return out;
}

function getBoundObjectLiteral(node, bindArg) {
  for (const prop of node.props || []) {
    if (prop.type !== NodeTypes.DIRECTIVE) continue;
    if (prop.name !== 'bind') continue;
    const arg = prop.arg?.type === NodeTypes.SIMPLE_EXPRESSION ? prop.arg.content : prop.arg?.content;
    if (arg !== bindArg) continue;
    if (prop.exp?.ast) {
      const fromAst = objectExpressionToMap(prop.exp.ast);
      if (Object.keys(fromAst).length > 0) return fromAst;
    }
    if (prop.exp?.content) {
      return parseObjectLiteralContent(prop.exp.content);
    }
  }
  return null;
}

function parentSchemaFileFor(scope, parentCollection) {
  const parent = String(parentCollection || '').trim();
  if (!parent) return null;
  if (parent === 'task') {
    const taskType = String(scope || '').trim();
    if (!taskType) return null;
    const rel = `backend/application/domain/collections/task/${taskType}.js`;
    return existsRepo(rel) ? rel : null;
  }
  return schemaFileFor(parent);
}

function buildLinkDevId(scope, persist, explicitDevId = '') {
  if (explicitDevId) return String(explicitDevId).trim();
  const linkField = String(persist.linkField || '').trim();
  if (!linkField) return '';
  const parentCollection = String(persist.parentCollection || 'task').trim() || 'task';
  return `${scope}.link.${parentCollection}.${linkField}`;
}

function lstFileFor(lstName) {
  if (!lstName) return null;
  return `backend/application/domain/lst/${lstName}.js`;
}

function schemaFileFor(collection) {
  if (!collection) return null;
  if (collection === 'task') return 'backend/application/domain/task.js';
  return `backend/application/domain/collections/${collection}.js`;
}

function existsRepo(relPath) {
  if (!relPath) return true;
  return fs.existsSync(path.join(REPO_ROOT, relPath));
}

function walkNodes(node, visit) {
  if (!node) return;
  visit(node);
  if (node.children) {
    for (const child of node.children) walkNodes(child, visit);
  }
}

function collectAnchorsFromVue(absFile) {
  const relFromSrc = path.relative(path.join(FRONTEND_ROOT, 'src'), absFile).replace(/\\/g, '/');
  const scope = fileToScopePrefix(relFromSrc);
  const source = fs.readFileSync(absFile, 'utf8');
  const { descriptor, errors } = parseSfc(source, { filename: absFile });
  if (errors?.length) {
    throw new Error(`${relFromSrc}: ${errors[0]}`);
  }

  const anchors = [];
  const templateBlock = descriptor.template;
  if (!templateBlock) return anchors;

  const ast = parseTemplate(templateBlock.content, { filename: absFile });

  walkNodes(ast, (node) => {
    if (node.type !== NodeTypes.ELEMENT) return;

    const tag = node.tag;
    const line = node.loc?.start?.line ?? null;
    const attrs = getStaticAttrs(node);

    if (attrs.dataDevId || attrs.devId) {
      const devId = attrs.devId || attrs.dataDevId;
      anchors.push({
        kind: 'explicit',
        devId,
        scope,
        file: `src/${relFromSrc}`,
        line,
        component: tag,
        collection: attrs.collection || '',
        field: attrs.field || '',
        lstName: attrs.lstName || '',
        label: attrs.label || attrs.fieldLabel || '',
      });
      return;
    }

    if (tag === 'ComplexBlock') {
      const persist = getBoundObjectLiteral(node, 'persist');
      const texts = getBoundObjectLiteral(node, 'texts');
      if (persist?.linkField && persist?.collection) {
        const devId = buildLinkDevId(scope, persist, attrs.devId);
        anchors.push({
          kind: 'link',
          devId,
          scope,
          file: `src/${relFromSrc}`,
          line,
          component: tag,
          collection: persist.collection,
          parentCollection: persist.parentCollection || 'task',
          linkField: persist.linkField,
          label: texts?.blockTitle || texts?.pickerLabel || '',
        });
      }
      return;
    }

    if (!ANCHOR_TAGS.has(tag)) return;

    const { collection, field, lstName, label, devId: explicitDevId, fieldLabel } = attrs;
    if (!collection || !field) return;

    const devId = explicitDevId || `${scope}.${collection}.${field}`;
    anchors.push({
      kind: 'field',
      devId,
      scope,
      file: `src/${relFromSrc}`,
      line,
      component: tag,
      collection,
      field,
      lstName,
      label: label || fieldLabel || '',
    });
  });

  return anchors;
}

function buildManifest(records) {
  const anchors = {};
  const duplicates = [];

  for (const record of records) {
    if (anchors[record.devId]) duplicates.push(record.devId);

    const ui = {
      file: record.file,
      line: record.line,
      component: record.component,
      ...(record.label ? { label: record.label } : {}),
    };

    if (record.kind === 'link') {
      const schemaFile = schemaFileFor(record.collection);
      const parentSchemaFile = parentSchemaFileFor(record.scope, record.parentCollection);
      anchors[record.devId] = {
        devId: record.devId,
        ui,
        domain: {
          kind: 'link',
          collection: record.collection,
          parentCollection: record.parentCollection,
          linkField: record.linkField,
          ...(schemaFile ? { schemaFile } : {}),
          ...(parentSchemaFile ? { parentSchemaFile } : {}),
        },
      };
      continue;
    }

    const schemaFile = schemaFileFor(record.collection);
    const lstFile = lstFileFor(record.lstName);

    anchors[record.devId] = {
      devId: record.devId,
      ui,
      domain: {
        kind: 'field',
        collection: record.collection,
        field: record.field,
        ...(record.lstName ? { lst: record.lstName } : {}),
        ...(schemaFile ? { schemaFile } : {}),
        ...(lstFile ? { lstFile } : {}),
      },
    };
  }

  return { anchors, duplicates };
}

function validateManifest({ anchors, duplicates }) {
  if (duplicates.length) {
    throw new Error(`Duplicate devId: ${[...new Set(duplicates)].join(', ')}`);
  }

  const missingBackend = [];
  for (const anchor of Object.values(anchors)) {
    const { schemaFile, lstFile, parentSchemaFile } = anchor.domain || {};
    if (schemaFile && !existsRepo(schemaFile)) missingBackend.push(schemaFile);
    if (lstFile && !existsRepo(lstFile)) missingBackend.push(lstFile);
    if (parentSchemaFile && !existsRepo(parentSchemaFile)) missingBackend.push(parentSchemaFile);
  }
  if (missingBackend.length) {
    throw new Error(`Missing backend files:\n${[...new Set(missingBackend)].join('\n')}`);
  }
}

export function scanDevAnchors(options = {}) {
  const srcGlob = options.srcGlob || 'src/**/*.vue';
  const files = globSync(srcGlob, {
    cwd: FRONTEND_ROOT,
    absolute: true,
    ignore: ['**/node_modules/**'],
  });
  const records = files.flatMap(collectAnchorsFromVue);
  const built = buildManifest(records);
  validateManifest(built);
  return built;
}

export function generateDevAnchorManifest(options = {}) {
  const outFile = options.outFile || path.join(FRONTEND_ROOT, 'dev-anchor-manifest.json');
  const { anchors } = scanDevAnchors(options);
  const manifest = {
    version: 1,
    generatedAt: new Date().toISOString(),
    anchors,
  };
  fs.writeFileSync(outFile, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return { count: Object.keys(anchors).length, outFile, manifest };
}

function isSrcVueFile(file) {
  const normalized = file.replace(/\\/g, '/');
  return normalized.endsWith('.vue') && normalized.includes('/src/');
}

function createLogger(ctx) {
  return {
    info(msg) {
      if (ctx?.info) ctx.info(msg);
      else console.log(`[dev-anchors] ${msg}`);
    },
    warn(msg) {
      if (ctx?.warn) ctx.warn(msg);
      else console.warn(`[dev-anchors] ${msg}`);
    },
  };
}

function runGenerate(ctx, outFile, pluginOptions, { soft = false } = {}) {
  const log = createLogger(ctx);
  try {
    const { count } = generateDevAnchorManifest({ ...pluginOptions, outFile });
    const rel = path.relative(FRONTEND_ROOT, outFile);
    log.info(`dev-anchor-manifest: ${count} anchors → ${rel}`);
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (soft) {
      log.warn(`dev-anchor-manifest skipped: ${message}`);
      return false;
    }
    throw err;
  }
}

export function devAnchorsPlugin(options = {}) {
  const outFile = options.outFile || path.join(FRONTEND_ROOT, 'dev-anchor-manifest.json');
  const debounceMs = options.debounceMs ?? 200;
  let debounceTimer = null;
  let devServer = null;

  const scheduleRegenerate = () => {
    if (!devServer) return;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      runGenerate(devServer.config.logger, outFile, options, { soft: true });
    }, debounceMs);
  };

  const onVueFsChange = (file) => {
    if (isSrcVueFile(file)) scheduleRegenerate();
  };

  return {
    name: 'vite-plugin-dev-anchors',
    enforce: 'pre',
    buildStart() {
      runGenerate(this, outFile, options, { soft: false });
    },
    configureServer(server) {
      devServer = server;
      runGenerate(server.config.logger, outFile, options, { soft: true });

      server.watcher.on('change', onVueFsChange);
      server.watcher.on('add', onVueFsChange);
      server.watcher.on('unlink', onVueFsChange);

      server.middlewares.use((req, res, next) => {
        const url = req.url?.split('?')[0];
        if (url !== '/dev-anchor-manifest.json') {
          next();
          return;
        }
        if (!fs.existsSync(outFile)) {
          res.statusCode = 404;
          res.end('dev-anchor-manifest.json not found');
          return;
        }
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(fs.readFileSync(outFile, 'utf8'));
      });
    },
    handleHotUpdate({ file }) {
      if (isSrcVueFile(file)) {
        scheduleRegenerate();
      }
    },
    writeBundle() {
      if (!fs.existsSync(outFile)) return;
      const distFile = path.join(FRONTEND_ROOT, 'dist', 'dev-anchor-manifest.json');
      fs.mkdirSync(path.dirname(distFile), { recursive: true });
      fs.copyFileSync(outFile, distFile);
    },
  };
}
