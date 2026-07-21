// Shared CSV-injection sanitization (WORKBOOK-1-BUILD-SPEC.md §WB-5).
// SINGLE SOURCE OF TRUTH for the OWASP CSV-injection prefix rule, factored out
// of chaingraph/workbook/workbook.mjs so any CSV-emitting surface (workbook
// engine, Node-side kernels, future exporters) reuses one implementation
// instead of re-deriving the regex. Runs unchanged in browsers, Workers, and
// Node — no imports, same zero-dep posture as _hash.mjs.
//
// Rule (OWASP CSV Injection cheat sheet): a field whose first character is
// one of = + - @ TAB CR is a formula trigger in Excel/Sheets/LibreOffice even
// when the field is quoted — quoting alone does NOT neutralize it. Mitigation
// is to prefix such a field with a literal single quote before quoting.

const CSV_INJECTION_RE = /^[=+\-@\t\r]/;

// True if `raw` (stringified) would be interpreted as a formula by a
// spreadsheet importer unless prefixed.
export function isCsvInjectionRisk(raw) {
  const s = raw === null || raw === undefined ? '' : String(raw);
  return CSV_INJECTION_RE.test(s);
}

// Prefixes a dangerous leading character with `'` (OWASP mitigation). Safe
// fields pass through unchanged.
export function sanitizeCsvField(raw) {
  let s = raw === null || raw === undefined ? '' : String(raw);
  if (CSV_INJECTION_RE.test(s)) s = `'${s}`;
  return s;
}

// Full RFC 4180 field serialization: sanitize, then quote if the field needs
// it (contains a quote/comma/CR/LF, or was sanitized).
export function serializeCsvField(raw) {
  const wasRisk = isCsvInjectionRisk(raw);
  let s = sanitizeCsvField(raw);
  const mustQuote = wasRisk || /[",\r\n]/.test(s);
  if (mustQuote) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function serializeCsvRow(row) {
  return row.map(serializeCsvField).join(',');
}

export function serializeCsvRows(rows) {
  return rows.map(serializeCsvRow).join('\r\n') + '\r\n';
}
