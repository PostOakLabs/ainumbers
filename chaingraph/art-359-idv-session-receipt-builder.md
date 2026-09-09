# IDV/KYC Session Evidence Receipt Builder

Hash-chains an identity-verification (IDV/KYC) session's declared results into a tamper-evident session receipt, per attempt: session metadata (verifier identity + version, timestamp), capture-chain attestation (C2PA manifest digest if present), injection-detection verdict, liveness verdict, document-check digest, and device-signal summary. Every verifier-sourced field is labeled asserted: this kernel attests the session record as declared, not detection quality or subject genuineness. Zero PII by construction: consumes only digests, booleans, and scores, and rejects any raw-data-shaped input (images, biometric templates) before compute proceeds.

- Page: https://ainumbers.co/chaingraph/art-359-idv-session-receipt-builder.html
- Markdown twin: https://ainumbers.co/chaingraph/art-359-idv-session-receipt-builder.md
- MCP tool: build_idv_session_receipt (endpoint https://mcp.ainumbers.co/mcp)

## Sample

```json
{
  "session_id": "sess-2026-0001",
  "verifier_id": "vendor-alpha-idv",
  "verifier_version": "3.2.1",
  "timestamp": "2026-07-18T09:00:00Z",
  "capture_chain": {
    "manifest_digest": "sha256:aa11aa11aa11aa11aa11aa11aa11aa11aa11aa11aa11aa11aa11aa11aa11aa1"
  },
  "injection_detection": {
    "vendor": "DetectCo",
    "vendor_version": "1.4.0",
    "verdict": false,
    "confidence": 0.97
  },
  "liveness": {
    "method": "active-challenge",
    "verdict": true,
    "score": 0.94
  },
  "document_check": {
    "digest": "sha256:bb22bb22bb22bb22bb22bb22bb22bb22bb22bb22bb22bb22bb22bb22bb22bb2",
    "verdict": true
  },
  "device_signal": {
    "summary": "consistent-device-fingerprint",
    "risk_score": 0.05
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `build_idv_session_receipt` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
