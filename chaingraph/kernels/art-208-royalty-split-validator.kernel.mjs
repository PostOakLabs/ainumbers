import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-208-royalty-split-validator';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'validate_royalty_split',
  mandate_type: 'compliance_mandate', gpu: false,
};

// Validates a royalty-split config against ERC-2981 / 0xSplits rules.
// VALIDATE ONLY: no on-chain action, no distribution, no minting.
// Rules checked: share sum, per-recipient cap, no duplicates, no zero/blank
// address, basis-point range 0-10000, Ethereum address format.
// Produces a deterministic config fingerprint via djb2 over canonical JSON.
//
// Sources: ERC-2981 NFT Royalty Standard; 0xSplits protocol.

function djb2Hash(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = (((h << 5) + h) ^ str.charCodeAt(i)) >>> 0;
  }
  return '0x' + h.toString(16).padStart(8, '0');
}

function normalizeAddr(a) {
  return (typeof a === 'string' ? a : String(a || '')).toLowerCase().trim();
}

function isValidEthAddr(a) {
  return /^0x[0-9a-fA-F]{40}$/.test((typeof a === 'string' ? a : String(a || '')).trim());
}

export function compute(pp) {
  pp = pp || {};

  const capBpsInput = pp.cap_bps;
  const capBps = (typeof capBpsInput === 'number' && capBpsInput >= 1 && capBpsInput <= 10000)
    ? capBpsInput
    : (parseInt(String(capBpsInput || ''), 10) >= 1 ? Math.min(10000, Math.max(1, parseInt(String(capBpsInput || ''), 10))) : 5000);

  // Parse entries array
  let entries = [];
  if (Array.isArray(pp.entries)) {
    entries = pp.entries;
  } else if (typeof pp.config === 'string' && pp.config.trim()) {
    try { entries = JSON.parse(pp.config); } catch (_) { entries = []; }
  } else if (typeof pp.config === 'object' && Array.isArray(pp.config)) {
    entries = pp.config;
  }

  // Empty-input mode: return empty result without error
  if (!Array.isArray(entries) || entries.length === 0) {
    return {
      output_payload: {
        valid: false,
        mode: 'bps',
        recipient_count: 0,
        sum: 0,
        cap_bps: capBps,
        rules: [{ id: 'input', label: 'Input entries', pass: false, detail: 'No entries provided (empty-input mode).' }],
        config_hash: djb2Hash('[]'),
        disclaimer: 'Not legal advice. Validation only; no on-chain calls. Consult a licensed attorney and review ERC-2981 / 0xSplits documentation for your deployment.',
      },
      compliance_flags: { ROYALTY_SPLIT_VALIDATED: false, EMPTY_INPUT: true },
    };
  }

  // Detect mode: bps or percent
  let mode = 'bps';
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i] || {};
    if (e.percent !== undefined || e.pct !== undefined) { mode = 'percent'; break; }
  }

  const total    = mode === 'bps' ? 10000 : 100;
  const capInMode = mode === 'bps' ? capBps : (capBps / 100);
  const tolerance = mode === 'percent' ? 0.001 : 0;

  // Extract shares
  const shares = entries.map(function(e) {
    e = e || {};
    let share;
    if (mode === 'bps') {
      share = e.basis_points !== undefined ? e.basis_points
            : e.bps !== undefined ? e.bps
            : e.shares !== undefined ? e.shares : null;
    } else {
      share = e.percent !== undefined ? e.percent
            : e.pct !== undefined ? e.pct : null;
    }
    return { address: e.address, share: share };
  });

  const rules = [];

  // Rule 1: Share sum
  let sum = 0;
  for (let j = 0; j < shares.length; j++) {
    const s = Number(shares[j].share);
    if (!isNaN(s)) sum += s;
  }
  const sumOk = Math.abs(sum - total) <= tolerance;
  rules.push({
    id: 'sum', label: 'Share sum',
    pass: sumOk,
    detail: 'Sum: ' + sum + (mode === 'bps' ? ' bps (must equal 10000)' : '% (must equal 100)') +
            (sumOk ? '' : ' -- off by ' + (Math.abs(sum - total) < 1 ? (Math.abs(sum - total)).toFixed(4) : String(Math.round(Math.abs(sum - total))))),
  });

  // Rule 2: Per-recipient cap
  let capOk = true;
  const capViolators = [];
  for (let k = 0; k < shares.length; k++) {
    const sv = Number(shares[k].share);
    if (!isNaN(sv) && sv > capInMode) {
      capOk = false;
      capViolators.push(String(shares[k].address || '(blank)').slice(0, 12) + '... (' + sv + ')');
    }
  }
  rules.push({
    id: 'cap', label: 'Per-recipient cap',
    pass: capOk,
    detail: 'Cap: ' + capBps + ' bps (' + (capBps / 100) + '%)' +
            (capOk ? ' -- all entries within cap' : ' -- exceeds cap: ' + capViolators.join(', ')),
  });

  // Rule 3: No duplicate addresses
  const seen = {};
  const dups = [];
  for (let d = 0; d < shares.length; d++) {
    const na = normalizeAddr(shares[d].address);
    if (na && seen[na]) dups.push(String(shares[d].address).slice(0, 12) + '...');
    seen[na] = true;
  }
  rules.push({
    id: 'dups', label: 'No duplicate addresses',
    pass: dups.length === 0,
    detail: dups.length === 0 ? 'All addresses are unique' : 'Duplicates found: ' + dups.join(', '),
  });

  // Rule 4: No zero/blank addresses
  const zeroAddr = '0x' + '0'.repeat(40);
  const blanks = [];
  for (let b = 0; b < shares.length; b++) {
    const addr = String(shares[b].address || '').trim();
    if (!addr || addr === '0x' || normalizeAddr(addr) === zeroAddr) blanks.push('entry ' + (b + 1));
  }
  rules.push({
    id: 'no_blank', label: 'No zero/blank addresses',
    pass: blanks.length === 0,
    detail: blanks.length === 0 ? 'No blank or zero addresses' : 'Blank or zero address at: ' + blanks.join(', '),
  });

  // Rule 5: Share range 0–10000 bps (or 0–100%)
  const rangeMax = mode === 'bps' ? 10000 : 100;
  const outOfRange = [];
  for (let r = 0; r < shares.length; r++) {
    const sv2 = Number(shares[r].share);
    if (isNaN(sv2) || sv2 < 0 || sv2 > rangeMax) {
      outOfRange.push('entry ' + (r + 1) + ' (' + shares[r].share + ')');
    }
  }
  rules.push({
    id: 'range', label: mode === 'bps' ? 'Share values 0-10000 bps' : 'Share values 0-100%',
    pass: outOfRange.length === 0,
    detail: outOfRange.length === 0 ? 'All values in range' : 'Out of range: ' + outOfRange.join(', '),
  });

  // Rule 6: Ethereum address format
  const badAddr = [];
  for (let a = 0; a < shares.length; a++) {
    const addr2 = String(shares[a].address || '').trim();
    if (!isValidEthAddr(addr2)) {
      badAddr.push('entry ' + (a + 1) + ': ' + (addr2.slice(0, 16) || '(empty)') + (addr2.length > 16 ? '...' : ''));
    }
  }
  rules.push({
    id: 'addr_fmt', label: 'Address format (0x + 40 hex chars)',
    pass: badAddr.length === 0,
    detail: badAddr.length === 0 ? 'All addresses pass format check' : 'Format failures: ' + badAddr.join('; '),
  });

  const allPass = rules.every(function(r) { return r.pass; });

  // Config fingerprint (djb2 over canonical sorted JSON)
  const canonical = JSON.stringify(entries.map(function(e) {
    e = e || {};
    const addr = normalizeAddr(e.address);
    const sv = mode === 'bps'
      ? (e.basis_points !== undefined ? e.basis_points : (e.bps !== undefined ? e.bps : e.shares))
      : (e.percent !== undefined ? e.percent : e.pct);
    return { address: addr, share: sv };
  }).slice().sort(function(a, b) { return a.address < b.address ? -1 : 1; }));
  const configHash = djb2Hash(canonical);

  const output_payload = {
    valid: allPass,
    mode: mode,
    recipient_count: entries.length,
    sum: sum,
    cap_bps: capBps,
    rules: rules,
    config_hash: configHash,
    disclaimer: 'Not legal advice. Validation only; no on-chain calls, no royalty distribution. ERC-2981 is advisory. Consult a licensed attorney and review the 0xSplits documentation for your deployment.',
  };

  const compliance_flags = {
    ROYALTY_SPLIT_VALIDATED: true,
    VALIDATE_ONLY: true,
    NO_ON_CHAIN_ACTION: true,
  };
  if (!allPass) compliance_flags.VALIDATION_FAILED = true;

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
