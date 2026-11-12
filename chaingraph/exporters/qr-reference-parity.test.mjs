// qr-reference-parity.test.mjs - standalone entry for the QR reference-parity check.
// Fails (exit 1) when any reference vector's matrix differs from what qr.mjs produces, when
// a vector the reference refuses is accepted, or when the fixture stops covering every
// QR version from 1 to 40 (a silently shrunken corpus must not read as a pass).
// Node 18+. Run: node chaingraph/exporters/qr-reference-parity.test.mjs
import { runQrReferenceParity } from './qr-reference-parity.mjs';

const r = runQrReferenceParity();
const missing = [];
for (let v = 1; v <= 40; v++) if (!r.versions.includes(v)) missing.push(v);

for (const f of r.failures) console.error('  ✗ ' + f);
if (missing.length) console.error('  ✗ fixture no longer covers version(s): ' + missing.join(', '));
console.log(`qr reference parity: ${r.matched} matrices identical, ${r.refused} refusals agreed, ` +
  `${r.failures.length} failure(s), ${r.total} vectors, versions ${r.versions[0]}-${r.versions[r.versions.length - 1]}`);
process.exit(r.failures.length || missing.length ? 1 : 0);
