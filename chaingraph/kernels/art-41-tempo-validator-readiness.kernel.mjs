/**
 * art-41-tempo-validator-readiness.kernel.mjs
 * Tempo Validator Readiness Scorer — 12-Q / 5-dimension infrastructure diagnostic.
 * Pure decision kernel — no DOM, no window, no Date.now().
 */

export const meta = {
  tool_id:      'art-41-tempo-validator-readiness',
  mcp_name:     'score_tempo_validator_readiness',
  mandate_type: 'infrastructure_mandate',
  version:      '1.0.0',
};

const SCORE = { yes: 4, partial: 2, no: 0 };

// 5 dimensions: id → label, questions
const DIMS = [
  {
    id: 'hw',
    label: 'Hardware',
    questions: ['q1_cpu_cores', 'q2_ram_gb', 'q3_nvme_1gbps'],
  },
  {
    id: 'os',
    label: 'OS / Software',
    questions: ['q4_linux_glibc', 'q5_ntp_chrony', 'q6_ports_open'],
  },
  {
    id: 'key',
    label: 'Key Management',
    questions: ['q7_ed25519_keypair', 'q8_key_tempo_contact'],
  },
  {
    id: 'tel',
    label: 'Telemetry',
    questions: ['q9_port9000_scraping', 'q10_alerting'],
  },
  {
    id: 'upg',
    label: 'Upgrade Cadence',
    questions: ['q11_7day_sla', 'q12_runbook'],
  },
];

// Per-dimension max: 3 qs → 12pts, 2 qs → 8pts
const DIM_MAX = { hw: 12, os: 12, key: 8, tel: 8, upg: 8 };
const TOTAL_MAX = 48;

function grade(score) {
  if (score >= 40) return 'A';
  if (score >= 30) return 'B';
  if (score >= 20) return 'C';
  if (score >= 12) return 'D';
  return 'F';
}

export function compute(pp) {
  const dimResults = DIMS.map(dim => {
    const dimScore = dim.questions.reduce(
      (acc, q) => acc + (SCORE[pp[q] ?? 'no'] ?? 0),
      0
    );
    const dimMax = DIM_MAX[dim.id];
    return {
      id:    dim.id,
      label: dim.label,
      score: dimScore,
      max:   dimMax,
      pct:   Math.round((dimScore / dimMax) * 100),
    };
  });

  const totalScore = dimResults.reduce((a, d) => a + d.score, 0);
  const totalPct   = Math.round((totalScore / TOTAL_MAX) * 100);
  const overallGrade = grade(totalScore);

  // Mandatory notice if Tempo partner contact not confirmed
  const requiresPermissioningNotice = (pp.q8_key_tempo_contact ?? 'no') !== 'yes';

  const compliance_flags = [];
  if (overallGrade === 'A') {
    compliance_flags.push('VALIDATOR_READY');
  } else if (overallGrade === 'B') {
    compliance_flags.push('VALIDATOR_NEARLY_READY');
  } else if (overallGrade === 'C') {
    compliance_flags.push('VALIDATOR_PARTIAL_READINESS');
  } else {
    compliance_flags.push('VALIDATOR_NOT_READY');
  }
  if (requiresPermissioningNotice) {
    compliance_flags.push('TEMPO_PERMISSIONING_REQUIRED');
  }

  return {
    verdict:                    overallGrade,
    total_score:                totalScore,
    total_max:                  TOTAL_MAX,
    total_pct:                  totalPct,
    dim_results:                dimResults,
    requires_permissioning:     requiresPermissioningNotice,
    compliance_flags,
  };
}

export function buildArtifact(pp, opts = {}) {
  const r = compute(pp);
  return {
    tool_id:      meta.tool_id,
    mandate_type: meta.mandate_type,
    ...r,
    inputs: pp,
  };
}
