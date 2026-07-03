import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-198-cross-license-rights-comparator';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'compare_rights_matrix',
  mandate_type: 'compliance_mandate', gpu: false,
};

// Canonical 9-dimension rights vector for cross-framework license comparison.
// Dimensions:
//   GRANTING (true = more permissive): copy, display, commercial, modify, sublicense, exclusive
//   RESTRICTING (false = more permissive): share_alike, attribution, revocable
//
// CC 4.0 — source: https://creativecommons.org/choose/
// CBE — source: https://github.com/a16z/cant-be-evil/  (verified 2026-07-02)
// PIL — source: https://docs.story.foundation/concepts/programmable-ip-license/pil-flavors

const VEC = {
  // ---- Creative Commons 4.0 ----
  'cc:CC0-1.0':         { copy:true,  display:true,  commercial:true,  exclusive:false, modify:true,  sublicense:true,  share_alike:false, attribution:false, revocable:false },
  'cc:CC-BY-4.0':       { copy:true,  display:true,  commercial:true,  exclusive:false, modify:true,  sublicense:true,  share_alike:false, attribution:true,  revocable:false },
  'cc:CC-BY-SA-4.0':    { copy:true,  display:true,  commercial:true,  exclusive:false, modify:true,  sublicense:true,  share_alike:true,  attribution:true,  revocable:false },
  'cc:CC-BY-ND-4.0':    { copy:true,  display:true,  commercial:true,  exclusive:false, modify:false, sublicense:false, share_alike:false, attribution:true,  revocable:false },
  'cc:CC-BY-NC-4.0':    { copy:true,  display:true,  commercial:false, exclusive:false, modify:true,  sublicense:false, share_alike:false, attribution:true,  revocable:false },
  'cc:CC-BY-NC-SA-4.0': { copy:true,  display:true,  commercial:false, exclusive:false, modify:true,  sublicense:false, share_alike:true,  attribution:true,  revocable:false },
  'cc:CC-BY-NC-ND-4.0': { copy:true,  display:true,  commercial:false, exclusive:false, modify:false, sublicense:false, share_alike:false, attribution:true,  revocable:false },
  // ---- a16z Can't Be Evil (both launch aliases and Oct-2022 enum names accepted) ----
  'cbe:CBE_CC0':         { copy:true,  display:true,  commercial:true,  exclusive:false, modify:true,  sublicense:true,  share_alike:false, attribution:false, revocable:false },
  'cbe:CBE_ECR':         { copy:true,  display:true,  commercial:true,  exclusive:true,  modify:true,  sublicense:true,  share_alike:false, attribution:false, revocable:true  },
  'cbe:CBE_NECR':        { copy:true,  display:true,  commercial:true,  exclusive:false, modify:true,  sublicense:true,  share_alike:false, attribution:false, revocable:true  },
  'cbe:CBE_NECR_HS':     { copy:true,  display:true,  commercial:true,  exclusive:false, modify:true,  sublicense:true,  share_alike:false, attribution:false, revocable:true  },
  'cbe:CBE_PR':          { copy:true,  display:true,  commercial:false, exclusive:false, modify:false, sublicense:false, share_alike:false, attribution:false, revocable:true  },
  'cbe:CBE_PR_HS':       { copy:true,  display:true,  commercial:false, exclusive:false, modify:false, sublicense:false, share_alike:false, attribution:false, revocable:true  },
  // ---- Story Protocol PIL flavors ----
  'pil:non_commercial_social_remixing': { copy:true, display:true, commercial:false, exclusive:false, modify:true,  sublicense:true,  share_alike:true,  attribution:true,  revocable:false },
  'pil:commercial_use':                 { copy:true, display:true, commercial:true,  exclusive:false, modify:false, sublicense:false, share_alike:false, attribution:true,  revocable:false },
  'pil:commercial_remix':               { copy:true, display:true, commercial:true,  exclusive:false, modify:true,  sublicense:true,  share_alike:true,  attribution:true,  revocable:false },
};

// Oct-2022 CBE enum renames (order unchanged, texts unchanged). Both name sets equivalent.
const CBE_ALIAS = {
  PUBLIC:             'CBE_CC0',
  EXCLUSIVE:          'CBE_ECR',
  COMMERCIAL:         'CBE_NECR',
  COMMERCIAL_NO_HATE: 'CBE_NECR_HS',
  PERSONAL:           'CBE_PR',
  PERSONAL_NO_HATE:   'CBE_PR_HS',
};

const DIMS = ['copy','display','commercial','exclusive','modify','sublicense','share_alike','attribution','revocable'];
const GRANT    = new Set(['copy','display','commercial','modify','sublicense','exclusive']);
const RESTRICT = new Set(['share_alike','attribution','revocable']);

function normalizeRef(ref) {
  if (!ref || typeof ref !== 'object') return null;
  const fam = String(ref.family || '').toLowerCase().trim();
  let id = String(ref.id || '').trim();
  if (fam === 'cbe') {
    const alias = CBE_ALIAS[id];
    if (alias) id = alias;
  }
  const key = fam + ':' + id;
  if (!VEC[key]) return null;
  return { fam, id, key };
}

function diffVectors(va, vb) {
  const d = [];
  for (const k of DIMS) {
    if (va[k] !== vb[k]) d.push({ key: k, ref_a: va[k], ref_b: vb[k] });
  }
  return d;
}

function comparePermissiveness(va, vb) {
  let aBeatsB = false;
  let bBeatsA = false;
  for (const k of DIMS) {
    if (GRANT.has(k)) {
      if (va[k] && !vb[k]) aBeatsB = true;
      if (vb[k] && !va[k]) bBeatsA = true;
    } else {
      if (!va[k] && vb[k]) aBeatsB = true;
      if (!vb[k] && va[k]) bBeatsA = true;
    }
  }
  if (!aBeatsB && !bBeatsA) return 'equal';
  if (aBeatsB && !bBeatsA) return 'a_more_permissive';
  if (bBeatsA && !aBeatsB) return 'b_more_permissive';
  return 'incomparable';
}

// Default refs for empty-input case.
const DEFAULT_A = { family: 'cc', id: 'CC0-1.0' };
const DEFAULT_B = { family: 'cc', id: 'CC-BY-4.0' };

export function compute(pp) {
  const rawA = (pp && pp.license_ref_a && typeof pp.license_ref_a === 'object') ? pp.license_ref_a : DEFAULT_A;
  const rawB = (pp && pp.license_ref_b && typeof pp.license_ref_b === 'object') ? pp.license_ref_b : DEFAULT_B;

  const refA = normalizeRef(rawA);
  const refB = normalizeRef(rawB);

  const unknownA = !refA;
  const unknownB = !refB;

  const va = refA ? VEC[refA.key] : null;
  const vb = refB ? VEC[refB.key] : null;

  const checks = [];
  const push = (check, pass, detail) => checks.push({ check, pass, detail });
  push('ref_a_recognized', !unknownA, unknownA
    ? 'license_ref_a family/id not in the encoded matrix (cc, cbe, pil families supported)'
    : 'resolved to ' + (refA.fam + ':' + refA.id));
  push('ref_b_recognized', !unknownB, unknownB
    ? 'license_ref_b family/id not in the encoded matrix'
    : 'resolved to ' + (refB.fam + ':' + refB.id));

  const FALLBACK = { copy:false, display:false, commercial:false, exclusive:false, modify:false, sublicense:false, share_alike:false, attribution:false, revocable:false };
  const vecA = va || FALLBACK;
  const vecB = vb || FALLBACK;

  const diff = (!unknownA && !unknownB) ? diffVectors(vecA, vecB) : [];
  const more_permissive_than = (!unknownA && !unknownB) ? comparePermissiveness(vecA, vecB) : 'unknown';

  const output_payload = {
    ref_a: rawA,
    ref_b: rawB,
    vector_a: vecA,
    vector_b: vecB,
    diff,
    more_permissive_than,
    dimensions: DIMS,
    sources: {
      cc:  'https://creativecommons.org/choose/',
      cbe: 'https://github.com/a16z/cant-be-evil/',
      pil: 'https://docs.story.foundation/concepts/programmable-ip-license/pil-flavors',
    },
    matrix_note: 'Canonical rights vectors encode the stated terms of published license texts. This comparison is informational only, not legal advice.',
    disclaimer: 'Selection only. Not legal advice. Consult the canonical license texts and a licensed attorney before relying on any comparison for commercial or legal decisions.',
    checks,
  };

  const compliance_flags = {
    RIGHTS_MATRIX_COMPARED: true,
    BOTH_REFS_RECOGNIZED:   !unknownA && !unknownB,
    SELECTION_NOT_ADVICE:   true,
  };

  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0', mandate_type: meta.mandate_type,
    tool_id: TOOL_ID, tool_version: TOOL_VERSION, generated_at: now ?? null,
    execution_hash: hash, chain: { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters: pp, output_payload, compliance_flags, compute_mode: 'server',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
