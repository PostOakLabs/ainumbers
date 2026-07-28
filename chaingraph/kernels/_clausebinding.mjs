// _clausebinding.mjs — profile `ocg-clause-binding@1` (CLAUSE-BINDING-BUILD-SPEC.md §1.2 / §1.4 / §4).
//
// WHAT THIS PROFILE IS
// A citation is PINNED only when the §1.2 citation object sits inside the JCS-canonical preimage
// that execution_hash covers — that is, a member of policy_parameters or output_payload (§1.4).
// A citation anywhere else stays valid and in scope, but UNPINNED (§1.1): it may be read,
// published, and contradiction-checked; it may not claim pinned status.
//
// WHAT THIS PROFILE IS NOT
// It is NOT a migration. It applies to NEWLY-MINTED artifacts only. Artifacts already minted stay
// on the profile they were minted under, untouched and unmigrated, and their execution_hash and
// any §16/§18 proof over it remain valid forever. Profile versioning shields un-migrated artifacts;
// it does NOT make a later retrofit unnecessary — it makes one optional and deferred.
// The 105 server kernels that today carry a bare-string `regulatory_basis` are deliberately OUT OF
// SCOPE here. Converting one moves its execution_hash and would stale a live receipt.
//
// WHY ADDING THE ARRAY CANNOT MOVE A HASH
// executionHash() hashes exactly {policy_parameters, output_payload} (_hash.mjs). `clause_bindings`
// is a top-level sibling of those two members, so it is outside the preimage by construction —
// the same position §20 anchor_bindings, §23 input_attestations and §25 private_inputs occupy.
// attachClauseBindings() below is a pure top-level attach and never touches either preimage half.
//
// What DOES move a hash is putting a citation object into output_payload — which is exactly what an
// ADOPTING kernel does at mint time, for an artifact that has never been hashed or proven before.
// That is the whole reason adoption is new-artifacts-only.
//
// Zero-dependency, runs in browser / Worker / Node — same constraint as every kernel helper.

export const CLAUSE_BINDING_PROFILE = 'ocg-clause-binding@1';

// §1.2 — required members of the pinned form. Everything else is optional.
export const REQUIRED_CITATION_FIELDS = Object.freeze(['scheme', 'id', 'in_force_from', 'mapped_by', 'mapped_at']);

// §1.2 — scheme is an OPEN enum on purpose. These are the suggested values, not a whitelist:
// ELI does not cover US CFR, Basel paragraph ids, or Fed SR letters.
export const SUGGESTED_SCHEMES = Object.freeze(['cfr', 'eli', 'akn', 'bcbs-para', 'sr-letter', 'esma-vr', 'uscode', 'other']);

const OPTIONAL_CITATION_FIELDS = Object.freeze(['path', 'uri', 'in_force_to', 'jurisdiction', 'governing_law', 'superseded_by', 'interpretation_ref']);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const SHA256REF = /^sha256:[0-9a-f]{64}$/;

// §1.4 made mechanical: a pointer may only root at one of the two preimage halves.
const PREIMAGE_ROOTS = Object.freeze(['policy_parameters', 'output_payload']);

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** RFC 6901 unescape: ~1 -> "/", ~0 -> "~" (order matters). */
function unescapeToken(t) { return t.replace(/~1/g, '/').replace(/~0/g, '~'); }

/**
 * Resolve an RFC 6901 JSON Pointer against the artifact root.
 * Returns { found, value }. Never throws — a bad pointer is a finding, not a crash.
 */
export function resolvePointer(artifact, pointer) {
  if (typeof pointer !== 'string' || !pointer.startsWith('/')) return { found: false, value: undefined };
  let cur = artifact;
  for (const raw of pointer.slice(1).split('/')) {
    const tok = unescapeToken(raw);
    if (Array.isArray(cur)) {
      if (!/^(0|[1-9][0-9]*)$/.test(tok) || Number(tok) >= cur.length) return { found: false, value: undefined };
      cur = cur[Number(tok)];
    } else if (isObj(cur)) {
      if (!Object.prototype.hasOwnProperty.call(cur, tok)) return { found: false, value: undefined };
      cur = cur[tok];
    } else return { found: false, value: undefined };
  }
  return { found: true, value: cur };
}

/** True when the pointer roots at a half of the execution_hash preimage (§1.4). */
export function isInPreimage(pointer) {
  if (typeof pointer !== 'string' || !pointer.startsWith('/')) return false;
  const root = unescapeToken(pointer.slice(1).split('/')[0]);
  return PREIMAGE_ROOTS.includes(root);
}

/**
 * Validate one §1.2 pinned citation object. Returns an array of human-readable errors ([] = valid).
 * `where` is a label used in the messages so a gate can name the offending location.
 */
export function validateCitation(citation, where = 'citation') {
  const errs = [];
  if (!isObj(citation)) {
    // A bare string is the LEGACY UNPINNED form (§1.1) — valid as a citation, invalid as a pinned one.
    errs.push(typeof citation === 'string'
      ? `${where}: legacy bare-string citation cannot claim pinned status — the §1.2 object form is required`
      : `${where}: expected a §1.2 citation object, got ${citation === null ? 'null' : typeof citation}`);
    return errs;
  }
  for (const k of REQUIRED_CITATION_FIELDS)
    if (!(k in citation) || citation[k] === null || citation[k] === '')
      errs.push(`${where}: missing REQUIRED §1.2 member "${k}"`);

  const allowed = new Set([...REQUIRED_CITATION_FIELDS, ...OPTIONAL_CITATION_FIELDS]);
  for (const k of Object.keys(citation))
    if (!allowed.has(k)) errs.push(`${where}: unknown member "${k}" (the pinned form is closed)`);

  for (const k of ['in_force_from', 'mapped_at'])
    if (typeof citation[k] === 'string' && !ISO_DATE.test(citation[k]))
      errs.push(`${where}: "${k}" must be an ISO yyyy-mm-dd date, got "${citation[k]}"`);
  if ('in_force_to' in citation && citation.in_force_to !== null && !(typeof citation.in_force_to === 'string' && ISO_DATE.test(citation.in_force_to)))
    errs.push(`${where}: "in_force_to" must be an ISO yyyy-mm-dd date or null`);

  // §0.10 — an interpretation reference is a CONTENT HASH. A URL or a registry key is not one:
  // both can be repointed without changing the identifier, which is the property we need.
  if ('interpretation_ref' in citation && !SHA256REF.test(String(citation.interpretation_ref)))
    errs.push(`${where}: "interpretation_ref" must be a sha256:<64 hex> content hash, got "${citation.interpretation_ref}"`);

  if ('superseded_by' in citation) {
    const s = citation.superseded_by;
    if (!isObj(s) || !s.scheme || !s.id) errs.push(`${where}: "superseded_by" must be a {scheme, id} reference`);
  }
  if ('scheme' in citation && typeof citation.scheme !== 'string')
    errs.push(`${where}: "scheme" must be a string (open enum — any scheme name is allowed)`);
  return errs;
}

/**
 * Validate an artifact's clause_bindings declarations (§1.4).
 * Returns { ok, errors, checked }. An artifact with no clause_bindings is trivially ok —
 * absence carries no meaning and is not a defect.
 */
export function validateClauseBindings(artifact) {
  const errors = [];
  if (!isObj(artifact)) return { ok: false, errors: ['artifact: not an object'], checked: 0 };
  const bindings = artifact.clause_bindings;
  if (bindings === undefined) return { ok: true, errors: [], checked: 0 };
  if (!Array.isArray(bindings)) return { ok: false, errors: ['clause_bindings: must be an array'], checked: 0 };

  const seen = new Set();
  bindings.forEach((b, i) => {
    const at = `clause_bindings[${i}]`;
    if (!isObj(b)) { errors.push(`${at}: must be an object`); return; }
    if ('profile' in b && b.profile !== CLAUSE_BINDING_PROFILE)
      errors.push(`${at}: profile "${b.profile}" is not ${CLAUSE_BINDING_PROFILE}`);
    const ptr = b.pointer;
    if (typeof ptr !== 'string' || !ptr.startsWith('/')) { errors.push(`${at}: "pointer" must be an RFC 6901 JSON Pointer`); return; }
    // §1.4 RED: a citation outside the signed preimage claiming pinned status.
    if (!isInPreimage(ptr)) {
      errors.push(`${at}: pointer "${ptr}" is OUTSIDE the execution_hash preimage — a citation there is UNPINNED (§1.4) and may not be declared here`);
      return;
    }
    if (seen.has(ptr)) errors.push(`${at}: duplicate pointer "${ptr}"`);
    seen.add(ptr);
    const { found, value } = resolvePointer(artifact, ptr);
    if (!found) { errors.push(`${at}: pointer "${ptr}" does not resolve in this artifact`); return; }
    errors.push(...validateCitation(value, `${at} -> ${ptr}`));
  });
  return { ok: errors.length === 0, errors, checked: bindings.length };
}

/**
 * Attach clause-binding declarations to an already-hashed artifact.
 * Pure top-level attach: policy_parameters and output_payload are passed through by reference and
 * never read, rewritten, or reordered, so execution_hash cannot move. Returns a new object.
 * Throws only on a pointer that would misdeclare an unpinned citation as pinned (§1.4).
 */
export function attachClauseBindings(artifact, pointers) {
  const list = (pointers || []).map((p) => (typeof p === 'string' ? { pointer: p } : p));
  for (const b of list)
    if (!isInPreimage(b.pointer))
      throw new Error(`clause_bindings pointer "${b.pointer}" is outside the execution_hash preimage; a citation there is UNPINNED (§1.4)`);
  if (list.length === 0) return { ...artifact };
  return { ...artifact, clause_bindings: list };
}
