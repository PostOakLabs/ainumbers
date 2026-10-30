# EMV MPM QR Payload Validator

Decodes and validates an EMV merchant-presented-mode (MPM) QR payload against a pluggable national scheme profile - generic EMV MPM, Fiji FJQR, or Brazil Pix BR Code - covering TLV structure, duplicate and trailing-object detection, the CRC-16/CCITT-FALSE checksum over the payload including the literal 6304 (with a dedicated rule for the common generator bug that excludes it), point-of-initiation static versus dynamic semantics, merchant-account templates 26-51 and their globally unique identifiers, MCC, ISO 4217 currency, amount and tip/convenience consistency, merchant name and city presence and length, additional-data subfield structure, and for Pix dynamic payloads the location-URL shape and the JWS protected-header skeleton (alg allowed set, kid, jku) without any signature verification. Zero network and zero PII echo: merchant name, city, postal, additional-data values and account identifiers are reported as tag/length/verdict only, never echoed; a dynamic payload URL is never fetched. Exclusions: no signature or key verification, no QR image decoding (payload string only), no scheme-operator endorsement implied; the FJQR profile cannot verify scheme-specific account GUIDs because the FJQR technical specification's GUI registry is not public (advisory only).

- Page: https://ainumbers.co/chaingraph/783-emv-mpm-qr-validator.html
- Markdown twin: https://ainumbers.co/chaingraph/783-emv-mpm-qr-validator.md
- MCP tool: validate_emv_mpm_qr_payload (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- payload (string, required): The EMV merchant-presented QR payload string. Synthetic payloads only; merchant-bearing values are never echoed back.
- profile (string, required): Scheme profile to validate against: generic EMV MPM, Fiji FJQR, or Brazil Pix BR Code.
- expect (string, optional): Optional assertion on the derived mode.
- dynamic_envelope (object, optional): Optional JWS protected-header skeleton (alg, typ, kid, jku) for a Pix dynamic payload. Shape check only.

## Outputs

- crc (object, required)
- errors (array, required)
- mode (string,null, required)
- profile (string, required)
- refused (object, optional)
- rules_checked (number, required)
- tags (array, required)
- valid (boolean, required)
- violations (array, required)
- warnings (array, required)

## Sample

```json
{
  "payload": "00020101021126390021com.example.synthetic0110ACCT0001115204599953038405802US5918SYNTHETIC MERCHANT6009TESTVILLE62100506TX00016304FFA6",
  "profile": "generic",
  "expect": "static"
}
```

## Verify

Run the sample policy_parameters through MCP tool `validate_emv_mpm_qr_payload` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
