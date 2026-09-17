# CASS 15 Safeguarding Audit Evidence Pack

Assembles the evidence set a qualified auditor asks a UK payment or e-money firm for at the start of a CASS 15 safeguarding audit: the reconciliation results across the declared audit period, the safeguarding method classification, a schedule of the matters those raise keyed by the individual rule reference with a management response recorded against each item, and the section 27 accountability trail over the firm's own reconciliation export. It is the first consumer of the section 27.4 attested-artifact subject class: the export is a non-OCG producer's sealed output, so its subject identifier is computed by art-502-bind-attested-subject and echoed here verbatim rather than recomputed, because a second implementation of that preimage would be a second canon. The trail counts distinct identities, never records and never signing keys; an unsigned approval record is not conformant evidence and holds the role rather than passing it; an agent identity does not satisfy a human role absent an explicit human-role mandate; and because this surface reads no clock a time-boxed override can never resolve to a silent auto-pass. Stated limit, normative: the attested subject evidences producer pinning, input binding and content integrity, never that the arithmetic inside the firm's export is correct, and the artifact omits replay_verified entirely rather than setting it false because no replay was attempted. This pack expresses neither of the two audit opinions, systems adequacy throughout the period and compliance at the period end, which belong to the safeguarding auditor and are emitted as open slots naming who decides. It records no breach, it is evidence assembled for the engagement rather than a filing, it is not submittable to the FCA, and it does not discharge the audit.

- Page: https://ainumbers.co/chaingraph/art-501-build-safeguarding-audit-evidence.html
- Markdown twin: https://ainumbers.co/chaingraph/art-501-build-safeguarding-audit-evidence.md
- MCP tool: build_safeguarding_audit_evidence (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- accountability_records (unknown, required)
- attested_subject (unknown, required)
- audit_period (unknown, required)
- firm_ref (unknown, required)
- management_responses (unknown, required)
- method_classification (unknown, required)
- reconciliation_results (unknown, required)

## Outputs

- accountability_trail (object, optional)
- audit_period (object, optional)
- auditor_opinions (array, optional)
- citations (object, optional)
- evidence_items (array, optional)
- exception_count (integer, optional)
- exception_schedule (array, optional)
- firm_ref (string, optional)
- method_summary (object, optional)
- minor_unit_exponent (integer, optional)
- missing_items (array, optional)
- no_arithmetic_claim (string, optional)
- not_a_filing (string, optional)
- note (string, optional)
- pack_complete (boolean, optional)
- rationale (array, optional)
- reconciliation_summary (object, optional)
- report_vocabulary (object, optional)
- ruleset (object, optional)
- subject (object, optional)

## Sample

```json
{
  "firm_ref": "FIRM-SYNTH-0001",
  "audit_period": {
    "start_date": "2026-05-07",
    "end_date": "2027-05-06"
  },
  "attested_subject": {
    "subject_hash": "sha256:1111111111111111111111111111111111111111111111111111111111111111",
    "subject_preimage": {
      "tool_ref": {
        "tool_id": "acme-safeguarding-recon",
        "tool_version": "4.2.0",
        "entry": "buildSafeguardingRecon",
        "manifest_digest": "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
      },
      "inputs_digest": "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      "artifact": {
        "content_type": "application/pdf",
        "content_digest": "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
      }
    },
    "producer_pinned": true,
    "binding_complete": true,
    "inputs_digest_source": "derived"
  },
  "reconciliation_results": [
    {
      "entry_ref": "RECON-2026-06-30",
      "as_of_date": "2026-06-30",
      "reconciliation_type": "internal",
      "verdict": "reconciled",
      "difference_direction": "level",
      "difference_display": "0.00",
      "safeguarding_requirement_display": "1250000.00",
      "safeguarding_resource_display": "1250000.00",
      "currency": "GBP"
    },
    {
      "entry_ref": "RECON-2026-09-30",
      "as_of_date": "2026-09-30",
      "reconciliation_type": "internal",
      "verdict": "reconciled",
      "difference_direction": "level",
      "difference_display": "0.00",
      "safeguarding_requirement_display": "1310000.00",
      "safeguarding_resource_display": "1310000.00",
      "currency": "GBP"
    },
    {
      "entry_ref": "RECON-2026-12-31",
      "as_of_date": "2026-12-31",
      "reconciliation_type": "external",
      "verdict": "reconciled",
      "difference_direction": "level",
      "difference_display": "0.00",
      "safeguarding_requirement_display": "1402500.00",
      "safeguarding_resource_display": "1402500.00",
      "currency": "GBP"
    }
  ],
  "method_classification": {
    "classification_verdict": "COHERENT_ON_SUPPLIED_FACTS",
    "stream_count": 2,
    "coherent_count": 2,
    "incoherent_count": 0,
    "open_judgment_count": 0,
    "audit_exemption_indicator": {
      "outcome": "audit_required",
      "basis": "Relevant funds held exceed the exemption level."
    },
    "determinations": [
      {
        "stream_ref": "STREAM-SYNTH-A",
        "funds_category": "payment_service_relevant_funds",
        "method_asserted": "segregation",
        "relevant_funds_determination": {
          "outcome": "relevant",
          "basis": "Declared as payment_service_relevant_funds.",
          "citation_id": null
        },
        "method_coherence": "coherent",
        "method_findings": []
      },
      {
        "stream_ref": "STREAM-SYNTH-B",
        "funds_category": "emoney_relevant_funds",
        "method_asserted": "segregation",
        "relevant_funds_determination": {
          "outcome": "relevant",
          "basis": "Declared as emoney_relevant_funds.",
          "citation_id": null
        },
        "method_coherence": "coherent",
        "method_findings": []
      }
    ]
  },
  "accountability_records": [
    {
      "record_type": "approval",
      "role": "preparer",
      "subject_hash": "sha256:1111111111111111111111111111111111111111111111111111111111111111",
      "identity": {
        "id": "did:key:zPreparerSynth1",
        "actor_type": "human"
      },
      "decision": "prepared",
      "timestamp": "2027-05-20T09:00:00Z",
      "audit_signature": {
        "proof": {
          "type": "DataIntegrityProof",
          "cryptosuite": "eddsa-jcs-2022",
          "proofPurpose": "assertionMethod",
          "verificationMethod": "did:key:zPreparerSynth1#zPreparerSynth1",
          "proofValue": "zSYNTHETICPREPARERSIGNATURE"
        }
      }
    },
    {
      "record_type": "approval",
      "role": "reviewer",
      "subject_hash": "sha256:1111111111111111111111111111111111111111111111111111111111111111",
      "identity": {
        "id": "did:key:zAuditorSynth1",
        "actor_type": "human"
      },
      "decision": "reviewed",
      "timestamp": "2027-05-21T14:30:00Z",
      "audit_signature": {
        "proof": {
          "type": "DataIntegrityProof",
          "cryptosuite": "eddsa-jcs-2022",
          "proofPurpose": "assertionMethod",
          "verificationMethod": "did:key:zAuditorSynth1#zAuditorSynth1",
          "proofValue": "zSYNTHETICAUDITORSIGNATURE"
        }
      }
    },
    {
      "record_type": "approval",
      "role": "approver",
      "subject_hash": "sha256:1111111111111111111111111111111111111111111111111111111111111111",
      "identity": {
        "id": "did:key:zApproverSynth1",
        "actor_type": "human"
      },
      "decision": "approved",
      "timestamp": "2027-05-22T11:15:00Z",
      "audit_signature": {
        "proof": {
          "type": "DataIntegrityProof",
          "cryptosuite": "eddsa-jcs-2022",
          "proofPurpose": "assertionMethod",
          "verificationMethod": "did:key:zApproverSynth1#zApproverSynth1",
          "proofValue": "zSYNTHETICAPPROVERSIGNATURE"
        }
      }
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `build_safeguarding_audit_evidence` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
