// WB-1 unit fixtures: parser, evaluator (20 fns), CSV round-trip, cycle
// detection, finite-gate, CSV-injection sanitization, digest stability.
// Zero-dep: run directly with `node chaingraph/workbook/workbook.test.mjs`.

import {
  WorkbookError, createWorkbook, setCell, recalc, parseFormula,
  parseCSV, serializeCSV, csvToWorkbook, workbookToCSV,
  rangeDigest, csvDigest, WORKBOOK_FUNCTIONS,
  exportArtifact, detectVolatileFormulas, VOLATILE_FUNCTION_NAMES,
} from './workbook.mjs';
import { executionHash } from '../kernels/_hash.mjs';

let failures = 0;
const ok = (cond, msg) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`); if (!cond) failures++; };
const eq = (actual, expected, msg) => ok(actual === expected || (Number.isNaN(actual) && Number.isNaN(expected)), `${msg} (got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)})`);

function wbWith(cellMap) {
  const wb = createWorkbook();
  for (const [ref, raw] of Object.entries(cellMap)) setCell(wb, ref, raw);
  recalc(wb);
  return wb;
}
const v = (wb, ref) => wb.cells[ref]?.value;

console.log('— WB-1: headless workbook core —\n');

// ── 1. tokenizer / parser ────────────────────────────────────────────────
ok(parseFormula('1+2').type === 'binop', 'parses a binary expression');
ok((() => { try { parseFormula('1+'); return false; } catch (e) { return e instanceof WorkbookError && e.code === '#PARSE!'; } })(), 'rejects a truncated formula (#PARSE!)');
ok((() => { try { parseFormula('"unterminated'); return false; } catch (e) { return e.code === '#PARSE!'; } })(), 'rejects an unterminated string literal');
eq(WORKBOOK_FUNCTIONS.length, 20, 'exactly 20 built-in functions');

// ── 2. evaluator: literals, refs, operators ─────────────────────────────
{
  const wb = wbWith({ A1: '2', A2: '3', A3: '=A1+A2*2', A4: '=(A1+A2)*2', A5: '="a"&"b"', A6: '=A1<A2' });
  eq(v(wb, 'A3'), 8, 'operator precedence: * before +');
  eq(v(wb, 'A4'), 10, 'parens override precedence');
  eq(v(wb, 'A5'), 'ab', '& concatenates strings');
  eq(v(wb, 'A6'), true, '< comparison');
}

// ── 3. all 20 functions ──────────────────────────────────────────────────
{
  const wb = wbWith({
    A1: '1', A2: '2', A3: '3', A4: 'x', A5: '5',
    SUM1: '=SUM(A1:A3)', AVG1: '=AVG(A1:A3)', MIN1: '=MIN(A1:A3)', MAX1: '=MAX(A1:A3)',
    CNT1: '=COUNT(A1:A5)', CIF1: '=COUNTIF(A1:A3,">1")',
    IF1: '=IF(A1<A2,"lo","hi")', AND1: '=AND(TRUE,A1<A2)', OR1: '=OR(FALSE,A1>A2)', NOT1: '=NOT(FALSE)',
    RND1: '=ROUND(3.14159,2)', ABS1: '=ABS(-5)',
    CAT1: '=CONCAT("a","b","c")', LEN1: '=LEN("hello")', LEFT1: '=LEFT("hello",2)', RIGHT1: '=RIGHT("hello",2)',
    TRIM1: '=TRIM("  a  b  ")', UP1: '=UPPER("abc")', LOW1: '=LOWER("ABC")',
    SIF1: '=SUMIF(A1:A3,">1")',
  });
  eq(v(wb, 'SUM1'), 6, 'SUM');
  eq(v(wb, 'AVG1'), 2, 'AVG');
  eq(v(wb, 'MIN1'), 1, 'MIN');
  eq(v(wb, 'MAX1'), 3, 'MAX');
  eq(v(wb, 'CNT1'), 4, 'COUNT ignores non-numeric cell');
  eq(v(wb, 'CIF1'), 2, 'COUNTIF with ">1" criteria');
  eq(v(wb, 'IF1'), 'lo', 'IF');
  eq(v(wb, 'AND1'), true, 'AND');
  eq(v(wb, 'OR1'), false, 'OR');
  eq(v(wb, 'NOT1'), true, 'NOT');
  eq(v(wb, 'RND1'), 3.14, 'ROUND');
  eq(v(wb, 'ABS1'), 5, 'ABS');
  eq(v(wb, 'CAT1'), 'abc', 'CONCAT');
  eq(v(wb, 'LEN1'), 5, 'LEN');
  eq(v(wb, 'LEFT1'), 'he', 'LEFT');
  eq(v(wb, 'RIGHT1'), 'lo', 'RIGHT');
  eq(v(wb, 'TRIM1'), 'a b', 'TRIM collapses interior whitespace');
  eq(v(wb, 'UP1'), 'ABC', 'UPPER');
  eq(v(wb, 'LOW1'), 'abc', 'LOWER');
  eq(v(wb, 'SIF1'), 5, 'SUMIF (2+3, values >1)');
}

// ── 4. cycle detection ────────────────────────────────────────────────────
{
  const wb = wbWith({ A1: '=B1+1', B1: '=A1+1' });
  eq(v(wb, 'A1'), '#CYCLE!', 'direct cycle A1<->B1 flags A1');
  eq(v(wb, 'B1'), '#CYCLE!', 'direct cycle A1<->B1 flags B1');
  const wb3 = wbWith({ A1: '=B1', B1: '=C1', C1: '=A1' });
  eq(v(wb3, 'A1'), '#CYCLE!', '3-cell cycle A1->B1->C1->A1');
}

// ── 5. finite gate: NaN/Infinity never propagate as live numbers ─────────
{
  const wb = wbWith({ A1: '1', A2: '0', A3: '=A1/A2', A4: '=10^400', A5: '=A4+1' });
  eq(v(wb, 'A3'), '#DIV/0!', 'division by zero is #DIV/0!, not Infinity');
  eq(v(wb, 'A4'), '#NUM!', 'overflow to Infinity becomes #NUM!');
  eq(v(wb, 'A5'), '#NUM!', '#NUM! propagates through downstream formulas as an error, not NaN');
}

// ── 6. strict RFC 4180 CSV round-trip ─────────────────────────────────────
{
  const csv = 'a,"b,c","d""e",\r\nline2,"multi\nline",f,\r\n';
  const rows = parseCSV(csv);
  eq(rows.length, 2, 'CSV parses 2 rows');
  eq(rows[0][1], 'b,c', 'embedded comma inside quotes preserved');
  eq(rows[0][2], 'd"e', 'doubled quote unescapes to one quote');
  eq(rows[1][1], 'multi\nline', 'embedded newline inside quotes preserved');
  const back = serializeCSV(rows);
  const rows2 = parseCSV(back);
  eq(JSON.stringify(rows2), JSON.stringify(rows), 'parse -> serialize -> parse round-trips exactly');
}
ok((() => { try { parseCSV('a,"unterminated'); return false; } catch (e) { return e.code === '#PARSE!'; } })(), 'rejects an unterminated quoted CSV field');
ok((() => { try { parseCSV('a"b,c'); return false; } catch (e) { return e.code === '#PARSE!'; } })(), 'rejects a stray quote inside an unquoted field');

// ── 7. CSV injection sanitization (OWASP) ─────────────────────────────────
{
  const out = serializeCSV([['=cmd|calc!A0', '+1+1', '-2', '@SUM(1,1)', 'plain']]);
  ok(out.startsWith('"\'=cmd|calc!A0"'), '"=..." formula cell is prefixed with a quote and quoted on export');
  ok(out.includes(`"'+1+1"`), '"+..." cell is prefixed');
  ok(out.includes(`"'-2"`), '"-..." cell is prefixed');
  ok(out.includes(`"'@SUM(1,1)"`), '"@..." cell is prefixed');
  ok(out.includes(',plain\r\n'), 'a benign cell is left unprefixed and unquoted');
}

// ── 8. digest stability: same CSV -> same hash, across independent calls ──
{
  const csvText = 'name,qty\r\nwidget,3\r\ngadget,7\r\n';
  const d1 = await csvDigest(csvText);
  const d2 = await csvDigest(csvText);
  eq(d1, d2, 'csvDigest is stable across independent calls on identical input');
  ok(/^[0-9a-f]{64}$/.test(d1), 'digest is a 64-hex-char sha256');
  const wb = csvToWorkbook(csvText);
  const rd = await rangeDigest(wb, 'A1:B3');
  eq(rd, d1, 'rangeDigest over the full range matches csvDigest');
  const dChanged = await csvDigest('name,qty\r\nwidget,4\r\ngadget,7\r\n');
  ok(dChanged !== d1, 'changing one value changes the digest');
}
ok((() => { try { workbookToCSV; return true; } catch { return false; } })(), 'workbookToCSV is exported');

// ── 9. WB-BRIDGE-1: exportArtifact() §15 fixtures ──────────────────────────
// (a) determinism: build -> export, edit a cell, undo the edit (set it back),
// export again -> execution_hash must be byte-identical (no wall-clock or
// caller-identity leakage into the hash preimage).
{
  const wb = wbWith({ A1: '10', A2: '20', A3: '=A1+A2', B1: 'widget', B2: 'gadget' });
  const before = await exportArtifact(wb, { source_description: 'unit test sheet', created_by: 'tester' });
  setCell(wb, 'A1', '999'); // edit
  recalc(wb);
  setCell(wb, 'A1', '10'); // undo
  recalc(wb);
  // re-export with a DIFFERENT meta (different timestamp/created_by) to prove
  // provenance never perturbs the hash.
  const after = await exportArtifact(wb, { source_description: 'unit test sheet, re-exported', created_by: 'someone-else' });
  eq(after.execution_hash, before.execution_hash, 'edit-then-undo re-export has a byte-identical execution_hash');
  ok(before.generated_at !== undefined && after.generated_at !== undefined, 'generated_at is present on both exports');
  ok(/^[0-9a-f]{64}$/.test(before.execution_hash), 'execution_hash is a 64-hex-char sha256');
}

// (b) envelope schema validation: required OCG v0.4-shaped fields present.
{
  const wb = wbWith({ A1: '1', A2: '2', A3: '=A1+A2' });
  const artifact = await exportArtifact(wb, { source_description: 'schema test', created_by: 'tester', extract_params: { rows: 1 } });
  ok(typeof artifact.execution_hash === 'string', 'artifact has execution_hash');
  ok(artifact.policy_parameters && typeof artifact.policy_parameters === 'object', 'artifact has policy_parameters');
  ok(artifact.output_payload && typeof artifact.output_payload === 'object', 'artifact has output_payload');
  ok(Array.isArray(artifact.output_payload.values), 'output_payload.values is an array');
  ok(Array.isArray(artifact.output_payload.row_digests), 'output_payload.row_digests is an array');
  ok(Array.isArray(artifact.output_payload.col_digests), 'output_payload.col_digests is an array');
  ok(typeof artifact.output_payload.total_digest === 'string', 'output_payload.total_digest is a string');
  ok(artifact.output_payload.deterministic === true, 'no volatile functions -> deterministic:true');
  ok(artifact.provenance && artifact.provenance.source_description === 'schema test', 'provenance.source_description round-trips');
  ok(artifact.provenance.created_by === 'tester', 'provenance.created_by round-trips');
  ok(typeof artifact.provenance.timestamp === 'string', 'provenance.timestamp is present');
  ok(artifact.chain && Array.isArray(artifact.chain.parent_hashes), 'artifact.chain.parent_hashes is an array');
  ok(artifact.audit_signature && Array.isArray(artifact.audit_signature.signatures), 'audit_signature.signatures scaffold present');
  eq(artifact.chaingraph_version, '0.4.0', 'chaingraph_version is 0.4.0');
}

// (c) round-trip via the verify kernel path: recompute execution_hash from
// {policy_parameters, output_payload} using the SAME _hash.mjs executionHash()
// chaingraph/verify.html uses (verify.html inlines the identical cgCanon/
// executionHash implementation -- see chaingraph/kernels/_hash.mjs header) and
// assert it matches the stored hash, exactly what the verifier does.
{
  const wb = wbWith({ A1: '3', A2: '4', A3: '=A1*A2' });
  const artifact = await exportArtifact(wb, { source_description: 'verify round-trip' });
  const recomputed = await executionHash(artifact.policy_parameters, artifact.output_payload);
  eq(recomputed, artifact.execution_hash, 'artifact verifies: recomputed hash matches stored execution_hash (verify.html path)');
  // tamper -> must fail, proving the check is meaningful, not a tautology.
  const tampered = JSON.parse(JSON.stringify(artifact));
  tampered.output_payload.values[0][0] = 'TAMPERED';
  const tamperedHash = await executionHash(tampered.policy_parameters, tampered.output_payload);
  ok(tamperedHash !== artifact.execution_hash, 'tampering output_payload changes the recomputed hash (verifier would report MISMATCH)');
}

// ── 10. volatile-function flag (kill-criterion: never a silently wrong hash) ─
{
  eq(VOLATILE_FUNCTION_NAMES.length, 3, 'RAND/NOW/TODAY are the tracked volatile function names');
  const wb = wbWith({ A1: '=RAND()', A2: '1' });
  const hits = detectVolatileFormulas(wb);
  eq(hits.length, 1, 'RAND( in raw formula text is flagged');
  eq(hits[0], 'A1', 'flagged cell ref is A1');
  const artifact = await exportArtifact(wb);
  eq(artifact.output_payload.deterministic, false, 'exportArtifact marks deterministic:false when a volatile function is present');
  eq(JSON.stringify(artifact.output_payload.volatile_cells), JSON.stringify(['A1']), 'exportArtifact echoes the flagged cell(s), never silently swallowing them');
  // the engine has no RAND() implementation at all -- it resolves to a stable
  // #NAME? error code, so this is an honest flag on an otherwise-stable value,
  // never a silently wrong hash.
  eq(v(wb, 'A1'), '#NAME?', 'RAND() is not an implemented function -> deterministic #NAME? error, not a live random number');
}

console.log(`\n${failures === 0 ? '✅ ALL CHECKS PASSED' : `❌ ${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
