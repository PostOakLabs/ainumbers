import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-204-license-compatibility-checker';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'check_license_compatibility',
  mandate_type: 'compliance_mandate', gpu: false,
};

// License compatibility checker.
// "Can child license B derive from parent asset licensed under A?"
// Also handles SPDX-satisfies checks over Creative Commons families.
//
// Reason codes:
//   ND_BLOCKS_DERIVATIVE      — parent has NoDerivatives; no derivatives allowed
//   SA_REQUIRES_SAME_LICENSE  — parent has ShareAlike; child must use same license
//   NC_BLOCKS_COMMERCIAL      — parent has NonCommercial; child commercial use blocked
//   PIL_RECIPROCAL_MISMATCH   — Story PIL reciprocal requires same-flavor child
//   CBE_PERSONAL_NO_DERIVATIVE — CBE PERSONAL tier blocks derivatives
//
// Source-of-truth citations embedded in output per §5 UPL guardrail.
// Not legal advice. Consult a licensed attorney for your jurisdiction.

// Canonical rights properties per license id
// family: cc | cbe | pil | embedded
const LICENSE_DB = {
  // Creative Commons
  'CC0-1.0':        { family:'cc', nd:false, sa:false, nc:false, derivatives:true,  commercial:true,  reciprocal:false, source:'https://creativecommons.org/publicdomain/zero/1.0/' },
  'CC-BY-4.0':      { family:'cc', nd:false, sa:false, nc:false, derivatives:true,  commercial:true,  reciprocal:false, source:'https://creativecommons.org/licenses/by/4.0/' },
  'CC-BY-SA-4.0':   { family:'cc', nd:false, sa:true,  nc:false, derivatives:true,  commercial:true,  reciprocal:true,  source:'https://creativecommons.org/licenses/by-sa/4.0/' },
  'CC-BY-ND-4.0':   { family:'cc', nd:true,  sa:false, nc:false, derivatives:false, commercial:true,  reciprocal:false, source:'https://creativecommons.org/licenses/by-nd/4.0/' },
  'CC-BY-NC-4.0':   { family:'cc', nd:false, sa:false, nc:true,  derivatives:true,  commercial:false, reciprocal:false, source:'https://creativecommons.org/licenses/by-nc/4.0/' },
  'CC-BY-NC-SA-4.0':{ family:'cc', nd:false, sa:true,  nc:true,  derivatives:true,  commercial:false, reciprocal:true,  source:'https://creativecommons.org/licenses/by-nc-sa/4.0/' },
  'CC-BY-NC-ND-4.0':{ family:'cc', nd:true,  sa:false, nc:true,  derivatives:false, commercial:false, reciprocal:false, source:'https://creativecommons.org/licenses/by-nc-nd/4.0/' },
  // Story PIL flavors
  'PIL-NC-SOCIAL':  { family:'pil', nd:false, sa:false, nc:true,  derivatives:true,  commercial:false, reciprocal:true,  source:'https://docs.story.foundation/concepts/programmable-ip-license' },
  'PIL-COMMERCIAL': { family:'pil', nd:false, sa:false, nc:false, derivatives:false, commercial:true,  reciprocal:false, source:'https://docs.story.foundation/concepts/programmable-ip-license' },
  'PIL-COMMERCIAL-REMIX':{ family:'pil', nd:false, sa:false, nc:false, derivatives:true, commercial:true, reciprocal:true, source:'https://docs.story.foundation/concepts/programmable-ip-license' },
  // CBE tiers (a16z Can't Be Evil)
  'CBE-CC0':        { family:'cbe', nd:false, sa:false, nc:false, derivatives:true,  commercial:true,  reciprocal:false, source:'https://github.com/a16z/a16z-contracts' },
  'CBE-ECR':        { family:'cbe', nd:false, sa:false, nc:false, derivatives:true,  commercial:true,  reciprocal:false, source:'https://github.com/a16z/a16z-contracts' },
  'CBE-NECR':       { family:'cbe', nd:false, sa:false, nc:false, derivatives:true,  commercial:true,  reciprocal:false, source:'https://github.com/a16z/a16z-contracts' },
  'CBE-NECR-HS':    { family:'cbe', nd:false, sa:false, nc:false, derivatives:true,  commercial:true,  reciprocal:false, source:'https://github.com/a16z/a16z-contracts' },
  'CBE-PR':         { family:'cbe', nd:true,  sa:false, nc:true,  derivatives:false, commercial:false, reciprocal:false, source:'https://github.com/a16z/a16z-contracts' },
  'CBE-PR-HS':      { family:'cbe', nd:true,  sa:false, nc:true,  derivatives:false, commercial:false, reciprocal:false, source:'https://github.com/a16z/a16z-contracts' },
  // SolSea embedded
  'EMBEDDED-PRIVATE-NC':    { family:'embedded', nd:true,  sa:false, nc:true,  derivatives:false, commercial:false, reciprocal:false, source:'https://solsea.io/license' },
  'EMBEDDED-PERSONAL-NC':   { family:'embedded', nd:false, sa:false, nc:true,  derivatives:true,  commercial:false, reciprocal:false, source:'https://solsea.io/license' },
  'EMBEDDED-PUBLIC-NC':     { family:'embedded', nd:false, sa:false, nc:true,  derivatives:true,  commercial:false, reciprocal:false, source:'https://solsea.io/license' },
  'EMBEDDED-REPRODUCTION-COMMERCIAL': { family:'embedded', nd:false, sa:false, nc:false, derivatives:true, commercial:true, reciprocal:false, source:'https://solsea.io/license' },
};

// SPDX satisfies: returns true if child_spdx is at least as restrictive as parent_spdx
// (i.e., child satisfies parent constraints). Only meaningful within CC family.
function spdxSatisfies(parent, child) {
  if (!parent || !child) return false;
  const p = LICENSE_DB[parent];
  const c = LICENSE_DB[child];
  if (!p || !c) return false;
  if (p.family !== 'cc' || c.family !== 'cc') return false;
  // NC: if parent is NC, child must also be NC
  if (p.nc && !c.nc) return false;
  // SA: if parent is SA, child must be same license
  if (p.sa && parent !== child) return false;
  // ND: parent ND means no derivatives at all
  if (p.nd) return false;
  return true;
}

export function compute(pp) {
  pp = pp || {};

  const parent_license = typeof pp.parent_license === 'string' ? pp.parent_license.trim() : '';
  const child_license  = typeof pp.child_license  === 'string' ? pp.child_license.trim()  : '';

  const parent = parent_license ? LICENSE_DB[parent_license] : null;
  const child  = child_license  ? LICENSE_DB[child_license]  : null;

  const checks = [];
  const reason_codes = [];
  let compatible = true;
  let required_child_license = null;

  // Empty-input mode: return empty-but-valid structure
  if (!parent_license && !child_license) {
    return {
      output_payload: {
        compatible: null,
        reason_codes: [],
        required_child_license: null,
        parent_license: null,
        child_license: null,
        spdx_satisfies: null,
        checks: [{ check: 'input_present', pass: false, detail: 'parent_license and child_license are required' }],
        disclaimer: 'Not legal advice. Selection only. The published license terms govern. Consult a licensed attorney for your jurisdiction.',
      },
      compliance_flags: ['LICENSE_COMPATIBILITY_CHECKED', 'INPUTS_MISSING'],
    };
  }

  // Validate parent
  const parentKnown = !!parent;
  checks.push({ check: 'parent_license_known', pass: parentKnown,
    detail: parentKnown ? 'parent: ' + parent_license + ' (' + parent.family + ')' : 'unknown parent license: ' + parent_license });
  if (!parentKnown) compatible = false;

  // Validate child
  const childKnown = !!child;
  checks.push({ check: 'child_license_known', pass: childKnown,
    detail: childKnown ? 'child: ' + child_license + ' (' + child.family + ')' : 'unknown child license: ' + child_license });
  if (!childKnown) compatible = false;

  if (parentKnown && childKnown) {
    // ND check
    if (parent.nd) {
      reason_codes.push('ND_BLOCKS_DERIVATIVE');
      compatible = false;
      checks.push({ check: 'nd_allows_derivative', pass: false,
        detail: 'ND_BLOCKS_DERIVATIVE: parent ' + parent_license + ' has NoDerivatives; no derivative works allowed' });
    } else {
      checks.push({ check: 'nd_allows_derivative', pass: true, detail: 'parent allows derivatives' });
    }

    // SA check
    if (parent.sa) {
      const sameId = parent_license === child_license;
      if (!sameId) {
        reason_codes.push('SA_REQUIRES_SAME_LICENSE');
        compatible = false;
        required_child_license = parent_license;
        checks.push({ check: 'sa_same_license', pass: false,
          detail: 'SA_REQUIRES_SAME_LICENSE: parent is ShareAlike; child must use ' + parent_license + ', got ' + child_license });
      } else {
        checks.push({ check: 'sa_same_license', pass: true, detail: 'ShareAlike satisfied: child uses same license ' + child_license });
      }
    } else if (parent.family === 'pil' && parent.reciprocal) {
      // PIL reciprocal
      const sameFlavor = parent_license === child_license;
      if (!sameFlavor) {
        reason_codes.push('PIL_RECIPROCAL_MISMATCH');
        compatible = false;
        required_child_license = parent_license;
        checks.push({ check: 'pil_reciprocal', pass: false,
          detail: 'PIL_RECIPROCAL_MISMATCH: PIL reciprocal requires same flavor; expected ' + parent_license + ', got ' + child_license });
      } else {
        checks.push({ check: 'pil_reciprocal', pass: true, detail: 'PIL reciprocal satisfied' });
      }
    } else {
      checks.push({ check: 'sa_same_license', pass: true, detail: 'No ShareAlike/reciprocal constraint on parent' });
    }

    // NC check
    if (parent.nc && child.commercial) {
      reason_codes.push('NC_BLOCKS_COMMERCIAL');
      compatible = false;
      checks.push({ check: 'nc_commercial_allowed', pass: false,
        detail: 'NC_BLOCKS_COMMERCIAL: parent ' + parent_license + ' is NonCommercial; child ' + child_license + ' allows commercial use' });
    } else {
      checks.push({ check: 'nc_commercial_allowed', pass: true, detail: 'No NC/commercial conflict' });
    }

    // CBE PERSONAL blocks derivatives
    if ((parent_license === 'CBE-PR' || parent_license === 'CBE-PR-HS') && child.derivatives) {
      reason_codes.push('CBE_PERSONAL_NO_DERIVATIVE');
      compatible = false;
      checks.push({ check: 'cbe_personal_derivative', pass: false,
        detail: 'CBE_PERSONAL_NO_DERIVATIVE: CBE PERSONAL tier does not permit derivatives; child ' + child_license + ' allows them' });
    } else {
      checks.push({ check: 'cbe_personal_derivative', pass: true, detail: 'No CBE PERSONAL derivative block' });
    }
  }

  // SPDX satisfies (CC only)
  const spdx_satisfies = (parentKnown && childKnown && parent.family === 'cc' && child.family === 'cc')
    ? spdxSatisfies(parent_license, child_license)
    : null;

  const output_payload = {
    compatible: (parentKnown && childKnown) ? compatible : null,
    reason_codes: reason_codes,
    required_child_license: required_child_license,
    parent_license: parent_license || null,
    child_license:  child_license  || null,
    spdx_satisfies: spdx_satisfies,
    checks: checks,
    parent_source: parent ? parent.source : null,
    child_source:  child  ? child.source  : null,
    disclaimer: 'Not legal advice. Selection only. The published license terms govern. Consult a licensed attorney for your jurisdiction.',
  };

  const compliance_flags = [];
  compliance_flags.push('LICENSE_COMPATIBILITY_CHECKED');
  if (compatible === true)  compliance_flags.push('COMPATIBLE');
  if (compatible === false) compliance_flags.push('INCOMPATIBLE');
  for (let i = 0; i < reason_codes.length; i++) compliance_flags.push(reason_codes[i]);

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
