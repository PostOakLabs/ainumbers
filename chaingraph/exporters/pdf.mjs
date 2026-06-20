// exporters/pdf.mjs — chaingraph_export:pdf (OCG Standard §13.6).
// Dependency-free, Workers-safe PDF writer. Board/audit one-pager (paginates if
// long): verdict headline, key output_payload fields, and a provenance footer
// carrying execution_hash + verify URL. Static template selected per mandate_type
// so output is reproducible artifact-to-artifact.
//
// Reference implementation: single Helvetica/Helvetica-Bold Type1 font, WinAnsi,
// Letter page. QR of the verify_url is a TODO (needs a QR encoder) — the URL is
// rendered as text for now. Harden before GA.

import { metaBlock, exportFilename, flattenPayload } from './_meta.mjs';
import { qrMatrix } from './qr.mjs';

const MEDIA_TYPE = 'application/pdf';

// Per-mandate_type memo titles (OCG §13.6 "static template per mandate_type").
const TITLES = {
  agent_guardrail_mandate: 'Readiness Diagnostic',
  treasury_mandate:        'Treasury Decision Memo',
  risk_parameter:          'Risk / Margin Estimate',
  compliance_mandate:      'Compliance Determination',
  attestation_mandate:     'Attestation',
  settlement_mandate:      'Settlement Decision',
  capital_assessment:      'Capital Assessment',
  liquidity_mandate:       'Liquidity Assessment',
  collateral_mandate:      'Collateral Eligibility',
  cryptographic_mandate:   'Cryptographic Verification',
  'party-identification':  'Party Identification',
  payment_mandate:         'Payment Mandate',
  risk_control:            'Risk Control',
  model_governance:        'Model Governance',
  infrastructure_mandate:  'Infrastructure Decision',
};

const PAGE_W = 612, PAGE_H = 792, X_LEFT = 72, Y_TOP = 750, Y_BOTTOM = 60, USABLE_W = PAGE_W - 2 * X_LEFT;

// --- text helpers ---------------------------------------------------------
const SUBS = { '—': '-', '–': '-', '‘': "'", '’': "'", '“': '"', '”': '"', '…': '...', '·': '*', '→': '->' };
function asciiSafe(s) {
  let out = '';
  for (const ch of String(s ?? '')) {
    if (SUBS[ch]) out += SUBS[ch];
    else out += ch.codePointAt(0) <= 0xFF ? ch : '?';   // Latin-1 / WinAnsi safe
  }
  return out;
}
function escapePdf(s) { return asciiSafe(s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)'); }

// Approximate character wrap (no font metrics): Helvetica avg width ~0.5em.
function wrap(text, size) {
  const max = Math.max(8, Math.floor(USABLE_W / (size * 0.5)));
  const words = asciiSafe(text).split(/\s+/);
  const lines = [];
  let cur = '';
  for (const w of words) {
    if (!cur) { cur = w; }
    else if ((cur + ' ' + w).length <= max) { cur += ' ' + w; }
    else { lines.push(cur); cur = w; }
    while (cur.length > max) { lines.push(cur.slice(0, max)); cur = cur.slice(max); } // hard-break long tokens (hashes)
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [''];
}

// --- content model --------------------------------------------------------
function layoutLines(artifact) {
  const m = metaBlock(artifact);
  const op = artifact?.output_payload ?? {};
  const mt = artifact?.mandate_type ?? '';
  const title = TITLES[mt] || 'OpenChainGraph Decision Memo';
  const verdict = op.verdict ?? op.grade ?? op.overall_grade ?? op.recommended_model ?? op.verdict_label ?? '(see Key results)';

  const L = [];
  const push = (text, { bold = false, size = 9 } = {}) => {
    for (const ln of wrap(text, size)) L.push({ text: ln, bold, size });
  };
  const spacer = (size = 6) => L.push({ text: '', bold: false, size });

  push(title, { bold: true, size: 18 });
  push(`Tool: ${m.tool_id}`, { size: 9 });
  push(`Mandate type: ${mt || '(none)'}`, { size: 9 });
  spacer();
  push(`Decision: ${verdict}`, { bold: true, size: 13 });

  spacer();
  push('Key results', { bold: true, size: 11 });
  const { scalars } = flattenPayload(op);
  for (const [k, v] of scalars.slice(0, 30)) push(`${k}: ${v}`, { size: 9 });
  if (scalars.length > 30) push(`... (${scalars.length - 30} more fields in the xlsx/json)`, { size: 8 });

  const flags = artifact?.compliance_flags ?? [];
  if (flags.length) { spacer(); push('Compliance flags', { bold: true, size: 11 }); push(flags.join(', '), { size: 9 }); }

  spacer(8);
  push('Provenance', { bold: true, size: 11 });
  push(`execution_hash: ${m.execution_hash}`, { size: 8 });
  push(`chaingraph_version: ${m.chaingraph_version}    compute_mode: ${m.compute_mode}`, { size: 8 });
  push(`signing keyid: ${m.keyid || '(unsigned)'}`, { size: 8 });
  push(`verify: ${m.verify_url}`, { size: 8 });
  spacer(8);
  push('This PDF is a generated view of a verified artifact (OCG Standard §13). It is not independently verifiable - verify the JSON artifact at the URL above.', { size: 8 });
  return L;
}

function paginate(lines) {
  const pages = [];
  let cur = [], y = Y_TOP;
  for (const ln of lines) {
    const lead = Math.max(ln.size, 8) * 1.6;
    if (y - lead < Y_BOTTOM) { pages.push(cur); cur = []; y = Y_TOP; }
    y -= lead;
    cur.push({ ...ln, x: X_LEFT, y: Math.round(y) });
  }
  if (cur.length) pages.push(cur);
  return pages.length ? pages : [[]];
}

function pageContent(pageLines) {
  let s = '';
  for (const ln of pageLines) {
    const f = ln.bold ? 'F2' : 'F1';
    s += `BT /${f} ${ln.size} Tf 1 0 0 1 ${ln.x} ${ln.y} Tm (${escapePdf(ln.text)}) Tj ET\n`;
  }
  return s;
}

// Top-right QR of the verify_url, drawn as filled module squares. Additive — the
// verify URL is also printed as text, so a non-scanning QR never loses information.
function qrOps(artifact) {
  const url = metaBlock(artifact).verify_url;
  if (!url) return '';
  let mat;
  try { mat = qrMatrix(url); } catch { return ''; } // too long / encode error → skip QR
  const ms = 2.3, n = mat.size;
  const x0 = PAGE_W - X_LEFT - n * ms;     // right-aligned in the right margin
  const yTop = Y_TOP - 4;                   // just below the top margin
  let s = `BT /F1 7 Tf 1 0 0 1 ${x0.toFixed(2)} ${(yTop + 8).toFixed(2)} Tm (${escapePdf('Scan to verify')}) Tj ET\n0 0 0 rg\n`;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    if (!mat.modules[i][j]) continue;
    const x = x0 + j * ms, y = yTop - (i + 1) * ms;
    s += `${x.toFixed(2)} ${y.toFixed(2)} ${ms} ${ms} re\n`;
  }
  return s + 'f\n';
}

// Latin-1 byte encoder (every char already guaranteed <= 0xFF by asciiSafe / structure).
function latin1Bytes(str) {
  const out = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) out[i] = str.charCodeAt(i) & 0xFF;
  return out;
}

/** buildPdf(artifact) -> { bytes, filename, media_type } */
export function buildPdf(artifact) {
  const pages = paginate(layoutLines(artifact));

  // Object plan: 1 Catalog, 2 Pages, 3 Font(reg), 4 Font(bold), then per page: content + page obj.
  const all = [];
  all[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  all[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
  all[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';

  let objNum = 5;
  const pageRefs = [];
  let pageIdx = 0;
  for (const pl of pages) {
    const contentNum = objNum++, pageNum = objNum++;
    let stream = pageContent(pl);
    // QR DISABLED (deferred — see PUNCHLIST). The hand-rolled qr.mjs doesn't reliably
    // scan yet; the verify URL is printed as text in the provenance block, so nothing
    // is lost. Re-enable by restoring: if (pageIdx === 0) stream += qrOps(artifact);
    pageIdx++;
    all[contentNum] = `<< /Length ${stream.length} >>\nstream\n${stream}endstream`;
    all[pageNum] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] ` +
      `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentNum} 0 R >>`;
    pageRefs.push(pageNum);
  }
  all[2] = `<< /Type /Pages /Kids [${pageRefs.map((n) => `${n} 0 R`).join(' ')}] /Count ${pageRefs.length} >>`;

  const N = all.length - 1;
  let pdf = '%PDF-1.4\n%ÿÿÿÿ\n';
  const offsets = [];
  for (let i = 1; i <= N; i++) {
    offsets[i] = pdf.length;                 // 1 char == 1 byte (all Latin-1)
    pdf += `${i} 0 obj\n${all[i]}\nendobj\n`;
  }
  const xref = pdf.length;
  pdf += `xref\n0 ${N + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= N; i++) pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${N + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;

  return { bytes: latin1Bytes(pdf), filename: exportFilename(artifact, 'pdf'), media_type: MEDIA_TYPE };
}
