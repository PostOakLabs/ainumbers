/* ocg-verify-badge.js — embeddable OCG receipt verify badge (CI-VERIFY-BUILD-SPEC.md Part B).
   Single self-contained file. Zero network calls: no beacon, no analytics, no remote font/icon
   fetch. The only "network" action is a user-initiated top-level navigation via the optional
   deep-link button (same class of action as any <a href> on the host page).

   Verify math is copied byte-for-byte from tools/568-ocg-receipt-verifier.html's OCG-CORE v1 /
   RFC 6962 Merkle blocks (that page mirrors chaingraph/kernels/_hash.mjs + _proof.mjs +
   _anchor-testutil.mjs) — no new canonicalization, hash, or signature math lives here.

   Embed:
     <script src="/chaingraph/ocg-verify-badge.js" defer></script>
     <div data-ocg-verify data-ocg-receipt-ref="my-receipt-json"></div>
     <script type="application/json" id="my-receipt-json"> ...the OCG receipt... </script>

   The badge starts UNVERIFIED. Clicking it runs the verify in-page (no network call — the
   receipt bytes are already in the host page's DOM). A second "Full report" link, present once
   a receipt has been located, deep-links to tools/568-ocg-receipt-verifier.html using this site's
   existing AIN Bridge fragment convention (#in=<base64url-json>&run=1, see the AIN_BRIDGE_CFG
   block already shipped on every tool page) — never a query string, so the receipt payload never
   reaches a server log or referrer.
*/
(function () {
  'use strict';

  /* ── OCG-CORE v1 (verbatim port from tools/568-ocg-receipt-verifier.html) ───────────── */
  function assertIJson(v) {
    if (typeof v === 'number') {
      if (!Number.isFinite(v)) throw new Error('Non-finite number is not valid I-JSON.');
      if (Number.isInteger(v) && !Number.isSafeInteger(v)) throw new Error('Integer exceeds 2^53.');
    } else if (Array.isArray(v)) { v.forEach(assertIJson); }
    else if (v && typeof v === 'object') { for (var k in v) if (Object.prototype.hasOwnProperty.call(v, k)) assertIJson(v[k]); }
  }
  function cgCanon(v) {
    if (Array.isArray(v)) return v.map(cgCanon);
    if (v && typeof v === 'object') {
      var keys = Object.keys(v).sort(); var o = {};
      for (var i = 0; i < keys.length; i++) o[keys[i]] = cgCanon(v[keys[i]]);
      return o;
    }
    return v;
  }
  function canonicalPreimage(policy_parameters, output_payload) {
    var obj = { policy_parameters: policy_parameters, output_payload: output_payload };
    assertIJson(obj);
    return JSON.stringify(cgCanon(obj));
  }
  async function executionHash(policy_parameters, output_payload) {
    var bytes = new TextEncoder().encode(canonicalPreimage(policy_parameters, output_payload));
    var digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest)).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
  }
  function jcsBytes(obj) { return new TextEncoder().encode(JSON.stringify(cgCanon(obj))); }
  async function sha256(bytes) { var d = await crypto.subtle.digest('SHA-256', bytes); return new Uint8Array(d); }
  function hexToBytes(hex) {
    hex = String(hex || '');
    var b = new Uint8Array(hex.length / 2);
    for (var i = 0; i < b.length; i++) b[i] = parseInt(hex.substr(i * 2, 2), 16);
    return b;
  }
  function bytesToHex(b) { return Array.from(b).map(function (x) { return x.toString(16).padStart(2, '0'); }).join(''); }
  var B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  function b58decode(str) {
    var zeros = 0; while (zeros < str.length && str[zeros] === '1') zeros++;
    var bytes = [0];
    for (var i = zeros; i < str.length; i++) {
      var carry = B58.indexOf(str[i]); if (carry < 0) throw new Error('bad base58 char');
      for (var j = 0; j < bytes.length; j++) { carry += bytes[j] * 58; bytes[j] = carry & 0xff; carry >>= 8; }
      while (carry) { bytes.push(carry & 0xff); carry >>= 8; }
    }
    var out = new Uint8Array(zeros + bytes.length);
    for (var k = 0; k < bytes.length; k++) out[zeros + bytes.length - 1 - k] = bytes[k];
    return out;
  }
  async function didKeyToPublicKey(did) {
    if (!did || did.indexOf('did:key:z') !== 0) throw new Error('not a did:key z-form');
    var prefixed = b58decode(did.slice('did:key:z'.length));
    if (prefixed[0] !== 0xed || prefixed[1] !== 0x01) throw new Error('did:key is not Ed25519');
    var raw = prefixed.slice(2);
    return crypto.subtle.importKey('raw', raw, { name: 'Ed25519' }, true, ['verify']);
  }
  function proofOptions(o) {
    return { type: 'DataIntegrityProof', cryptosuite: 'eddsa-jcs-2022', verificationMethod: o.verificationMethod, proofPurpose: 'assertionMethod', created: o.created };
  }
  async function hashData(doc, opts) {
    var optHash = await sha256(jcsBytes(opts));
    var docHash = await sha256(jcsBytes(doc));
    var cat = new Uint8Array(optHash.length + docHash.length);
    cat.set(optHash, 0); cat.set(docHash, optHash.length);
    return cat;
  }
  function securedArtifact(a) {
    var c = JSON.parse(JSON.stringify(a));
    if (c && c.audit_signature && ('proof' in c.audit_signature)) delete c.audit_signature.proof;
    return c;
  }
  async function verifyOneProof(secured, proof) {
    if (!proof || proof.type !== 'DataIntegrityProof' || proof.cryptosuite !== 'eddsa-jcs-2022') return { valid: false, verificationMethod: proof && proof.verificationMethod, error: 'unsupported proof type/cryptosuite — only eddsa-jcs-2022 is verified' };
    if (proof.proofPurpose !== 'assertionMethod' || typeof proof.proofValue !== 'string' || proof.proofValue[0] !== 'z') return { valid: false, verificationMethod: proof.verificationMethod, error: 'malformed proof object' };
    try {
      var pub = await didKeyToPublicKey(proof.verificationMethod);
      var opts = proofOptions(proof);
      var sig = b58decode(proof.proofValue.slice(1));
      var ok = await crypto.subtle.verify('Ed25519', pub, sig, await hashData(secured, opts));
      return { valid: ok, verificationMethod: proof.verificationMethod, error: ok ? null : 'signature does not verify against the named key' };
    } catch (e) { return { valid: false, verificationMethod: proof.verificationMethod, error: e.message }; }
  }
  async function verifyArtifactProofs(artifact) {
    var raw = artifact && artifact.audit_signature && artifact.audit_signature.proof;
    var proofs = raw == null ? [] : (Array.isArray(raw) ? raw : [raw]);
    if (proofs.length === 0) return { present: false, allValid: true, results: [] };
    var secured = securedArtifact(artifact);
    var results = [];
    for (var i = 0; i < proofs.length; i++) results.push(await verifyOneProof(secured, proofs[i]));
    var allValid = results.every(function (r) { return r.valid; });
    return { present: true, allValid: allValid, results: results };
  }

  /* ── RFC 6962 Merkle inclusion (verbatim port) ───────────────────────────────────────── */
  function concatBytes(a, b) { var out = new Uint8Array(a.length + b.length); out.set(a, 0); out.set(b, a.length); return out; }
  async function leafHash(data) { return await sha256(concatBytes(new Uint8Array([0x00]), data)); }
  async function nodeHash(l, r) { return await sha256(concatBytes(new Uint8Array([0x01]), concatBytes(l, r))); }
  async function rootFromInclusion(leaf, index, size, path) {
    if (index >= size) return null;
    var fn = BigInt(index), sn = BigInt(size) - 1n;
    var r = leaf;
    for (var i = 0; i < path.length; i++) {
      var v = path[i];
      if (sn === 0n) return null;
      if ((fn & 1n) === 1n || fn === sn) {
        r = await nodeHash(v, r);
        if ((fn & 1n) === 0n) { while (fn !== 0n && (fn & 1n) === 0n) { fn >>= 1n; sn >>= 1n; } }
      } else {
        r = await nodeHash(r, v);
      }
      fn >>= 1n; sn >>= 1n;
    }
    return sn === 0n ? r : null;
  }
  async function verifyMerkleInclusion(mi, execHashHex) {
    if (!mi || typeof mi !== 'object') return { ok: false, reason: 'merkle_inclusion must be an object' };
    if (mi.algorithm !== 'rfc6962') return { ok: false, reason: 'merkle_inclusion.algorithm must be "rfc6962"' };
    var leafHex = String(mi.leaf || '').replace(/^sha256:/, '').toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(leafHex)) return { ok: false, reason: 'merkle_inclusion.leaf must be a 64-hex digest' };
    if (leafHex !== String(execHashHex || '').toLowerCase()) return { ok: false, reason: 'merkle_inclusion.leaf != recomputed execution_hash' };
    if (!Number.isInteger(mi.index) || mi.index < 0) return { ok: false, reason: 'merkle_inclusion.index must be a non-negative integer' };
    if (!Number.isInteger(mi.tree_size) || mi.tree_size <= 0) return { ok: false, reason: 'merkle_inclusion.tree_size must be a positive integer' };
    if (!Array.isArray(mi.path)) return { ok: false, reason: 'merkle_inclusion.path must be an array' };
    try {
      var L = await leafHash(hexToBytes(leafHex));
      var pathBytes = mi.path.map(function (h) { return hexToBytes(String(h).replace(/^sha256:/, '')); });
      var root = await rootFromInclusion(L, mi.index, mi.tree_size, pathBytes);
      if (!root) return { ok: false, reason: 'inclusion path does not reconstruct a root (index/size/path inconsistent)' };
      return { ok: true, rootHex: bytesToHex(root) };
    } catch (e) { return { ok: false, reason: 'inclusion path malformed: ' + e.message }; }
  }

  /* ── verdict (same checks as verifyReceipt() in tools/568, condensed to a verdict) ───── */
  async function verifyReceipt(artifact) {
    var pp = artifact && artifact.policy_parameters, op = artifact && artifact.output_payload;
    var structOk = !!(artifact && typeof artifact === 'object' && pp && typeof pp === 'object' && op && typeof op === 'object' && typeof artifact.execution_hash === 'string' && artifact.execution_hash);
    if (!structOk) return { verdict: 'FAIL', detail: 'missing policy_parameters / output_payload / execution_hash (string)' };

    var recomputed = await executionHash(pp, op);
    var statedHash = String(artifact.execution_hash).replace(/^sha256:/, '').toLowerCase();
    var hashMatch = recomputed.toLowerCase() === statedHash;
    if (!hashMatch) return { verdict: 'FAIL', detail: 'recomputed execution_hash does NOT match the stated value (payload was altered after signing/anchoring)', recomputed_hash: recomputed };

    var sigRes = await verifyArtifactProofs(artifact);
    if (sigRes.present && !sigRes.allValid) {
      var errs = sigRes.results.filter(function (r) { return !r.valid; }).map(function (r) { return r.error; }).join('; ');
      return { verdict: 'FAIL', detail: 'signature check failed: ' + errs, recomputed_hash: recomputed };
    }

    var anchorBindings = Array.isArray(artifact.anchor_bindings) ? artifact.anchor_bindings : [];
    for (var i = 0; i < anchorBindings.length; i++) {
      var ab = anchorBindings[i];
      var anchoredHashHex = String(ab.anchored_hash || '').replace(/^sha256:/, '').toLowerCase();
      if (ab.merkle_inclusion) {
        var mres = await verifyMerkleInclusion(ab.merkle_inclusion, recomputed);
        var rootMatch = mres.ok && mres.rootHex.toLowerCase() === anchoredHashHex;
        if (!mres.ok || !rootMatch) return { verdict: 'FAIL', detail: 'anchor_bindings[' + i + '] Merkle inclusion failed: ' + (mres.ok ? 'reconstructed root does not equal anchored_hash' : mres.reason), recomputed_hash: recomputed };
      } else {
        var directOk = anchoredHashHex !== '' && anchoredHashHex === recomputed.toLowerCase();
        if (!directOk) return { verdict: 'FAIL', detail: 'anchor_bindings[' + i + '] anchored_hash does NOT equal recomputed execution_hash', recomputed_hash: recomputed };
      }
    }
    return { verdict: 'PASS', detail: 'execution_hash recomputed and matches' + (sigRes.present ? '; signature verifies' : '') + (anchorBindings.length ? '; ' + anchorBindings.length + ' anchor binding(s) verify' : ''), recomputed_hash: recomputed };
  }

  /* ── base64url encode, matching the b64uDec()/#in= convention already shipped in every
     tools/*.html page's AIN_BRIDGE_CFG block — never a second fragment-encoding scheme. ──── */
  function b64uEnc(str) {
    var b64 = btoa(unescape(encodeURIComponent(str)));
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function deepLinkUrl(artifact) {
    var payload = JSON.stringify({ fields: { receiptInput: JSON.stringify(artifact, null, 2) } });
    return '/tools/568-ocg-receipt-verifier.html#in=' + b64uEnc(payload) + '&run=1';
  }

  /* ── badge glyphs (inline SVG — no icon font, no remote fetch) ───────────────────────── */
  var GLYPH = {
    unverified: '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8 4v5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="8" cy="11.3" r="0.9" fill="currentColor"/></svg>',
    pass: '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M4.7 8.3l2.1 2.1 4.5-4.7" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    fail: '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M5.3 5.3l5.4 5.4M10.7 5.3l-5.4 5.4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>'
  };

  var CSS = ':host,.ocg-verify-badge{all:initial;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;}' +
    '.ocg-verify-badge{display:inline-flex;align-items:center;gap:.4em;font-size:13px;line-height:1;padding:.4em .65em;border-radius:6px;border:1px solid #8886;cursor:pointer;color:#1a1a1a;background:#f4f4f4;user-select:none;}' +
    '.ocg-verify-badge[data-state="pass"]{color:#0a5c2e;background:#e6f6ec;border-color:#0a5c2e55;}' +
    '.ocg-verify-badge[data-state="fail"]{color:#7a1414;background:#fbe9e9;border-color:#7a141455;}' +
    '.ocg-verify-badge[data-state="checking"]{opacity:.7;cursor:progress;}' +
    '.ocg-verify-badge .ocg-vb-label{font-weight:600;}' +
    '.ocg-verify-badge .ocg-vb-detail{font-weight:400;opacity:.85;}' +
    '.ocg-vb-report{margin-top:.35em;font-size:12px;}' +
    '.ocg-vb-report a{color:inherit;}';

  function findReceipt(host) {
    var refId = host.getAttribute('data-ocg-receipt-ref');
    var text = null;
    if (refId) {
      var refEl = document.getElementById(refId);
      if (refEl) text = refEl.textContent;
    }
    if (!text) {
      var inline = host.getAttribute('data-ocg-receipt');
      if (inline) text = inline;
    }
    if (!text) return null;
    try { return JSON.parse(text); } catch (e) { return undefined; }
  }

  function render(host, state, detail, artifact) {
    host.setAttribute('data-state', state);
    var label = state === 'pass' ? 'OCG Verified' : state === 'fail' ? 'OCG Verify Failed' : state === 'checking' ? 'Verifying…' : 'Verify OCG Receipt';
    var glyphKey = state === 'pass' ? 'pass' : state === 'fail' ? 'fail' : 'unverified';
    host.innerHTML =
      GLYPH[glyphKey] +
      '<span class="ocg-vb-label">' + label + '</span>' +
      (detail ? '<span class="ocg-vb-detail">: ' + escapeHtml(detail) + '</span>' : '');
    if ((state === 'pass' || state === 'fail') && artifact !== undefined && artifact !== null) {
      var report = document.createElement('div');
      report.className = 'ocg-vb-report';
      var a = document.createElement('a');
      a.href = deepLinkUrl(artifact);
      a.target = '_blank';
      a.rel = 'noopener';
      a.textContent = 'Full report ↗';
      a.addEventListener('click', function (e) { e.stopPropagation(); });
      report.appendChild(a);
      host.appendChild(report);
    }
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }

  async function onActivate(host) {
    if (host.getAttribute('data-state') === 'checking') return;
    var artifact = findReceipt(host);
    if (artifact === null) { render(host, 'unverified', 'no receipt found (data-ocg-receipt-ref / data-ocg-receipt)', null); return; }
    if (artifact === undefined) { render(host, 'fail', 'receipt is not valid JSON', null); return; }
    render(host, 'checking', null, null);
    try {
      var result = await verifyReceipt(artifact);
      render(host, result.verdict === 'PASS' ? 'pass' : 'fail', result.detail, artifact);
    } catch (e) {
      render(host, 'fail', 'verify error: ' + e.message, artifact);
    }
  }

  function injectStyleOnce() {
    if (document.getElementById('ocg-verify-badge-style')) return;
    var style = document.createElement('style');
    style.id = 'ocg-verify-badge-style';
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  function initAll() {
    injectStyleOnce();
    var hosts = document.querySelectorAll('[data-ocg-verify]');
    for (var i = 0; i < hosts.length; i++) {
      (function (host) {
        if (host.getAttribute('data-ocg-verify-init') === '1') return;
        host.setAttribute('data-ocg-verify-init', '1');
        host.setAttribute('tabindex', '0');
        host.setAttribute('role', 'button');
        host.setAttribute('aria-label', 'Verify OCG receipt');
        render(host, 'unverified', null, null);
        host.addEventListener('click', function () { onActivate(host); });
        host.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onActivate(host); } });
      })(hosts[i]);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initAll);
  else initAll();

  window.OCGVerifyBadge = { init: initAll, verifyReceipt: verifyReceipt, deepLinkUrl: deepLinkUrl };
})();
