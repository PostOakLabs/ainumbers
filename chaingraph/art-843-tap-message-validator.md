# TAP Message Structure Check

Checks that a pasted Transaction Authorization Protocol message, or a short thread of them, has the structure the published TAIPs JSON Schemas describe. Covered types: Transfer, Payment, Authorize, Reject, Settle, Cancel and Revert; every other type is reported as not covered and never as valid. For each message it reports the type and schema matched, missing required fields, wrong field types and formats, extra fields (flagged where the schema forbids them), party and agent shape problems (identifiers only, never names), the byte length a party name hash decodes to, and whether signature material is present. For a thread it reports replies whose thread id names no earlier message in the paste, reply-type messages with no thread id, and repeated message ids. Free-text leaves and party or agent personal fields must hold the literal SYNTHETIC or a length marker, an IVMS101 object may carry only code-list leaves or those markers, and any other leaf is refused. Subtrees whose schemas are not pinned (policies, constraints, invoice objects, attachments) are refused rather than skipped. It does not verify signatures, does not resolve identifiers, does not contact any counterparty, makes no claim of interoperability or certification, and is not a statement that a transfer is compliant. The executionHash follows the OCG SPEC.md section 4 JCS rule and the compute-integrity proof position follows SPEC.md section 18.

- Page: https://ainumbers.co/chaingraph/art-843-tap-message-validator.html
- Markdown twin: https://ainumbers.co/chaingraph/art-843-tap-message-validator.md
- MCP tool: validate_tap_message (endpoint https://mcp.ainumbers.co/mcp)

## Sample

```json
{
  "messages": [
    {
      "id": "599f7220-6149-4c45-adbb-86d96c8e0608",
      "type": "https://tap.rsvp/schema/1.0#Transfer",
      "from": "did:web:originator.vasp",
      "to": [
        "did:web:beneficiary.vasp"
      ],
      "created_time": "2026-11-13T10:00:00Z",
      "body": {
        "asset": "eip155:1/slip44:60",
        "amount": "1.23",
        "settlementAddress": "eip155:1:0x1234a96D359eC26a11e2C2b3d8f8B8942d5Bfcdb",
        "originator": {
          "@id": "did:web:originator.vasp"
        },
        "beneficiary": {
          "@id": "did:web:beneficiary.vasp"
        },
        "agents": [
          {
            "@id": "did:web:originator.vasp",
            "role": "Originator",
            "for": "did:web:originator.vasp"
          }
        ]
      }
    },
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "from": "did:web:beneficiary.vasp",
      "type": "https://tap.rsvp/schema/1.0#Authorize",
      "thid": "599f7220-6149-4c45-adbb-86d96c8e0608",
      "to": [
        "did:web:originator.vasp"
      ],
      "body": {
        "@context": "https://tap.rsvp/schema/1.0",
        "@type": "https://tap.rsvp/schema/1.0#Authorize",
        "settlementAddress": "payto://iban/DE75512108001245126199",
        "expiry": "2024-01-01T12:00:00Z"
      }
    },
    {
      "id": "770e8400-e29b-41d4-a716-446655440002",
      "from": "did:web:originator.vasp",
      "type": "https://tap.rsvp/schema/1.0#Settle",
      "thid": "599f7220-6149-4c45-adbb-86d96c8e0608",
      "to": [
        "did:web:beneficiary.vasp"
      ],
      "body": {
        "@context": "https://tap.rsvp/schema/1.0",
        "@type": "https://tap.rsvp/schema/1.0#Settle",
        "settlementAddress": "eip155:1:0x1234a96D359eC26a11e2C2b3d8f8B8942d5Bfcdb",
        "settlementId": "eip155:1:tx/0x3edb98c24d46d148eb926c714f4fbaa117c47b0c0821f38bfce9763604457c33",
        "amount": "100.00"
      }
    },
    {
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "from": "did:web:beneficiary.vasp",
      "type": "https://tap.rsvp/schema/1.0#Revert",
      "thid": "599f7220-6149-4c45-adbb-86d96c8e0608",
      "to": [
        "did:web:originator.vasp"
      ],
      "body": {
        "@context": "https://tap.rsvp/schema/1.0",
        "@type": "https://tap.rsvp/schema/1.0#Revert",
        "settlementAddress": "payto://iban/DE75512108001245126199",
        "reason": "SYNTHETIC"
      }
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `validate_tap_message` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
