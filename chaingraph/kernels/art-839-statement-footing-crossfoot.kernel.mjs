import { executionHash } from './_hash.mjs';

// art-839-statement-footing-crossfoot — foots and cross-foots declared financial statement lines and ties
// declared note amounts to declared statement lines, flagging every break. Integer minor units only
// (BigInt inside, safe-integer Numbers out). It checks arithmetic and references among declared values. It
// does not read a document, does not verify that the figures are the real ones, and is not an audit
// procedure on its own. Ids and integers only: free-text labels, names and account-number lookalikes are
// refused, never read.
//
// DETERMINISM: compute() is a pure function of pp (no clock, no randomness, no I/O, no TextEncoder).

const TOOL_ID = 'art-839-statement-footing-crossfoot';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'check_statement_footing_crossfoot',
  mandate_type: 'compliance_control', gpu: false,
};

const MAX_MINOR = 10000000000000n; // 1e13: with 200 members a sum stays a safe integer
const MAX_COLUMNS = 8;
const MAX_LINES = 200;
const MAX_RELATIONS = 200;
const MAX_MEMBERS = 200;
const ID_RE = /^[a-z0-9][a-z0-9_-]{0,31}$/;
const ACCOUNT_RUN_RE = /[0-9]{8,}/;
const IBAN_LIKE_RE = /^[a-z]{2}[0-9]{2}[a-z0-9_-]{10,}$/;
const ROLES = ['detail', 'subtotal', 'total'];
const SIGN_CONVENTIONS = ['signed', 'magnitude'];

const TOP_KEYS = ['columns', 'lines', 'total_relations', 'crossfoot_relations', 'note_refs', 'tolerance_minor', 'sign_convention'];
const LINE_KEYS = ['line_id', 'section_id', 'role', 'amounts_minor'];
const TOTAL_REL_KEYS = ['total_line_id', 'members'];
const MEMBER_KEYS = ['line_id', 'sign'];
const CROSS_REL_KEYS = ['line_id', 'member_column_ids', 'total_column_id'];
const NOTE_KEYS = ['note_id', 'noted_amount_minor', 'line_id', 'column_id'];

// Integer parse: a safe-integer Number or a decimal-digit string. null when anything else.
function toInt(v) {
  if (typeof v === 'number') return Number.isSafeInteger(v) ? BigInt(v) : null;
  if (typeof v === 'string' && /^-?[0-9]{1,20}$/.test(v)) return BigInt(v);
  return null;
}

function isObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }

// Refusal scan: the first free-text field, name-shaped id or account-number lookalike, in a fixed walk
// order. Returns a code or null. Wrong-typed values are not refusals; validation flags them later.
function idRefusal(id) {
  if (typeof id !== 'string') return null;
  if (ACCOUNT_RUN_RE.test(id) || IBAN_LIKE_RE.test(id)) return 'ACCOUNT_NUMBER_LOOKALIKE_REFUSED';
  if (!ID_RE.test(id)) return 'ID_FORMAT_REFUSED';
  return null;
}

function keyRefusal(o, allowed) {
  if (!isObj(o)) return null;
  for (const k of Object.keys(o)) if (!allowed.includes(k)) return 'FREE_TEXT_FIELD_REFUSED';
  return null;
}

function arr(v) { return Array.isArray(v) ? v : []; }

function scanRefusal(pp) {
  let c = keyRefusal(pp, TOP_KEYS);
  if (c) return c;
  for (const id of arr(pp.columns)) { c = idRefusal(id); if (c) return c; }
  for (const l of arr(pp.lines)) {
    c = keyRefusal(l, LINE_KEYS); if (c) return c;
    if (isObj(l)) {
      c = idRefusal(l.line_id) || idRefusal(l.section_id); if (c) return c;
    }
  }
  for (const r of arr(pp.total_relations)) {
    c = keyRefusal(r, TOTAL_REL_KEYS); if (c) return c;
    if (isObj(r)) {
      c = idRefusal(r.total_line_id); if (c) return c;
      for (const m of arr(r.members)) {
        c = keyRefusal(m, MEMBER_KEYS); if (c) return c;
        if (isObj(m)) { c = idRefusal(m.line_id); if (c) return c; }
      }
    }
  }
  for (const r of arr(pp.crossfoot_relations)) {
    c = keyRefusal(r, CROSS_REL_KEYS); if (c) return c;
    if (isObj(r)) {
      c = idRefusal(r.line_id) || idRefusal(r.total_column_id); if (c) return c;
      for (const id of arr(r.member_column_ids)) { c = idRefusal(id); if (c) return c; }
    }
  }
  for (const n of arr(pp.note_refs)) {
    c = keyRefusal(n, NOTE_KEYS); if (c) return c;
    if (isObj(n)) { c = idRefusal(n.note_id) || idRefusal(n.line_id) || idRefusal(n.column_id); if (c) return c; }
  }
  return null;
}

function shell(verdict, refusalCode, pp, flags) {
  const output_payload = {
    verdict,
    refusal_code: refusalCode,
    sign_convention: SIGN_CONVENTIONS.includes(pp.sign_convention) ? pp.sign_convention : null,
    tolerance_minor: (() => { const t = toInt(pp.tolerance_minor); return t === null ? null : Number(t); })(),
    column_ids: [],
    footing_checked: 0,
    crossfoot_checked: 0,
    note_checked: 0,
    footing_breaks: [],
    crossfoot_breaks: [],
    note_breaks: [],
    unreferenced_lines: [],
    warnings: flags.slice(),
  };
  return { output_payload, compliance_flags: flags.slice() };
}

function absBig(x) { return x < 0n ? -x : x; }

/**
 * compute(pp): pure footing / cross-footing / note-tie kernel.
 * @param {object} pp policy_parameters
 * @returns {{ output_payload: object, compliance_flags: string[] }}
 */
export function compute(pp) {
  pp = isObj(pp) ? pp : {};

  const code = scanRefusal(pp);
  if (code) return shell('input_refused', code, pp, ['INPUT_REFUSED']);

  const flags = [];
  const add = (f) => { if (!flags.includes(f)) flags.push(f); };

  // ---- declared rules (required; never defaulted) ----
  const tol = toInt(pp.tolerance_minor);
  if (tol !== null && tol > MAX_MINOR) add('TOLERANCE_EXCEEDS_LIMIT');
  else if (tol === null || tol < 0n) add('TOLERANCE_INVALID_OR_MISSING');
  if (!SIGN_CONVENTIONS.includes(pp.sign_convention)) add('SIGN_CONVENTION_INVALID_OR_MISSING');
  const magnitude = pp.sign_convention === 'magnitude';

  // ---- columns ----
  const columns = pp.columns;
  const colIndex = new Map();
  if (!Array.isArray(columns) || columns.length === 0) add('COLUMNS_MISSING');
  else if (columns.length > MAX_COLUMNS) add('MAX_COLUMNS_EXCEEDED');
  else {
    for (const c of columns) {
      if (typeof c !== 'string') { add('COLUMN_ID_INVALID'); continue; }
      if (colIndex.has(c)) { add('DUPLICATE_COLUMN_ID'); continue; }
      colIndex.set(c, colIndex.size);
    }
  }

  // ---- lines ----
  const lines = new Map();
  if (!Array.isArray(pp.lines) || pp.lines.length === 0) add('LINES_MISSING');
  else if (pp.lines.length > MAX_LINES) add('MAX_LINES_EXCEEDED');
  else {
    for (const l of pp.lines) {
      if (!isObj(l) || typeof l.line_id !== 'string' || typeof l.section_id !== 'string') { add('LINE_FIELD_INVALID'); continue; }
      if (lines.has(l.line_id)) { add('DUPLICATE_LINE_ID'); continue; }
      if (!ROLES.includes(l.role)) add('LINE_ROLE_INVALID');
      const amts = [];
      if (!Array.isArray(l.amounts_minor) || l.amounts_minor.length !== colIndex.size) add('LINE_AMOUNTS_SHAPE_INVALID');
      else {
        for (const a of l.amounts_minor) {
          const v = toInt(a);
          if (v === null) { add('LINE_AMOUNT_INVALID'); amts.push(0n); continue; }
          if (absBig(v) > MAX_MINOR) { add('LINE_AMOUNT_EXCEEDS_LIMIT'); amts.push(0n); continue; }
          if (magnitude && v < 0n) add('NEGATIVE_AMOUNT_UNDER_MAGNITUDE_CONVENTION');
          amts.push(v);
        }
      }
      lines.set(l.line_id, { id: l.line_id, section: l.section_id, role: l.role, amts });
    }
  }

  // ---- relations: shape and referenced-id checks ----
  const refd = new Set(); // line ids referenced by any relation
  const totalRels = [];
  const seenTotals = new Set();
  if (pp.total_relations != null) {
    if (!Array.isArray(pp.total_relations) || pp.total_relations.length > MAX_RELATIONS) add('TOTAL_RELATIONS_INVALID');
    else {
      for (const r of pp.total_relations) {
        if (!isObj(r) || typeof r.total_line_id !== 'string' || !Array.isArray(r.members) || r.members.length === 0 || r.members.length > MAX_MEMBERS) { add('TOTAL_RELATION_INVALID'); continue; }
        if (seenTotals.has(r.total_line_id)) add('DUPLICATE_TOTAL_RELATION');
        seenTotals.add(r.total_line_id);
        const tl = lines.get(r.total_line_id);
        if (!tl) add('REFERENCED_ID_MISSING');
        else {
          refd.add(tl.id);
          if (tl.role === 'detail') add('TOTAL_LINE_ROLE_MISMATCH');
        }
        const members = [];
        const seenM = new Set();
        for (const m of r.members) {
          if (!isObj(m) || typeof m.line_id !== 'string' || (m.sign !== 1 && m.sign !== -1)) { add('MEMBER_INVALID'); continue; }
          if (seenM.has(m.line_id) || m.line_id === r.total_line_id) { add('MEMBER_DUPLICATE_OR_SELF'); continue; }
          seenM.add(m.line_id);
          const ml = lines.get(m.line_id);
          if (!ml) add('REFERENCED_ID_MISSING');
          else refd.add(ml.id);
          members.push({ id: m.line_id, sign: BigInt(m.sign) });
        }
        totalRels.push({ total: r.total_line_id, members });
      }
    }
  }

  const crossRels = [];
  if (pp.crossfoot_relations != null) {
    if (!Array.isArray(pp.crossfoot_relations) || pp.crossfoot_relations.length > MAX_RELATIONS) add('CROSSFOOT_RELATIONS_INVALID');
    else {
      for (const r of pp.crossfoot_relations) {
        if (!isObj(r) || typeof r.line_id !== 'string' || typeof r.total_column_id !== 'string' || !Array.isArray(r.member_column_ids) || r.member_column_ids.length === 0 || r.member_column_ids.length > MAX_COLUMNS) { add('CROSSFOOT_RELATION_INVALID'); continue; }
        const ln = lines.get(r.line_id);
        if (!ln) add('REFERENCED_ID_MISSING'); else refd.add(ln.id);
        if (!colIndex.has(r.total_column_id)) add('REFERENCED_ID_MISSING');
        const seenC = new Set();
        for (const c of r.member_column_ids) {
          if (typeof c !== 'string' || seenC.has(c) || c === r.total_column_id) { add('CROSSFOOT_MEMBER_INVALID'); continue; }
          seenC.add(c);
          if (!colIndex.has(c)) add('REFERENCED_ID_MISSING');
        }
        crossRels.push({ line: r.line_id, cols: r.member_column_ids, totalCol: r.total_column_id });
      }
    }
  }

  const noteRefs = [];
  const seenNotes = new Set();
  if (pp.note_refs != null) {
    if (!Array.isArray(pp.note_refs) || pp.note_refs.length > MAX_RELATIONS) add('NOTE_REFS_INVALID');
    else {
      for (const n of pp.note_refs) {
        if (!isObj(n) || typeof n.note_id !== 'string' || typeof n.line_id !== 'string' || typeof n.column_id !== 'string') { add('NOTE_REF_INVALID'); continue; }
        if (seenNotes.has(n.note_id)) add('DUPLICATE_NOTE_ID');
        seenNotes.add(n.note_id);
        const noted = toInt(n.noted_amount_minor);
        if (noted === null) add('NOTE_AMOUNT_INVALID');
        else if (absBig(noted) > MAX_MINOR) add('NOTE_AMOUNT_EXCEEDS_LIMIT');
        const ln = lines.get(n.line_id);
        if (!ln) add('REFERENCED_ID_MISSING'); else refd.add(ln.id);
        if (!colIndex.has(n.column_id)) add('REFERENCED_ID_MISSING');
        noteRefs.push({ id: n.note_id, noted, line: n.line_id, col: n.column_id });
      }
    }
  }

  if (totalRels.length + crossRels.length + noteRefs.length === 0 && !flags.includes('LINES_MISSING')) add('NO_RELATIONS_DECLARED');

  if (flags.length) {
    const fl = flags.concat(['INDETERMINATE']);
    return shell('indeterminate', null, pp, fl);
  }

  // ---- checks (all invariants hold from here: ids resolve, integers parse) ----
  const T = tol;
  const footing_breaks = [];
  for (const r of totalRels) {
    const tl = lines.get(r.total);
    for (const [col, idx] of colIndex) {
      let expected = 0n;
      for (const m of r.members) expected += m.sign * lines.get(m.id).amts[idx];
      const stated = tl.amts[idx];
      const diff = stated - expected;
      if (absBig(diff) > T) {
        footing_breaks.push({ total_line_id: r.total, column_id: col, expected_sum_minor: Number(expected), stated_total_minor: Number(stated), difference_minor: Number(diff) });
      }
    }
  }

  const crossfoot_breaks = [];
  for (const r of crossRels) {
    const ln = lines.get(r.line);
    let expected = 0n;
    for (const c of r.cols) expected += ln.amts[colIndex.get(c)];
    const stated = ln.amts[colIndex.get(r.totalCol)];
    const diff = stated - expected;
    if (absBig(diff) > T) {
      crossfoot_breaks.push({ line_id: r.line, total_column_id: r.totalCol, expected_sum_minor: Number(expected), stated_total_minor: Number(stated), difference_minor: Number(diff) });
    }
  }

  const note_breaks = [];
  for (const n of noteRefs) {
    const stated = lines.get(n.line).amts[colIndex.get(n.col)];
    const diff = n.noted - stated;
    if (absBig(diff) > T) {
      note_breaks.push({ note_id: n.id, line_id: n.line, column_id: n.col, noted_amount_minor: Number(n.noted), stated_amount_minor: Number(stated), difference_minor: Number(diff) });
    }
  }

  // Completeness: a subtotal or total line that no total relation foots was never footed, and a
  // multi-column statement with no cross-foot relation was never cross-footed. Neither may read as ties.
  // Notes: note_refs may be omitted (the input declares no notes elsewhere), so no note rule applies.
  const footed = new Set(totalRels.map((r) => r.total));
  const unfooted = [];
  for (const l of lines.values()) if ((l.role === 'total' || l.role === 'subtotal') && !footed.has(l.id)) unfooted.push(l.id);
  const crossfootMissing = colIndex.size > 1 && crossRels.length === 0;
  const incomplete = unfooted.length > 0 || crossfootMissing;

  const unreferenced_lines = [];
  for (const l of lines.values()) if (!refd.has(l.id) || unfooted.includes(l.id)) unreferenced_lines.push({ line_id: l.id, section_id: l.section });

  const footing_checked = totalRels.length * colIndex.size;
  const compliance_flags = [];
  if (footing_breaks.length) compliance_flags.push('FOOTING_BREAK');
  if (crossfoot_breaks.length) compliance_flags.push('CROSSFOOT_BREAK');
  if (note_breaks.length) compliance_flags.push('NOTE_TIE_BREAK');
  if (unreferenced_lines.length) compliance_flags.push('UNREFERENCED_LINES');
  if (unfooted.length) compliance_flags.push('TOTAL_LINE_NOT_FOOTED');
  if (crossfootMissing) compliance_flags.push('CROSSFOOT_NOT_DECLARED');
  if (footing_checked === 0) compliance_flags.push('NOTHING_FOOTED');
  const broke = footing_breaks.length + crossfoot_breaks.length + note_breaks.length > 0;
  if (!broke && incomplete) compliance_flags.push('INDETERMINATE');

  const output_payload = {
    verdict: broke ? 'breaks' : incomplete ? 'indeterminate' : 'ties',
    refusal_code: null,
    sign_convention: pp.sign_convention,
    tolerance_minor: Number(T),
    column_ids: Array.from(colIndex.keys()),
    footing_checked,
    crossfoot_checked: crossRels.length,
    note_checked: noteRefs.length,
    footing_breaks,
    crossfoot_breaks,
    note_breaks,
    unreferenced_lines,
    warnings: compliance_flags.slice(),
  };
  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now = null, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0',
    mandate_type: meta.mandate_type,
    tool_id: TOOL_ID,
    tool_version: TOOL_VERSION,
    generated_at: now ?? null,
    execution_hash: hash,
    chain: { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters: pp,
    output_payload,
    compliance_flags,
    compute_mode: 'server',
    compute_proof_ready: 'deferred',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
