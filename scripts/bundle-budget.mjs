#!/usr/bin/env node
/**
 * Fails if the gzipped size of the *initial-load* bundle exceeds the budget.
 * Run this after `npm run build`. CI invokes it in the `Build` job so a
 * regression blocks the merge.
 *
 * Per maintainer/decisions.md DEC-005, the budget is 350 KB gzipped — chosen
 * above the 230 KB analyst estimate for v1.1 to allow normal feature growth,
 * well under the 400 KB Mantine `code-highlight` mis-import line. DEC-005's
 * concern is page-load slowness ("UI is tiny" turning into "UI is slow"), so
 * this check is scoped to assets the browser fetches on first paint.
 *
 * Implementation: we parse `dist/index.html` and sum only the JS/CSS files it
 * references directly. Lazy/code-split chunks (loaded via dynamic `import()`
 * after a user action — for example the gpt-tokenizer encoder pulled on first
 * log-row expand, DEC-009 / DEC-012) do not contribute to first-paint time
 * and are reported separately for visibility but excluded from the budget.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';

const BUDGET_KB = 350;
const DIST_ASSETS = 'dist/assets';
const DIST_INDEX = 'dist/index.html';

function readIndexHtml() {
  try {
    return readFileSync(DIST_INDEX, 'utf8');
  } catch (err) {
    console.error(`Could not read ${DIST_INDEX}: ${err.message}`);
    console.error('Run `npm run build` first.');
    process.exit(2);
  }
}

function listAssets() {
  try {
    return readdirSync(DIST_ASSETS).filter((f) => f.endsWith('.js') || f.endsWith('.css'));
  } catch (err) {
    console.error(`Could not read ${DIST_ASSETS}: ${err.message}`);
    console.error('Run `npm run build` first.');
    process.exit(2);
  }
}

const html = readIndexHtml();
const files = listAssets();

// Names of files referenced directly from index.html (initial load).
const initialNames = new Set();
for (const name of files) {
  if (html.includes(name)) initialNames.add(name);
}

let initialGz = 0;
let lazyGz = 0;
const initialRows = [];
const lazyRows = [];

for (const name of files) {
  const path = join(DIST_ASSETS, name);
  const raw = readFileSync(path);
  const gz = gzipSync(raw).byteLength;
  if (initialNames.has(name)) {
    initialGz += gz;
    initialRows.push({ name, raw: raw.byteLength, gz });
  } else {
    lazyGz += gz;
    lazyRows.push({ name, raw: raw.byteLength, gz });
  }
}

initialRows.sort((a, b) => b.gz - a.gz);
lazyRows.sort((a, b) => b.gz - a.gz);

function fmtRow(r) {
  const rawKb = (r.raw / 1024).toFixed(1).padStart(7);
  const gzKb = (r.gz / 1024).toFixed(1).padStart(6);
  return `    ${rawKb} KB raw / ${gzKb} KB gz   ${r.name}`;
}

console.log('Bundle budget check (DEC-005):');
console.log(`  Budget:       ${BUDGET_KB} KB gzipped (initial load)`);
console.log('  Initial-load files (counted against budget):');
for (const r of initialRows) console.log(fmtRow(r));

if (lazyRows.length > 0) {
  console.log('  Lazy / on-demand chunks (NOT counted against budget):');
  for (const r of lazyRows) console.log(fmtRow(r));
}

const totalKb = initialGz / 1024;
const budgetBytes = BUDGET_KB * 1024;
console.log(`  Initial total: ${totalKb.toFixed(1)} KB gz`);
if (lazyRows.length > 0) {
  console.log(`  Lazy total:    ${(lazyGz / 1024).toFixed(1)} KB gz`);
}

if (initialGz > budgetBytes) {
  const overage = ((initialGz - budgetBytes) / 1024).toFixed(1);
  console.error(`\n❌ Bundle exceeds budget by ${overage} KB gzipped.`);
  console.error(`   Either trim deps, switch to a lighter alternative, or`);
  console.error(`   raise BUDGET_KB in scripts/bundle-budget.mjs with a`);
  console.error(`   justification appended to maintainer/decisions.md DEC-005.`);
  process.exit(1);
}

const headroomKb = ((budgetBytes - initialGz) / 1024).toFixed(1);
console.log(`  Headroom:      ${headroomKb} KB gz`);
console.log('\n✅ Bundle within budget.');
