import { generateDevAnchorManifest } from '../plugins/vite-plugin-dev-anchors.js';

const { count, outFile } = generateDevAnchorManifest();
console.log(`Generated ${count} anchors → ${outFile}`);
