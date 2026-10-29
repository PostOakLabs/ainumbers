# EMV MPM QR Payload Validator

Decodes and validates an EMV merchant-presented QR payload against a pluggable national scheme profile: generic EMV MPM, Fiji FJQR, or Brazil Pix BR Code. TLV structure, CRC-16 over the payload including the 6304 literal, static versus dynamic rules, scheme-mandatory tags, and the signed dynamic-payload envelope shape. Merchant-bearing values are never echoed; no URL is ever fetched; no signature is verified.

- Page: https://ainumbers.co/chaingraph/783-emv-mpm-qr-validator.html
- Markdown twin: https://ainumbers.co/chaingraph/783-emv-mpm-qr-validator.md
- MCP tool: validate_emv_mpm_qr_payload (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- payload (string, required): The EMV merchant-presented QR payload string. Synthetic payloads only: merchant names, cities, additional-data values and account identifiers are never echoed back.
- profile (string, required): Scheme profile to validate against: generic EMV MPM, Fiji FJQR (currency FJD 242, static launch scope), or Brazil Pix BR Code (GUI br.gov.bcb.pix, currency BRL 986, country BR, txid mandatory, dynamic location shape and JWS envelope skeleton).
- expect (string, optional): Optional assertion on the derived mode (static or dynamic). A mismatch with the payload tag 01 value is reported as a violation.
- dynamic_envelope (object, optional): JWS protected-header skeleton for a Pix dynamic payload: alg (prohibited HS-family and none; allowed RS256-or-higher and ES256-or-higher; recommended PS256 or PS512), typ, kid, jku. Shape check only: no signature verification, no key material, the jku URL is never fetched.

## Outputs

- valid (boolean): true when no error-severity violation fired.
- profile (string): the profile the payload was validated under.
- mode (string): static or dynamic, derived from tag 01.
- tags (array): parse-order tag rows as {tag, length, verdict, value}; value appears only for echo-safe structural tags (00, 01, 52, 53, 54, 58, 63) and template GUIDs. Merchant name (59), city (60), postal (61), additional-data subfields (62.xx), alternate-language fields (64.xx), and account identifiers are reported as tag, length, verdict only.
- violations (array): {tag_path, rule_id, source, severity} sorted for determinism; severity is error or advisory and only errors flip valid.
- crc (object): expected and found CRC-16/CCITT-FALSE hex; expected is computed over the payload including the literal 6304, and a value that matches only the CRC computed without 6304 is flagged as the CRC_EXCLUDED_6304_LITERAL generator bug.
- rules_checked (integer): number of rule applications evaluated.
- refused (object): present only when the input class itself is refused (non-string or empty payload, payload over 2048 characters, unknown profile, invalid expect, non-object envelope).

## Pinned primary texts

- EMVCo QR Code Specification for Payment Systems, Merchant-Presented Mode, v1.1 (November 2020).
- Reserve Bank of Fiji, Guidelines on Participation in the Fiji Quick Response Code Scheme (19 May 2026).
- Banco Central do Brasil, BR Code Manual v2.0.0 (English) and Manual de Padrões para Iniciação do Pix.
- Banco Central do Brasil, Manual de Segurança do SFN, Volume II, v6.00.

Pinned with sha256 under research/clause-snapshots/emv-mpm-qr/ on the project board; the rule-to-source map is in the pin note. EMVCo terms permit implementation and restrict reproduction: field semantics implemented, no spec text reproduced.

## Add a scheme profile

One engine, profiles as data. The three shipped profiles live as a JSON data file beside the kernel (chaingraph/kernels/fixtures/783-emv-mpm-qr-validator.profiles.json), mirrored inside the kernel with a property test holding the two equal. PromptPay, DuitNow, QRIS, PayNow or SGQR, KHQR, QR Ph, VietQR, and UPI's EMV form are all EMV MPM derivatives: a new country is a profile entry that pins its currency, country code, recognised account-template GUIDs, transaction-identifier requirement, and static or dynamic mode rules.

## Scope notes

- Zero network: a dynamic payload location URL is never fetched; only its shape is checked.
- No signature verification and no key material.
- Fixtures are synthetic merchants only; no published specimen payload is reproduced.
- Independent conformance utility: names no scheme operator official and implies no endorsement by EMVCo, any central bank, or the World Bank.
