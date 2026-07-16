// standards-vectors.test.mjs — STDVEC-1 (GATES-SHIFTLEFT-BUILD-SPEC.md §2).
//
// WHY: kernel determinism gates prove outputs are STABLE, not CORRECT. A wrong
// check-digit implementation is stably wrong and passes every gate this repo had
// before this one. This gate replays known-good and known-bad standards vectors
// (fixtures/standards-vectors.json, each with a citation to the publishing
// authority) against hand-rolled, zero-dep validators for IBAN, LEI, BIC, UETR,
// and NACHA/ABA routing numbers.
//
// Zero-dep per CLAUDE.md (site repo carries no package.json, ever). Deliberately
// excludes ISO 20022 full-schema validation (needs an XSD engine → a dependency).
//
// Usage: node scripts/standards-vectors.test.mjs

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fixtures = JSON.parse(readFileSync(resolve(REPO, 'scripts/fixtures/standards-vectors.json'), 'utf8'));

// ISO 13616 IBAN: move first 4 chars to end, letters→numbers (A=10..Z=35), mod 97 must be 1.
function ibanValid(raw) {
  const iban = String(raw).replace(/\s+/g, '').toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  const numeric = rearranged.replace(/[A-Z]/g, c => (c.charCodeAt(0) - 55).toString());
  return BigInt(numeric) % 97n === 1n;
}

// ISO 17442 LEI: 18 alnum + 2 check digits; check per ISO/IEC 7064 MOD 97-10 over all 20 chars.
function leiValid(raw) {
  const lei = String(raw).toUpperCase();
  if (!/^[A-Z0-9]{18}\d{2}$/.test(lei)) return false;
  const numeric = lei.replace(/[A-Z]/g, c => (c.charCodeAt(0) - 55).toString());
  return BigInt(numeric) % 97n === 1n;
}

// ISO 9362 BIC: 4 bank letters + 2 country letters + 2 alnum location + optional 3 alnum branch.
function bicValid(raw) {
  return /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(String(raw).toUpperCase());
}

// SWIFT gpi UETR = RFC 4122 UUIDv4.
function uetrValid(raw) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(raw));
}

// ABA/NACHA routing transit number: weighted checksum, weights 3,7,1 repeating over 9 digits.
function nachaRoutingValid(raw) {
  const rn = String(raw);
  if (!/^\d{9}$/.test(rn)) return false;
  const d = [...rn].map(Number);
  const sum = 3 * (d[0] + d[3] + d[6]) + 7 * (d[1] + d[4] + d[7]) + 1 * (d[2] + d[5] + d[8]);
  return sum % 10 === 0;
}

const VALIDATORS = {
  iban: ibanValid,
  lei: leiValid,
  bic: bicValid,
  uetr: uetrValid,
  nacha_routing: nachaRoutingValid,
};

let pass = 0, fail = 0;
for (const [family, validator] of Object.entries(VALIDATORS)) {
  const spec = fixtures[family];
  if (!spec) {
    console.error(`X ${family}: no fixtures found`);
    fail++;
    continue;
  }
  let hasPositive = false, hasNegative = false;
  for (const vec of spec.vectors) {
    const got = validator(vec.input);
    if (vec.valid) hasPositive = true; else hasNegative = true;
    if (got === vec.valid) {
      pass++;
    } else {
      console.error(`X ${family} "${vec.input}": expected valid=${vec.valid}, got valid=${got} (${vec.note})`);
      fail++;
    }
  }
  if (!hasPositive || !hasNegative) {
    console.error(`X ${family}: fixtures must include both positive and negative vectors`);
    fail++;
  }
}

const total = pass + fail;
if (fail) {
  console.error(`\nstandards-vectors FAILED — ${fail}/${total} check(s) failed.`);
  process.exit(1);
}
console.log(`standards-vectors OK — ${total} vectors across ${Object.keys(VALIDATORS).length} standards families, all matched expected verdict.`);
