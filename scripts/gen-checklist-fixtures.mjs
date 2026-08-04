#!/usr/bin/env node
// scripts/gen-checklist-fixtures.mjs — CHECKRUN-1 CR-5 fixture generator.
// One-off authoring tool (not a CI gate): builds the 3 seed checklist definitions
// as real, signed, digest-stamped JSON files under chaingraph/checklist-fixtures/.
// Uses the SAME canonical modules the browser tools inline (_hash.mjs / _proof.mjs /
// _checklist.mjs) so the fixtures are byte-real, not hand-typed placeholders.
import { writeFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateDefinition, definitionDigest } from '../chaingraph/kernels/_checklist.mjs';
import { sign, rawPubkeyToDidKey } from '../chaingraph/kernels/_proof.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, '..', 'chaingraph', 'checklist-fixtures');

async function signedDefinition(def) {
  const v = validateDefinition(def);
  if (!v.valid) throw new Error('fixture failed validation: ' + v.errors.join('; '));
  def.definition_digest = await definitionDigest(def);
  const kp = await crypto.subtle.generateKey('Ed25519', true, ['sign', 'verify']);
  const vm = await rawPubkeyToDidKey(kp.publicKey);
  const created = '2026-07-16T00:00:00.000Z';
  const signed = await sign(def, { verificationMethod: vm, created, privateKey: kp.privateKey });
  return signed;
}

const permitToWork = {
  definition_id: 'ckl-permit-to-work-ops-check',
  title: 'Permit-to-Work Ops Check',
  version: '1.0.0',
  source_citation: 'Facilities SOP pattern for isolating energy sources before maintenance work; generic across HSE permit-to-work frameworks.',
  mandate_hash: null,
  steps: [
    { step_id: 'isolate', title: 'Isolate the energy source', instruction: 'Lock out and tag the relevant panel or valve. Photograph the lock in place.', evidence_requirement: 'file-digest', approver_role: null, gate: 'blocking' },
    { step_id: 'zero-energy', title: 'Confirm zero energy state', instruction: 'Test with a calibrated meter and record the reading before anyone touches the equipment.', evidence_requirement: 'text', approver_role: 'site_supervisor', gate: 'blocking' },
    { step_id: 'brief-crew', title: 'Brief the work crew', instruction: 'Walk the crew through the scope, hazards, and stop-work authority before work starts.', evidence_requirement: 'text', approver_role: 'site_supervisor', gate: 'blocking' },
    { step_id: 'perform-work', title: 'Perform the work', instruction: 'Complete the maintenance task as scoped. Note any deviation from plan.', evidence_requirement: 'text', approver_role: null, gate: 'blocking' },
    { step_id: 'restore-and-log', title: 'Restore energy and log completion', instruction: 'Remove the lockout, restore power, and record who performed the work and when.', evidence_requirement: 'text', approver_role: null, gate: 'advisory' },
  ],
};

const soc2Evidence = {
  definition_id: 'ckl-soc2-evidence-collection',
  title: 'SOC 2 Evidence Collection Round',
  version: '1.0.0',
  source_citation: 'AICPA SOC 2 Trust Services Criteria evidence-gathering pattern for a single audit period.',
  mandate_hash: null,
  steps: [
    { step_id: 'access-review', title: 'Pull the quarterly access review', instruction: 'Export the access review report and confirm every terminated user was removed within SLA.', evidence_requirement: 'file-digest', approver_role: null, gate: 'blocking' },
    { step_id: 'change-mgmt-sample', title: 'Sample change management tickets', instruction: 'Select a sample of production changes and confirm each has an approval and a linked deployment record.', evidence_requirement: 'file-digest', approver_role: null, gate: 'blocking' },
    { step_id: 'vuln-scan', title: 'Confirm vulnerability scan cadence', instruction: 'Confirm scans ran on schedule for the period and high findings were remediated or risk-accepted.', evidence_requirement: 'text', approver_role: 'security_lead', gate: 'blocking' },
    { step_id: 'vendor-review', title: 'Confirm critical vendor reviews', instruction: 'Confirm each critical subprocessor has a current SOC 2 or equivalent report on file.', evidence_requirement: 'attestation', approver_role: 'security_lead', gate: 'advisory' },
    { step_id: 'package-evidence', title: 'Package the evidence bundle', instruction: 'Assemble the evidence set for the auditor and record the package hash for the audit trail.', evidence_requirement: 'file-digest', approver_role: null, gate: 'advisory' },
  ],
};

const disclosurePrep = {
  definition_id: 'ckl-stablecoin-issuer-disclosure-prep',
  title: 'Stablecoin Issuer Disclosure Prep',
  version: '1.0.0',
  source_citation: 'Reserve composition and redemption disclosure preparation pattern aligned with the GENIUS Act (US, 2025) permitted-issuer disclosure requirements.',
  mandate_hash: null,
  steps: [
    { step_id: 'reserve-attestation', title: 'Confirm the reserve attestation is current', instruction: 'Confirm the independent reserve attestation covers the disclosure period and reconciles to outstanding token supply.', evidence_requirement: 'file-digest', approver_role: 'compliance_officer', gate: 'blocking' },
    { step_id: 'redemption-policy-check', title: 'Confirm the redemption policy is published and unchanged', instruction: 'Confirm the public redemption policy matches the version reviewed by compliance, or log the change.', evidence_requirement: 'text', approver_role: 'compliance_officer', gate: 'blocking' },
    { step_id: 'reserve-composition-table', title: 'Prepare the reserve composition table', instruction: 'List reserve asset categories and percentages as required for the periodic disclosure.', evidence_requirement: 'file-digest', approver_role: null, gate: 'blocking' },
    { step_id: 'legal-sign-off', title: 'Legal sign-off on the disclosure draft', instruction: 'Route the draft disclosure to legal for review before publication.', evidence_requirement: 'attestation', approver_role: 'general_counsel', gate: 'blocking' },
    { step_id: 'publish', title: 'Publish the disclosure', instruction: 'Publish the disclosure to the designated channel and record the publication timestamp.', evidence_requirement: 'text', approver_role: null, gate: 'advisory' },
  ],
};

const exchangeListingStandards = {
  definition_id: 'ckl-exchange-listing-standards-baseline',
  title: 'Exchange Listing Standards Baseline',
  version: '1.0.0',
  source_citation: 'Generic quantitative/distribution/governance listing-standards criteria shape common across exchange listing rulebooks; numeric thresholds are venue-specific and caller-supplied, not embedded here.',
  mandate_hash: null,
  steps: [
    { step_id: 'min-market-cap', title: 'Confirm minimum market capitalization', instruction: 'Confirm measured market capitalization (USD millions) meets or exceeds the applicable minimum market cap threshold for this listing venue.', evidence_requirement: 'text', approver_role: null, gate: 'blocking' },
    { step_id: 'min-public-float', title: 'Confirm minimum public float', instruction: 'Confirm measured public float percentage meets or exceeds the applicable minimum public float threshold for this listing venue.', evidence_requirement: 'text', approver_role: null, gate: 'blocking' },
    { step_id: 'min-price', title: 'Confirm minimum price', instruction: 'Confirm measured price (USD) meets or exceeds the applicable minimum price threshold for this listing venue.', evidence_requirement: 'text', approver_role: null, gate: 'blocking' },
    { step_id: 'min-holders', title: 'Confirm minimum holder/distribution count', instruction: 'Confirm measured holder count meets or exceeds the applicable minimum holder count threshold for this listing venue.', evidence_requirement: 'text', approver_role: null, gate: 'blocking' },
    { step_id: 'independent-board-majority', title: 'Confirm independent board majority', instruction: 'Confirm the board has an independent-director majority as required by the applicable listing venue.', evidence_requirement: 'attestation', approver_role: 'listing_compliance_officer', gate: 'blocking' },
    { step_id: 'audit-committee', title: 'Confirm audit committee is present', instruction: 'Confirm an audit committee meeting the applicable listing venue\'s composition requirements is in place.', evidence_requirement: 'attestation', approver_role: 'listing_compliance_officer', gate: 'blocking' },
  ],
};

const fixtures = [
  ['permit-to-work-ops-check', permitToWork],
  ['soc2-evidence-collection', soc2Evidence],
  ['stablecoin-issuer-disclosure-prep', disclosurePrep],
  ['exchange-listing-standards-baseline', exchangeListingStandards],
];

for (const [slug, def] of fixtures) {
  const signed = await signedDefinition(def);
  const path = join(OUT, slug + '.checklist-definition.json');
  writeFileSync(path, JSON.stringify(signed, null, 2) + '\n');
  console.log('wrote', path);
}
