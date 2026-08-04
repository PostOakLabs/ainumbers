// retention-profile.test.mjs — §20.3 retention & pruning profile GATE (SPEC.md §20.3, v0.8.18).
// Proves: a body-absent artifact behind a retained, witness-cosigned checkpoint reports the distinct
// `body-absent: anchored-hash-only` tier, never verified/failed (§20.3.2); a regulatory-N-years artifact
// pruned before its floor elapses MUST fail conformance (§20.3.3/§20.3.4); a fixture-class artifact is
// NEVER prune-eligible regardless of checkpoint state (§20.3.4); the top-level `retention_class` member
// (§20.3.0) is hash-EXCLUDED — byte-identical execution_hash with and without it; an artifact carrying no
// retention_class is treated as case-file, never transient (§20.3.4).
// Node 18+ (WebCrypto + node: builtins only — zero npm deps).
// Run:  node chaingraph/standard/retention-profile.test.mjs
import { cgCanon, canonicalPreimage, executionHash } from '../kernels/_hash.mjs';

let fail = 0;
const ok = (c, m) => { if (!c) { fail++; console.error('  ✗ ' + m); } else console.log('  ✓ ' + m); };

// ---- §20.3.4 retention-class table, expressed as pure logic (mirrors the NORMATIVE table) ------
const REGULATORY_YEARS = /^regulatory-([0-9]+)-years$/;

function retentionClassOf(artifact) {
  return artifact.retention_class ?? 'case-file'; // §20.3.4: absent -> case-file, never transient
}

// pruneEligible(artifact, hasCosignedCheckpoint, now) -> { eligible: bool, reason: string }
function pruneEligible(artifact, hasCosignedCheckpoint, now) {
  if (!hasCosignedCheckpoint) return { eligible: false, reason: 'no-retained-cosigned-checkpoint' }; // §20.3.1
  const rc = retentionClassOf(artifact);
  if (rc === 'fixture') return { eligible: false, reason: 'fixture-class-never' }; // §20.3.4
  if (rc === 'transient') return { eligible: true, reason: 'transient-anytime-behind-checkpoint' };
  if (rc === 'case-file') return { eligible: true, reason: 'case-file-best-effort' };
  const m = REGULATORY_YEARS.exec(rc);
  if (m) {
    const years = Number(m[1]);
    const floorMs = years * 365.25 * 24 * 3600 * 1000;
    const elapsed = now - Date.parse(artifact.generated_at);
    if (elapsed < floorMs) return { eligible: false, reason: 'regulatory-floor-not-elapsed' }; // §20.3.3
    return { eligible: true, reason: 'regulatory-floor-elapsed-best-effort' };
  }
  return { eligible: false, reason: 'unknown-retention-class' };
}

// ---- §20.3.2 verifier report tier: verified / failed / body-absent:anchored-hash-only -----------
function verifyReport(artifact, { bodyPresent, checkpoint }) {
  if (!bodyPresent) {
    if (!checkpoint || !checkpoint.retained || checkpoint.witnessCosignaturesValid < checkpoint.kOfN) {
      return { tier: 'unverifiable', reason: 'body-absent-and-no-valid-checkpoint' };
    }
    return { tier: 'body-absent: anchored-hash-only' }; // NEVER verified/failed
  }
  const recomputed = artifact._recomputedHashMatches !== false;
  return { tier: recomputed ? 'verified' : 'failed' };
}

// ---- Fixtures --------------------------------------------------------------------------------
const NOW = Date.parse('2026-08-04T00:00:00Z');
const cosignedCheckpoint = { retained: true, kOfN: 2, witnessCosignaturesValid: 3 };
const selfSignedCheckpoint = { retained: true, kOfN: 2, witnessCosignaturesValid: 0 }; // §20.3.3 self-signed != cosigned

// hash-only-survivor tier fixture
const transientArtifact = { retention_class: 'transient', generated_at: '2020-01-01T00:00:00Z' };
ok(verifyReport(transientArtifact, { bodyPresent: false, checkpoint: cosignedCheckpoint }).tier === 'body-absent: anchored-hash-only',
   '§20.3.2: body-absent + retained k-of-n cosigned checkpoint reports the hash-only-survivor tier');
ok(verifyReport(transientArtifact, { bodyPresent: false, checkpoint: selfSignedCheckpoint }).tier === 'unverifiable',
   '§20.3.3: a self-signed (not cosigned) checkpoint does NOT satisfy the precondition — reported unverifiable, not hash-only-survivor');
ok(verifyReport(transientArtifact, { bodyPresent: true }).tier === 'verified',
   'a body-present artifact still verifies/fails exactly as before v0.8.18 — the tier never fires when the body is present');
{
  const r1 = verifyReport(transientArtifact, { bodyPresent: false, checkpoint: cosignedCheckpoint });
  const r2 = verifyReport({ ...transientArtifact, _recomputedHashMatches: false }, { bodyPresent: false, checkpoint: cosignedCheckpoint });
  ok(r1.tier !== 'verified' && r1.tier !== 'failed' && r2.tier !== 'verified' && r2.tier !== 'failed',
     'hash-only-survivor NEVER collapses into verified or failed, regardless of what the (unknowable) body would have recomputed to');
}

// regulatory-floor-forbidden fixture: 6-year (17a-4) artifact, 2 years old
const regulatoryArtifact = { retention_class: 'regulatory-6-years', generated_at: '2024-08-04T00:00:00Z' };
{
  const r = pruneEligible(regulatoryArtifact, true, NOW);
  ok(r.eligible === false && r.reason === 'regulatory-floor-not-elapsed',
     '§20.3.3/§20.3.4: a regulatory-6-years artifact 2 years old, behind a cosigned checkpoint, is NOT prune-eligible');
}
{
  const agedArtifact = { retention_class: 'regulatory-6-years', generated_at: '2018-01-01T00:00:00Z' };
  const r = pruneEligible(agedArtifact, true, NOW);
  ok(r.eligible === true && r.reason === 'regulatory-floor-elapsed-best-effort',
     'once the regulatory floor elapses, the same class becomes best-effort prune-eligible (still requires a checkpoint)');
}
ok(pruneEligible(regulatoryArtifact, false, NOW).eligible === false,
   '§20.3.1: no retained cosigned checkpoint at all -> never eligible, regardless of retention_class or age');

// fixture-class-never fixture: even ancient + checkpointed, never eligible
const fixtureArtifact = { retention_class: 'fixture', generated_at: '2000-01-01T00:00:00Z' };
ok(pruneEligible(fixtureArtifact, true, NOW).eligible === false && pruneEligible(fixtureArtifact, true, NOW).reason === 'fixture-class-never',
   '§20.3.4: fixture-class is NEVER prune-eligible, even decades old and behind a valid cosigned checkpoint');

// transient fixture: eligible immediately once checkpointed
const freshTransient = { retention_class: 'transient', generated_at: NOW - 1000 };
ok(pruneEligible(freshTransient, true, NOW).eligible === true,
   '§20.3.4: transient is prune-eligible anytime once behind a cosigned checkpoint, regardless of age');

// absence -> case-file, never transient
const noClassArtifact = { generated_at: '2026-01-01T00:00:00Z' };
ok(retentionClassOf(noClassArtifact) === 'case-file',
   '§20.3.4: an artifact carrying no retention_class is treated as case-file, never as transient');

// ---- §20.3.0 THE HASH-EXCLUSION PROOF (non-vacuous — both halves, mirrors §PPH-1.2/§21.6.3) ----
const policy = { execution_backend: 'server', input_parameters: { estate_id: 'EST-RET-001' } };
const output = { pruned: false, checkpoint_ref: 'sha256:' + '9'.repeat(64) };
const baseHash = await executionHash(policy, output);

const withoutField = { tool_id: 'art-121-document-integrity-anchor', execution_hash: baseHash, chain: { parent_hashes: [], parent_tool_ids: [], chain_depth: 0 }, policy_parameters: policy, output_payload: output };
const withField = { ...withoutField, retention_class: 'regulatory-6-years' };

ok(JSON.stringify(cgCanon(withField)) !== JSON.stringify(cgCanon(withoutField)),
   'retention_class DOES change the artifact\'s canonical form (materially present — makes the next assertion non-vacuous)');
ok(canonicalPreimage(withField.policy_parameters, withField.output_payload)
   === canonicalPreimage(withoutField.policy_parameters, withoutField.output_payload),
   '§4 preimage is byte-identical with and without retention_class (it lives at the artifact top level, outside the preimage)');
ok(await executionHash(withField.policy_parameters, withField.output_payload) === baseHash,
   'execution_hash is byte-identical with and without retention_class (hash-EXCLUDED)');
ok(withField.execution_hash === withoutField.execution_hash,
   'the recorded execution_hash does not move when retention_class is added (additive: goldens stay pinned)');
ok(!('retention_class' in withoutField), 'an artifact omitting retention_class is unchanged (absence is conformant, never a defect)');

// ---- §20.3.0 distinctness from §23.4's per-attestation field of the same name -------------------
{
  const artifactWithBoth = {
    retention_class: 'transient', // §20.3.0 — artifact-body pruning eligibility
    input_attestations: [
      { pointer: '/policy_parameters/input_parameters/estate_id', freshness: { observed_at: '2026-08-01T00:00:00Z', freshness_class: 'static', retention_class: 'regulatory-6-years' } } // §23.4 — per-input value retention
    ]
  };
  ok(artifactWithBoth.retention_class !== artifactWithBoth.input_attestations[0].freshness.retention_class,
     '§20.3.0 top-level retention_class and §23.4 per-attestation freshness.retention_class are independent fields that MAY disagree on the same artifact — setting one never implies the other');
  const artifactAttestationOnly = { input_attestations: [{ pointer: '/x', freshness: { observed_at: '2026-08-01T00:00:00Z', freshness_class: 'static', retention_class: 'transient' } }] };
  ok(retentionClassOf(artifactAttestationOnly) === 'case-file',
     'an artifact with ONLY a §23.4 per-attestation retention_class (no top-level §20.3.0 field) is still treated as case-file for §20.3 purposes — the two fields are never conflated');
}

console.log(fail ? `\n${fail} failure(s).` : '\nAll §20.3 retention profile checks passed.');
process.exit(fail ? 1 : 0);
