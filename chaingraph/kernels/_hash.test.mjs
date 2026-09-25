// _hash.test.mjs — gate for the two canonicalizer defects fixed by HASH-PROTO-DEPTH-GUARD-1.
//
// A1 (own-property canonicalization): a JSON member literally named "__proto__" is an ordinary
// member under RFC 8785 §3.2.3. The old accumulator (`{}`) turned that assignment into a
// prototype set, so the key and its whole subtree vanished from the preimage and three payloads
// differing only there hashed identically — the receipt did not bind that content.
//
// A2 (structural limits): assertIJson/cgCanon recursed unbounded, so ~10 KB nested 5 000 deep
// threw a bare `RangeError: Maximum call stack size exceeded`, far below the worker's
// MAX_REQUEST_BODY_BYTES. Over MAX_DEPTH the refusal is now a named HashLimitError.
//
// A3 control: a normal payload's preimage and a pinned golden hash are byte-unchanged, so the
// fix cannot have moved any existing execution_hash.
//
// Node 18+ (WebCrypto + node: builtins only — zero npm deps).
// Run:  node chaingraph/kernels/_hash.test.mjs
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cgCanon, canonicalPreimage, executionHash, assertIJson, HashLimitError, MAX_DEPTH } from './_hash.mjs';

let fail = 0;
const ok = (c, m) => { if (!c) { fail++; console.error('  ✗ ' + m); } else console.log('  ✓ ' + m); };

// ---- A1: "__proto__" survives canonicalization as an own member ------------------------------
// Parsed from JSON text on purpose: only JSON.parse produces an OWN key with this name, which is
// exactly the shape a worker request or a fixture carries.
const a = JSON.parse('{"clerks":3,"__proto__":{"gap_bp":900}}');
const b = JSON.parse('{"clerks":3,"__proto__":{"gap_bp":100}}');
const c = JSON.parse('{"clerks":3}');

const ha = await executionHash({}, a);
const hb = await executionHash({}, b);
const hc = await executionHash({}, c);

ok(ha !== hb, 'two payloads differing only under "__proto__" hash DIFFERENTLY');
ok(ha !== hc, 'a payload carrying "__proto__" hashes differently from one omitting it');
ok(hb !== hc, 'the second "__proto__" payload also differs from the omitting one (pairwise distinct)');

ok(JSON.stringify(Object.keys(cgCanon(a))) === '["__proto__","clerks"]',
   'canon keys are ["__proto__","clerks"] — an own enumerable member in sorted position');
ok(canonicalPreimage({}, a).includes('"__proto__":{"gap_bp":900}'),
   'the preimage string carries "__proto__":{"gap_bp":900} (the subtree is bound, not dropped)');

// Non-vacuity: the member must really be an own key of the INPUT, or the assertions above would
// be testing a payload that never had it.
ok(Object.prototype.hasOwnProperty.call(a, '__proto__'), 'control: the parsed input really has "__proto__" as an OWN key');

// ---- A2: named limit error instead of a stack overflow ---------------------------------------
const deep = (n) => { let v = []; for (let i = 0; i < n; i++) v = [v]; return v; };

let shallowHash = null;
try { shallowHash = await executionHash({}, deep(500)); } catch (e) { fail++; console.error('  ✗ depth 500 threw ' + e.name + ': ' + e.message); }
ok(typeof shallowHash === 'string' && shallowHash.length === 64, 'depth 500 still hashes normally (the limit does not bite real payloads)');

let thrown = null;
try { await executionHash({}, deep(5000)); } catch (e) { thrown = e; }
ok(thrown instanceof HashLimitError, 'depth 5 000 throws HashLimitError');
ok(thrown && thrown.name === 'HashLimitError', 'the thrown error is NAMED HashLimitError (not a bare RangeError)');
ok(thrown && !(thrown instanceof RangeError), 'the thrown error is NOT a RangeError (no stack overflow reaches the caller)');
ok(thrown && String(thrown.message).includes(String(MAX_DEPTH)), 'the message names the limit hit (MAX_DEPTH ' + MAX_DEPTH + ')');

// The limit is on the shared validator too, not only on the executionHash path.
let assertThrew = null;
try { assertIJson(deep(5000)); } catch (e) { assertThrew = e; }
ok(assertThrew instanceof HashLimitError, 'assertIJson() itself refuses the over-deep input with HashLimitError');

// The I-JSON refusals are unchanged and still NOT HashLimitError.
let nonFinite = null;
try { assertIJson({ x: Infinity }); } catch (e) { nonFinite = e; }
ok(nonFinite instanceof Error && !(nonFinite instanceof HashLimitError), 'a non-finite number still fails the original I-JSON refusal (RFC 8785 §3.2.2.3), not the limit');

// ---- A3 control: nothing that hashes today moves ---------------------------------------------
ok(canonicalPreimage({ b: 1, a: { d: 2, c: [3, { f: 4, e: 5 }] } }, { z: 'y' })
   === '{"output_payload":{"z":"y"},"policy_parameters":{"a":{"c":[3,{"e":5,"f":4}],"d":2},"b":1}}',
   'a normal nested payload canonicalizes to the same byte string as before (sorted keys, array order kept)');

const HERE = dirname(fileURLToPath(import.meta.url));
const vec = JSON.parse(readFileSync(resolve(HERE, 'fixtures', 'art-335-compute-dti-ratios.fixtures.json'), 'utf8')).vectors[0];
ok(await executionHash(vec.policy_parameters, vec.output_payload) === vec.golden_hash,
   'a pinned golden fixture still recomputes to its golden_hash (no existing hash moved)');

console.log(fail ? `\n${fail} failure(s).` : '\nAll _hash.mjs canonicalizer checks passed.');
process.exit(fail ? 1 : 0);
