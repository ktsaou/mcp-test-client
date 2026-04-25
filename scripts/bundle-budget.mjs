#!/usr/bin/env node
/**
 * Fails if the gzipped size of `dist/assets/*.js` plus `dist/assets/*.css`
 * exceeds the budget. Run this after `npm run build`. CI invokes it in the
 * `Build` job so a regression blocks the merge.
 *
 * Per maintainer/decisions.md DEC-005, the budget is 350 KB gzipped — chosen
 * above the 230 KB analyst estimate for v1.1 to allow normal feature growth,
 * well under the 400 KB Mantine `code-highlight` mis-import line.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';
import process from 'node:process';

const BUDGET_KB = 350;
const DIST_ASSETS = 'dist/assets';

function listAssets() {
  try {
    return readdirSync(DIST_ASSETS).filter((f) => f.endsWith('.js') || f.endsWith('.css'));
  } catch (err) {
    console.error(`Could not read ${DIST_ASSETS}: ${err.message}`);
    console.error('Run `npm run build` first.');
    process.exit(2);
  }
}

const files = listAssets();
let totalGz = 0;
const rows = [];

for (const name of files) {
  const path = join(DIST_ASSETS, name);
  const raw = readFileSync(path);
  const gz = gzipSync(raw).byteLength;
  totalGz += gz;
  rows.push({ name, raw: raw.byteLength, gz });
}

rows.sort((a, b) => b.gz - a.gz);

console.log('Bundle budget check (DEC-005):');
console.log(`  Budget:       ${BUDGET_KB} KB gzipped`);
console.log('  Per file:');
for (const r of rows) {
  const rawKb = (r.raw / 1024).toFixed(1).padStart(7);
  const gzKb = (r.gz / 1024).toFixed(1).padStart(6);
  console.log(`    ${rawKb} KB raw / ${gzKb} KB gz   ${r.name}`);
}

const totalKb = totalGz / 1024;
const budgetBytes = BUDGET_KB * 1024;
console.log(`  Total:        ${totalKb.toFixed(1)} KB gz`);

if (totalGz > budgetBytes) {
  const overage = ((totalGz - budgetBytes) / 1024).toFixed(1);
  console.error(`\n❌ Bundle exceeds budget by ${overage} KB gzipped.`);
  console.error(`   Either trim deps, switch to a lighter alternative, or`);
  console.error(`   raise BUDGET_KB in scripts/bundle-budget.mjs with a`);
  console.error(`   justification appended to maintainer/decisions.md DEC-005.`);
  process.exit(1);
}

const headroomKb = ((budgetBytes - totalGz) / 1024).toFixed(1);
console.log(`  Headroom:     ${headroomKb} KB gz`);
console.log('\n✅ Bundle within budget.');
