export const meta = {
  tool_id: 'art-33-mcp-server-self-attestation-pack',
  mcp_name: 'attest_mcp_server',
  mandate_type: 'infrastructure_mandate',
};

function safeJson(v) {
  if (typeof v === 'string') {
    try { return JSON.parse(v); } catch(e) { return null; }
  }
  return v || null;
}

function scoreChecks(checks) {
  let got = 0, max = 0;
  for (const c of checks) {
    if (c.status === 'info') continue;
    max += 2;
    if (c.status === 'pass') got += 2;
    else if (c.status === 'warn') got += 1;
  }
  return { got, max, pct: max > 0 ? Math.round(100 * got / max) : 100 };
}

function grade(pct) {
  if (pct >= 90) return 'A';
  if (pct >= 78) return 'B';
  if (pct >= 62) return 'C';
  if (pct >= 45) return 'D';
  return 'F';
}

// Domain A — lint tool definition
function lintToolDefinition(td) {
  const checks = [];
  const push = (code, status, note) => checks.push({ code, status, note: note||undefined });
  if (!td) { push('A01', 'fail', 'tool_definition null'); return checks; }

  const name = td.name;
  if (!name) {
    push('A01', 'fail', 'name missing');
  } else if (/^[a-z][a-z0-9_]*$/.test(name) && name.includes('_')) {
    push('A01', 'pass', `name=${name}`);
  } else {
    push('A01', 'warn', `name=${name} present but not snake_case with underscore`);
  }

  const desc = typeof td.description === 'string' ? td.description.trim() : '';
  push('A02', desc.length >= 20 ? 'pass' : 'fail', `description length=${desc.length}`);
  push('A03', /\b(do not|don'?t|only when|never|avoid)\b/i.test(desc) ? 'pass' : 'warn', 'behavioral guidance in description');

  const schema = td.inputSchema;
  push('A04', schema && typeof schema==='object' && schema.type==='object' ? 'pass' : 'fail', 'inputSchema.type=object');

  const props = schema?.properties;
  if (!props || Object.keys(props).length === 0) {
    push('A05', 'fail', 'inputSchema.properties is empty or missing');
  } else {
    const keys = Object.keys(props);
    const untyped = keys.filter(k => {
      const p = props[k];
      return !p.type && !p.enum && !p.$ref && !p.anyOf && !p.oneOf;
    });
    push('A05', untyped.length === 0 ? 'pass' : 'warn', untyped.length ? `untyped props: ${untyped.join(',')}` : 'all props typed');
    const noDesc = keys.filter(k => !props[k].description || !String(props[k].description).trim());
    push('A06', noDesc.length === 0 ? 'pass' : 'warn', noDesc.length ? `props missing description: ${noDesc.join(',')}` : 'all props have description');
  }
  push('A07', td.annotations && typeof td.annotations==='object' ? 'pass' : 'warn', 'annotations block present');
  return checks;
}

// Domain B — validate server JSON
function validateServerJson(sj) {
  const checks = [];
  const push = (code, status, note) => checks.push({ code, status, note: note||undefined });
  if (!sj) { push('B01', 'warn', 'server_json null'); return checks; }

  const sch = typeof sj.$schema === 'string' ? sj.$schema : '';
  if (/server\.schema\.json/.test(sch) && /2025-12-11/.test(sch)) {
    push('B01', 'pass', '$schema matches 2025-12-11');
  } else if (/server\.schema\.json/.test(sch)) {
    push('B01', 'warn', '$schema present but not 2025-12-11 version');
  } else {
    push('B01', 'warn', '$schema missing or not a server schema');
  }

  const n = sj.name || '';
  if (!n) {
    push('B02', 'fail', 'name missing');
  } else if (n.includes('.') || n.includes('/')) {
    push('B02', 'pass', `name=${n} (namespaced)`);
  } else {
    push('B02', 'warn', `name=${n} present but not reverse-DNS namespaced`);
  }
  push('B03', typeof sj.version==='string' && sj.version.length>0 ? 'pass' : 'fail', `version=${sj.version}`);

  const hasEndpoints = (sj.remotes?.length||0) + (sj.packages?.length||0) > 0;
  push('B04', hasEndpoints ? 'pass' : 'fail', 'at least one remote or package');

  if (Array.isArray(sj.remotes) && sj.remotes.length > 0) {
    push('B05', sj.remotes.every(r=>typeof r.url==='string' && r.url.startsWith('https://')) ? 'pass' : 'fail', 'all remotes use https://');
    push('B06', sj.remotes.every(r=>r.type && String(r.type).trim().length>0) ? 'pass' : 'warn', 'all remotes have non-empty type');
  }
  return checks;
}

// Domain C — audit OAuth
function auditOAuth(f) {
  const checks = [];
  const push = (code, status, note) => checks.push({ code, status, note: note||undefined });
  if (!f) { push('C01', 'fail', 'oauth_flags null'); return checks; }
  push('C01', f.has_prm ? 'pass' : 'fail', 'has_prm (Protected Resource Metadata)');
  push('C02', f.audience_bound ? 'pass' : 'fail', 'audience_bound');
  push('C03', f.pkce ? 'pass' : 'fail', 'pkce');
  push('C04', f.https_only ? 'pass' : 'fail', 'https_only');
  return checks;
}

// Domain D — scan tool poisoning
function scanToolPoisoning(td, sec) {
  const checks = [];
  const push = (code, status, note) => checks.push({ code, status, note: note||undefined });
  const blob = JSON.stringify(td || {});

  const injPatterns = [
    /ignore (the )?(earlier|previous|above|prior) (instruction|prompt)/i,
    /\bignore any\b/i,
    /do not (mention|tell|reveal)/i,
    /\bsystem prompt\b/i,
  ];
  push('D01', injPatterns.some(p=>p.test(blob)) ? 'fail' : 'pass', 'no prompt-injection patterns');

  const filePatterns = [/\.ssh\//i, /id_rsa/i, /\.env\b/i, /etc\/passwd/i, /private[_ ]key/i];
  push('D02', filePatterns.some(p=>p.test(blob)) ? 'fail' : 'pass', 'no SSH/file path patterns');

  const secretPatterns = [
    /sk-live-[a-z0-9]/i,
    /api[_ ]?key\s*[:=]\s*['"]?[a-z0-9]{8,}/i,
    /bearer\s+[a-z0-9]{16,}/i,
    /<secret>/i,
  ];
  const secretFound = secretPatterns.some(p=>p.test(blob));
  if (secretFound) {
    push('D03', 'fail', 'secret pattern found in tool definition');
  } else if (sec?.no_secrets_in_descriptions) {
    push('D03', 'pass', 'no secrets found, flag confirms');
  } else {
    push('D03', 'warn', 'no secrets found but no_secrets_in_descriptions not confirmed');
  }

  const hiddenUnicode = /[​-‏‪-‮⁠﻿]/.test(blob);
  push('D04', hiddenUnicode ? 'fail' : 'pass', 'no hidden unicode characters');
  return checks;
}

// Domain E — ops readiness
function opsReadiness(sec, td) {
  const checks = [];
  const push = (code, status, note) => checks.push({ code, status, note: note||undefined });
  if (!sec) sec = {};
  push('E01', sec.read_only_hints ? 'pass' : 'warn', 'read_only_hints flag set');
  push('E02', sec.input_schemas_typed ? 'pass' : 'warn', 'input_schemas_typed flag set');
  const destructive = td?.annotations?.destructiveHint === true;
  push('E03', !destructive || sec.read_only_hints ? 'pass' : 'warn', 'destructiveHint only if read_only_hints');
  return checks;
}

export function compute(pp) {
  const td = safeJson(pp.tool_definition);
  const sj = safeJson(pp.server_json);
  const oauthFlags = pp.oauth_flags || {};
  const sec = pp.security_flags || {};

  const domainA = lintToolDefinition(td);
  const domainB = validateServerJson(sj);
  const domainC = auditOAuth(oauthFlags);
  const domainD = scanToolPoisoning(td, sec);
  const domainE = opsReadiness(sec, td);

  const domains = [
    { domain: 'A', label: 'Tool Definition Lint', checks: domainA },
    { domain: 'B', label: 'Server JSON Validation', checks: domainB },
    { domain: 'C', label: 'OAuth Audit', checks: domainC },
    { domain: 'D', label: 'Tool Poisoning Scan', checks: domainD },
    { domain: 'E', label: 'Ops Readiness', checks: domainE },
  ];

  const allChecks = [...domainA, ...domainB, ...domainC, ...domainD, ...domainE];

  let totalGot = 0, totalMax = 0;
  const per_domain_scores = domains.map(d => {
    const s = scoreChecks(d.checks);
    totalGot += s.got;
    totalMax += s.max;
    return { domain: d.domain, label: d.label, score: s.pct };
  });

  const composite_score = totalMax > 0 ? Math.round(100 * totalGot / totalMax) : 100;
  const composite_grade = grade(composite_score);

  const failCount = allChecks.filter(c=>c.status==='fail').length;
  const warnCount = allChecks.filter(c=>c.status==='warn').length;
  const passCount = allChecks.filter(c=>c.status==='pass').length;
  const overallStatus = failCount>0 ? 'fail' : warnCount>0 ? 'warn' : 'pass';

  const compliance_flags = overallStatus==='fail'
    ? ['MCP_ATTESTATION_FAILED','SHIP_READINESS_BELOW_THRESHOLD']
    : overallStatus==='warn'
    ? ['MCP_ATTESTATION_PASSED_WITH_WARNINGS']
    : ['MCP_ATTESTATION_PASSED'];

  // Build remediation list: fails first then warns, sorted by domain
  const remediation = [];
  let rank = 1;
  for (const c of allChecks) {
    if (c.status === 'fail') {
      remediation.push({ rank: rank++, domain: c.code[0], severity: 'fail', code: c.code, note: c.note });
    }
  }
  for (const c of allChecks) {
    if (c.status === 'warn') {
      remediation.push({ rank: rank++, domain: c.code[0], severity: 'warn', code: c.code, note: c.note });
    }
  }

  return {
    composite_grade,
    composite_score,
    per_domain_scores,
    pass_count: passCount,
    warn_count: warnCount,
    fail_count: failCount,
    remediation,
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
