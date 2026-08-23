// check-cross-surface.test.mjs — XSURF-CHECKER-1 self-tests.
//
// Hermetic: every assertion runs against an inline fixture. No estate read, no
// network, no clock, so this can never flake and never turns red because the
// estate moved. The estate-level RED proofs live in the row's PR body (mutation
// of a real kernel/page/shard); this file is what keeps the DETECTOR's own
// logic from silently rotting — SO #34's "verify a checker by mutation, not by
// reading it", applied to the parts a fixture can drive.
//
// Run:  node scripts/check-cross-surface.test.mjs
import {
  commentRanges,
  stringAssignments,
  scriptBodies,
  objectLiteralBlock,
  metaMcpName,
  normalizeValue,
  flagGhostTokens,
  ratchet,
} from './check-cross-surface.mjs';

let fail = 0;
const ok = (c, m) => { if (!c) { fail++; console.error(`  ✗ ${m}`); } else console.log(`  ✓ ${m}`); };
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), `${m} — got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`);

// ---------------------------------------------------------------------------
console.log('comment masking (a key named in a comment must contribute NOTHING)');
// ---------------------------------------------------------------------------
eq(stringAssignments(`// table_version: 'GHOST'\nconst x = { table_version: 'REAL' };`, 'table_version'), ['REAL'],
  'line comment mentioning the key is ignored');
eq(stringAssignments(`/* table_version: 'GHOST' */ const x = { table_version: 'REAL' };`, 'table_version'), ['REAL'],
  'block comment mentioning the key is ignored');
// The exact shape that would break a naive comment stripper: "//" inside a URL
// string literal. If the scanner mistook that for a comment start it would eat
// the rest of the line and lose the assignment that follows.
eq(stringAssignments(`const u = 'https://ainumbers.co/x'; const y = { table_source: 'REAL' };`, 'table_source'), ['REAL'],
  '"//" inside a URL string literal is not treated as a comment');
// A regex literal containing a quote character must not flip the scanner into
// string state and swallow the rest of the file.
eq(stringAssignments(`const re = /['"]/g; const y = { mcp_name: 'REAL' };`, 'mcp_name'), ['REAL'],
  'a regex literal containing quote characters does not desynchronise the scanner');
ok(commentRanges(`const u = 'a // b';`).length === 0, 'no comment ranges reported inside a string literal');

// ---------------------------------------------------------------------------
console.log('string-literal extraction');
// ---------------------------------------------------------------------------
eq(stringAssignments(`x = { regulatory_basis: "A" + " B" };`, 'regulatory_basis'), ['A B'],
  '"+"-concatenated adjacent literals are joined');
eq(stringAssignments("x = { regulatory_basis: 'it\\'s A' };", 'regulatory_basis'), ["it's A"],
  'escaped quotes inside a literal are decoded');
eq(stringAssignments('const TOOL_VERSION = "1.0.0";', 'TOOL_VERSION'), ['1.0.0'],
  '"=" assignment form is read, not just "key:"');
eq(stringAssignments(`x = { spec_version: 'S', chaingraph_version: 'C', version: 'V' };`, 'version'), ['V'],
  'bare "version" never matches spec_version / chaingraph_version');
eq(stringAssignments(`x = { table_version: SOME_CONST };`, 'table_version'), [],
  'a non-literal value contributes nothing (identifiers are not guessed)');

// ---------------------------------------------------------------------------
console.log('declaration-site scoping (fixtures must not masquerade as identity)');
// ---------------------------------------------------------------------------
const pageLike = `
  var MANIFEST = { tool_id: 't', version: '1.0.0', mcp_name: 'real_name' };
  var FIXTURE  = { version: 'not-semver', mcp_name: 'fixture_name' };
`;
eq(stringAssignments(objectLiteralBlock(pageLike, 'MANIFEST'), 'version'), ['1.0.0'],
  'MANIFEST-scoped lookup ignores a fixture object carrying its own version');
eq(stringAssignments(objectLiteralBlock(pageLike, 'MANIFEST'), 'mcp_name'), ['real_name'],
  'MANIFEST-scoped lookup ignores a fixture object carrying its own mcp_name');
ok(objectLiteralBlock(pageLike, 'NOPE') === null, 'a missing declaration site returns null, not an empty block');
eq(metaMcpName(`export const meta = { tool_id: 't', mcp_name: 'from_meta' };`), 'from_meta',
  'metaMcpName reads the kernel meta block');
ok(metaMcpName(`export const other = { mcp_name: 'x' };`) === null,
  'metaMcpName returns null when there is no meta block (absence is a distinct state)');
eq(scriptBodies('<p>table_version: "PROSE"</p><script>var a = 1;</script><script>var b = 2;</script>'),
  'var a = 1;\n;\nvar b = 2;', 'scriptBodies takes only <script> bodies — visible prose is display, not payload');

// ---------------------------------------------------------------------------
console.log('normalization — the stated rules, and the lines they must NOT cross');
// ---------------------------------------------------------------------------
ok(normalizeValue('A,  B') === normalizeValue('A B'), 'commas and whitespace runs are insignificant');
ok(normalizeValue('32 CFR § 232.4') === normalizeValue('32 cfr §232.4'), 'section-sign spacing and case are insignificant');
ok(normalizeValue('effective Oct 3, 2016.') === normalizeValue('Effective Oct 3 2016'), 'a sentence-final period is insignificant');
ok(normalizeValue('a — b') === normalizeValue('a - b'), 'dash variants unify');
ok(normalizeValue('it’s') === normalizeValue("it's"), 'curly quotes unify');
// The load-bearing negatives: a normalization that erased these would be a
// silent waiver of exactly the drift this leg exists to catch.
ok(normalizeValue('§232.4') !== normalizeValue('§23.24'), 'decimal/citation periods are PRESERVED — §232.4 never collides with §23.24');
ok(normalizeValue('1.0.0') !== normalizeValue('1.0.1'), 'version digits are significant');
ok(normalizeValue('§1005.31') !== normalizeValue('1005.31'), 'the section sign itself is significant');
ok(normalizeValue('loss_cost × lcm') !== normalizeValue('loss_cost x lcm'), 'a multiplication sign is not silently folded to the letter x');
ok(normalizeValue('A; B') !== normalizeValue('A B'), 'semicolons are significant');

// ---------------------------------------------------------------------------
console.log('leg (c) flag-ghost lint');
// ---------------------------------------------------------------------------
eq(flagGhostTokens('Flags MAPR_EXCEEDS_CAP_VIOLATION when MAPR > 36%.', 'push("MLA_MAPR_EXCEEDS_36PCT_CAP")'),
  ['MAPR_EXCEEDS_CAP_VIOLATION'], 'a described flag the kernel never emits is a ghost');
eq(flagGhostTokens('Flags MLA_MAPR_EXCEEDS_36PCT_CAP.', 'push("MLA_MAPR_EXCEEDS_36PCT_CAP")'), [],
  'a described flag that exists in the kernel source is clean');
// The whole reason the token pattern REQUIRES an underscore: a lint that flags
// bare acronyms is a lint that gets baselined into uselessness.
eq(flagGhostTokens('Uses the MCP API over HTTPS per the CFR and USC, per SEC and FATF guidance.', ''), [],
  'bare prose acronyms (API, HTTPS, CFR, USC, SEC, FATF) are never flagged');
eq(flagGhostTokens('Emits per ISO_20022 and RFC_8785.', ''), [],
  'whitelisted standards identifiers are exempt');

// ---------------------------------------------------------------------------
console.log('baseline ratchet — both directions');
// ---------------------------------------------------------------------------
{
  const { failures, improvements } = ratchet({ n1: 3 }, { n1: 2 }, 'L');
  ok(failures.length === 1 && improvements.length === 0, 'over baseline FAILS');
}
{
  const { failures, improvements } = ratchet({ n1: 1 }, { n1: 2 }, 'L');
  ok(failures.length === 0 && improvements.length === 1, 'under baseline is an improvement, not a failure');
}
{
  const { failures } = ratchet({ n2: 1 }, { n1: 2 }, 'L');
  ok(failures.length === 1, 'a node absent from the baseline gets zero tolerance');
}
{
  const { failures, improvements } = ratchet({}, { n1: 2 }, 'L');
  ok(failures.length === 0 && improvements.length === 1, 'a baselined node that went clean reports a droppable entry');
}
{
  const { failures, improvements } = ratchet({ n1: 2 }, { n1: 2 }, 'L');
  ok(failures.length === 0 && improvements.length === 0, 'at baseline is silent');
}

console.log(fail ? `\ncross-surface self-tests: ${fail} FAILURE(s)` : '\ncross-surface self-tests: OK');
process.exit(fail ? 1 : 0);
