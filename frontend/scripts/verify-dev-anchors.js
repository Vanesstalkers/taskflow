import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateDevAnchorManifest } from '../plugins/vite-plugin-dev-anchors.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND_ROOT = path.resolve(__dirname, '..');
const committedPath = path.join(FRONTEND_ROOT, 'dev-anchor-manifest.json');

if (!fs.existsSync(committedPath)) {
  console.error('Missing dev-anchor-manifest.json — run: npm run anchors:gen');
  process.exit(1);
}

const tmpPath = path.join(FRONTEND_ROOT, '.dev-anchor-manifest.generated.json');

try {
  generateDevAnchorManifest({ outFile: tmpPath });

  const committed = JSON.parse(fs.readFileSync(committedPath, 'utf8'));
  const generated = JSON.parse(fs.readFileSync(tmpPath, 'utf8'));

  const normalize = (manifest) => manifest.anchors;
  const same = JSON.stringify(normalize(committed)) === JSON.stringify(normalize(generated));

  if (!same) {
    console.error('dev-anchor-manifest.json is out of date. Run: npm run anchors:gen');
    process.exit(1);
  }

  console.log(`OK: ${Object.keys(committed.anchors).length} anchors match sources`);
} finally {
  if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
}
