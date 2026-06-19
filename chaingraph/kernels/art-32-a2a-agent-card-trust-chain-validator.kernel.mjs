export const meta = {
  tool_id: 'art-32-a2a-agent-card-trust-chain-validator',
  mcp_name: 'validate_a2a_trust_chain',
  mandate_type: 'compliance_mandate',
};

const MAX_DELEG_DEPTH = 4;
const MAX_VALID_DAYS = 90;

function safeJson(v) {
  if (typeof v === 'string') {
    try { return JSON.parse(v); } catch(e) { return null; }
  }
  return v || null;
}

function isObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function validateCard(c) {
  const checks = [];
  const push = (code, status, note) => checks.push({ code, status, note: note||undefined });
  if (!isObject(c)) { push('CARD-00', 'fail', 'agent_card is not an object'); return checks; }

  const strFields = [
    ['name','CARD-NAM'], ['url','CARD-URL'], ['version','CARD-VER'], ['protocolVersion','CARD-PRO']
  ];
  for (const [f, code] of strFields) {
    push(code, typeof c[f]==='string' && c[f].length>0 ? 'pass' : 'fail', `${f} present and non-empty`);
  }
  push('CARD-URL2', c.url?.startsWith('https://') ? 'pass' : 'warn', 'url uses https');
  push('CARD-CAP', isObject(c.capabilities) ? 'pass' : 'fail', 'capabilities is non-array object');
  push('CARD-SKL', Array.isArray(c.skills) && c.skills.length>0 ? 'pass' : 'fail', 'skills non-empty array');

  if (Array.isArray(c.skills)) {
    c.skills.forEach((sk, i) => {
      push(`CARD-SK2-${i}`, sk && sk.id && sk.name ? 'pass' : 'warn', `skill[${i}] has id+name`);
    });
  }

  const exts = c.capabilities?.extensions;
  if (!exts || (Array.isArray(exts) && exts.length===0)) {
    push('CARD-X00', 'info', 'no extensions declared');
  } else if (Array.isArray(exts)) {
    push('CARD-X01', exts.every(e=>typeof e.uri==='string') ? 'pass' : 'fail', 'all extensions have uri string');
    push('CARD-X02', exts.every(e=>/^https?:\/\/[^\s]+$/.test(e.uri||'')) ? 'pass' : 'warn', 'all extension URIs match https?://...');
    const detected = exts.filter(e=>/ap2|x402|chaingraph/i.test(e.uri||'')).map(e=>e.uri);
    push('CARD-X03', 'info', `known extension URIs: [${detected.join(', ')||'none'}]`);
  }

  const sigs = c.signatures;
  if (Array.isArray(sigs) && sigs.length>0) {
    push('CARD-S01', sigs.every(s=>s.protected && s.signature) ? 'pass' : 'fail', 'all signatures have protected+signature');
  } else if (c.verificationMethod || c.securitySchemes) {
    push('CARD-S01', 'warn', 'verificationMethod/securitySchemes present but no signatures array');
  } else {
    push('CARD-S01', 'fail', 'no signatures block found');
  }

  return checks;
}

function validateDelegation(chain) {
  const checks = [];
  const push = (code, status, note) => checks.push({ code, status, note: note||undefined });
  if (!Array.isArray(chain) || chain.length===0) {
    push('DLG-D00', 'warn', 'delegation_chain is empty or not provided');
    return checks;
  }
  push('DLG-D01', chain.length <= MAX_DELEG_DEPTH ? 'pass' : 'fail', `chain.length=${chain.length} max=${MAX_DELEG_DEPTH}`);

  chain.forEach((link, i) => {
    const n = i+1;
    push(`DLG-L0${n}`, link.issuer && link.subject && link.scope ? 'pass' : 'fail', `link[${i}]: issuer+subject+scope`);
    if (i > 0) {
      push(`DLG-C0${n}`, link.issuer === chain[i-1].subject ? 'pass' : 'fail', `link[${i}].issuer === chain[${i-1}].subject`);
      const prevScope = Array.isArray(chain[i-1].scope) ? chain[i-1].scope : [chain[i-1].scope];
      const curScope = Array.isArray(link.scope) ? link.scope : [link.scope];
      const escalated = curScope.filter(s => !prevScope.includes(s));
      push(`DLG-E0${n}`, escalated.length===0 ? 'pass' : 'fail', escalated.length ? `scope escalation: ${escalated.join(',')}` : 'no scope escalation');
    }
    if (link.valid_days != null) {
      push(`DLG-V0${n}`, link.valid_days <= MAX_VALID_DAYS ? 'pass' : 'warn', `valid_days=${link.valid_days} max=${MAX_VALID_DAYS}`);
      push(`DLG-X0${n}`, link.valid_days > 0 ? 'pass' : 'fail', `valid_days=${link.valid_days} (<=0 = expired)`);
    } else {
      push(`DLG-V0${n}`, 'warn', 'valid_days missing');
    }
  });
  return checks;
}

function validateSpend(p) {
  const checks = [];
  const push = (code, status, note) => checks.push({ code, status, note: note||undefined });
  if (!isObject(p)) { push('SPD-00', 'fail', 'spend_policy is not an object'); return checks; }
  push('SPD-01', typeof p.per_tx_cap==='number' && p.per_tx_cap>0 ? 'pass' : 'fail', `per_tx_cap=${p.per_tx_cap}`);
  push('SPD-02', typeof p.daily_cap==='number' && p.daily_cap>0 ? 'pass' : 'fail', `daily_cap=${p.daily_cap}`);
  push('SPD-03', (typeof p.daily_cap==='number' && typeof p.per_tx_cap==='number' && p.daily_cap>=p.per_tx_cap) ? 'pass' : 'warn', 'daily_cap >= per_tx_cap');
  return checks;
}

export function compute(pp) {
  const card = safeJson(pp.agent_card);
  const chain = Array.isArray(pp.delegation_chain) ? pp.delegation_chain : (pp.delegation_chain ? safeJson(pp.delegation_chain) : []);
  const spend = pp.spend_policy || null;

  const cardChecks = validateCard(card);
  const delegChecks = validateDelegation(Array.isArray(chain) ? chain : []);
  const spendChecks = spend ? validateSpend(spend) : [];

  const allChecks = [...cardChecks, ...delegChecks, ...spendChecks];
  const failCount = allChecks.filter(c=>c.status==='fail').length;
  const warnCount = allChecks.filter(c=>c.status==='warn').length;
  const passCount = allChecks.filter(c=>c.status==='pass').length;
  const verdict = failCount>0 ? 'fail' : warnCount>0 ? 'warn' : 'pass';

  // Compute derived flags
  const delegEscalationChecks = allChecks.filter(c=>c.code.startsWith('DLG-E'));
  const delegExpiredChecks = allChecks.filter(c=>c.code.startsWith('DLG-X'));
  const no_scope_escalation = delegEscalationChecks.length===0 || delegEscalationChecks.every(c=>c.status==='pass');
  const no_expired_links = delegExpiredChecks.length===0 || delegExpiredChecks.every(c=>c.status==='pass');

  const cardCoreCodes = ['CARD-NAM','CARD-URL','CARD-VER','CARD-PRO','CARD-CAP','CARD-SKL'];
  const card_schema_ok = !allChecks.some(c=>cardCoreCodes.includes(c.code) && c.status==='fail');
  const sigCheck = allChecks.find(c=>c.code==='CARD-S01');
  const signature_block_present = sigCheck?.status==='pass';

  const compliance_flags = verdict==='fail'
    ? ['A2A_TRUST_CHAIN_FAILED','TRUST_CHECK_VALIDATION_FAILED']
    : verdict==='warn'
    ? ['A2A_TRUST_CHAIN_CONFORMANT_WITH_WARNINGS']
    : ['A2A_TRUST_CHAIN_CONFORMANT'];
  if (!no_scope_escalation) compliance_flags.push('SCOPE_ESCALATION_DETECTED');
  if (!no_expired_links) compliance_flags.push('EXPIRED_DELEGATION_LINK');

  return {
    trust_determination: verdict,
    pass_count: passCount,
    fail_count: failCount,
    warn_count: warnCount,
    card_schema_ok,
    signature_block_present,
    no_scope_escalation,
    no_expired_links,
    checks: allChecks,
    compliance_flags,
  };
}

export function buildArtifact(pp, opts={}) {
  const result = compute(pp);
  return {
    tool_id: meta.tool_id,
    mcp_name: meta.mcp_name,
    mandate_type: meta.mandate_type,
    inputs: pp,
    outputs: result,
    artifact_version: '1.0',
  };
}
