# ETR Singularity & Exclusive-Control Evidence Checker

Checks a supplied electronic transferable record (ETR/eBL) document digest and control-assertion set (platform identity, singularity assertion, control-transfer events with timestamps and signatures as supplied) against MLETR Art. 10/11 functional-equivalence elements: integrity ref, singularity assertion present, control chain continuous, no overlapping-control intervals. Walks the supplied event log as a single chain of custody and flags any event that does not extend it as an overlapping/unknown-party control claim - pure interval/chain math over the evidence as presented, not a legal opinion or registry attestation of which copy is authoritative. For general eBL/MLETR functional-equivalence self-assessment scoring use validate_mletr_record (art-53); this tool verifies a concrete supplied control-transfer event log for singularity/exclusivity specifically.

- Page: https://ainumbers.co/chaingraph/art-352-etr-control-evidence-checker.html
- Markdown twin: https://ainumbers.co/chaingraph/art-352-etr-control-evidence-checker.md
- MCP tool: check_etr_control_evidence (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- control_events (unknown, optional)
- document_digest (unknown, optional)
- original_holder (unknown, optional)
- platform_identity (unknown, optional)
- singularity_assertion (unknown, optional)

## Outputs

- chain_summary (object, optional)
- document_digest (string, optional)
- element_checklist (object, optional)
- malformed_events (array, optional)
- note (string, optional)
- overall_verdict (string, optional)
- platform_identity (string, optional)

## Sample

```json
{
  "document_digest": "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "platform_identity": "AcmeChain eBL Registry",
  "singularity_assertion": true,
  "original_holder": "Carrier-A",
  "control_events": [
    {
      "event_id": "e1",
      "from_holder": "Carrier-A",
      "to_holder": "Bank-B",
      "epoch_ms": 1000,
      "signature_present": true
    },
    {
      "event_id": "e2",
      "from_holder": "Bank-B",
      "to_holder": "Buyer-C",
      "epoch_ms": 2000,
      "signature_present": true
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `check_etr_control_evidence` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
