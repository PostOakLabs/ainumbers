/* OCG SIGN-VERDICT AFFORDANCE v1 — one shared "sign this verdict as a §27 approval record" widget for
   checklist/scorer tool pages (SPEC.md §27.1-27.3). DO NOT hand-edit. Byte-identical to
   chaingraph/kernels/_signverdict.inline.js wherever it is pasted inline (this pattern mirrors
   kernels/_proof.inline.min.js — the site has no build step, so the master copy here is
   hand-synced into each consuming tool page).
   Reuses the OCG-PROOF v1 signer (eddsa-jcs-2022 / did:key, same kernel as verify.html and
   key-ceremony.html — HA-RETRO-1 + SI-3) verbatim for the crypto; adds only a subject-hash-of-
   any-JSON-artifact step (JCS canon + SHA-256, no execution_hash / chaingraph_version involved —
   these verdict artifacts are AP2 Policy Mandates, not OCG chain-node artifacts) plus a minimal
   §27.1-shaped record builder and button/config UI.
   Exposes: window.SignVerdict.mount(container, {toolId, getVerdict}) — getVerdict() must return
   the page's current verdict object (or null/undefined if nothing has run yet); this module never
   reads or changes any verdict-computation logic. */
(function () {
  function canon(v) {
    return Array.isArray(v) ? v.map(canon) : (v && typeof v === 'object') ? Object.keys(v).sort().reduce(function (o, k) { o[k] = canon(v[k]); return o; }, {}) : v;
  }
  function jcsBytes(o) { return new TextEncoder().encode(JSON.stringify(canon(o))); }
  function sha(b) { return crypto.subtle.digest('SHA-256', b).then(function (d) { return new Uint8Array(d); }); }
  function sha256hex(bytes) { return sha(bytes).then(function (u) { return Array.prototype.map.call(u, function (b) { return b.toString(16).padStart(2, '0'); }).join(''); }); }
  var B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  function b58e(bytes) {
    var z = 0; while (z < bytes.length && bytes[z] === 0) z++;
    var d = [0];
    for (var i = z; i < bytes.length; i++) { var c = bytes[i]; for (var j = 0; j < d.length; j++) { c += d[j] << 8; d[j] = c % 58; c = (c / 58) | 0; } while (c) { d.push(c % 58); c = (c / 58) | 0; } }
    var s = ''; for (var k = 0; k < z; k++) s += '1';
    for (var q = d.length - 1; q >= 0; q--) s += B58[d[q]];
    return s;
  }
  var MC = [0xed, 0x01];
  function didFromPub(pk) {
    return crypto.subtle.exportKey('raw', pk).then(function (r) {
      var raw = new Uint8Array(r); var p = new Uint8Array(MC.length + raw.length); p.set(MC, 0); p.set(raw, MC.length);
      return 'did:key:z' + b58e(p);
    });
  }
  function securedRecord(a) { var c = structuredClone(a); if (c && c.audit_signature && 'proof' in c.audit_signature) delete c.audit_signature.proof; return c; }
  function proofOpts(vm, created) { return { type: 'DataIntegrityProof', cryptosuite: 'eddsa-jcs-2022', verificationMethod: vm, proofPurpose: 'assertionMethod', created: created }; }
  function hashData(a, o) {
    return Promise.all([sha(jcsBytes(o)), sha(jcsBytes(securedRecord(a)))]).then(function (h) {
      var oh = h[0], dh = h[1]; var c = new Uint8Array(oh.length + dh.length); c.set(oh, 0); c.set(dh, oh.length); return c;
    });
  }
  function signRecord(record, o) {
    var po = proofOpts(o.verificationMethod, o.created);
    return hashData(record, po).then(function (hd) { return crypto.subtle.sign('Ed25519', o.privateKey, hd); }).then(function (s) {
      var proof = Object.assign({}, po, { proofValue: 'z' + b58e(new Uint8Array(s)) });
      var out = structuredClone(record); out.audit_signature = Object.assign({}, out.audit_signature || {}, { proof: proof });
      return out;
    });
  }

  function fieldHtml(label, inner) {
    return '<label style="font-size:.62rem;color:var(--muted);">' + label + inner + '</label>';
  }
  var INPUT_STYLE = 'display:block;margin-top:4px;background:var(--bg-3);border:1px solid var(--border-2);color:var(--text);border-radius:var(--radius);padding:.4rem .6rem;font-family:\'JetBrains Mono\',monospace;';

  function mount(container, cfg) {
    var toolId = (cfg && cfg.toolId) || 'unknown-tool';
    var getVerdict = (cfg && cfg.getVerdict) || function () { return null; };
    var kp = null; // { privateKey, did } — stays in this tab's memory only, never persisted or transmitted

    var LABEL_STYLE = 'font-family:\'JetBrains Mono\',monospace;font-size:.52rem;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin-bottom:.4rem';
    var BTN_STYLE = 'font-family:\'JetBrains Mono\',monospace;font-size:.62rem;letter-spacing:.08em;text-transform:uppercase;background:var(--bg-3);color:var(--text);border:1px solid var(--border-2);border-radius:var(--radius);padding:.45rem 1rem;cursor:pointer';
    container.style.background = 'var(--bg-2)';
    container.style.border = '1px solid var(--border)';
    container.style.borderRadius = 'var(--radius-lg, var(--radius))';
    container.style.padding = '1.25rem';
    container.style.marginTop = '1.25rem';
    container.innerHTML =
      '<div style="' + LABEL_STYLE + '">Sign this verdict as a §27 approval record</div>' +
      '<p style="font-size:.72rem;color:var(--body,var(--muted));line-height:1.6;margin:.3rem 0 .9rem;">Runs entirely in this browser. Attaches an eddsa-jcs-2022 signature to an approval, rejection, or annotation record covering the verdict above — this does not change the verdict itself.</p>' +
      '<div style="display:flex;gap:14px;align-items:flex-end;flex-wrap:wrap;margin-bottom:.9rem;">' +
        fieldHtml('record_type', '<select id="svRecordType" style="' + INPUT_STYLE + '"><option value="approval">approval</option><option value="rejection">rejection</option><option value="annotation">annotation</option></select>') +
        fieldHtml('role', '<input id="svRole" value="attestor" style="' + INPUT_STYLE + 'width:130px;">') +
        fieldHtml('identity.id (did:key)', '<input id="svIdentity" placeholder="paste from key-ceremony.html, or Generate" style="' + INPUT_STYLE + 'width:280px;">') +
        fieldHtml('reason_code', '<input id="svReasonCode" placeholder="REVIEWED_OK" style="' + INPUT_STYLE + 'width:150px;">') +
      '</div>' +
      '<div style="display:flex;gap:.6rem;flex-wrap:wrap;">' +
        '<button style="' + BTN_STYLE + '" id="svGenBtn" type="button">Generate keypair</button>' +
        '<button style="' + BTN_STYLE + '" id="svSignBtn" type="button">Sign record</button>' +
        '<button style="' + BTN_STYLE + '" id="svBundleBtn" type="button">Export evidence bundle JSON</button>' +
      '</div>' +
      '<textarea id="svOut" readonly placeholder="Signed record JSON appears here." style="margin-top:10px;min-height:110px;width:100%;box-sizing:border-box;background:var(--bg-3);border:1px solid var(--border-2);color:var(--text);border-radius:var(--radius);padding:.5rem;font-family:\'JetBrains Mono\',monospace;font-size:.68rem;"></textarea>' +
      '<div id="svMsg" style="margin-top:6px;font-size:.62rem;color:var(--muted);"></div>';

    var $ = function (sel) { return container.querySelector(sel); };
    function msg(t, isErr) { var el = $('#svMsg'); el.textContent = t; el.style.color = isErr ? 'var(--red)' : 'var(--muted)'; }

    $('#svGenBtn').addEventListener('click', function () {
      crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']).then(function (k) {
        return didFromPub(k.publicKey).then(function (did) {
          kp = { privateKey: k.privateKey, did: did };
          $('#svIdentity').value = did;
          msg('Generated a fresh Ed25519 keypair — identity.id set to ' + did + '. The private key stays in this tab\'s memory only.');
        });
      }).catch(function (e) { msg('Keypair generation failed: ' + e.message, true); });
    });

    $('#svSignBtn').addEventListener('click', function () {
      var verdict;
      try { verdict = getVerdict(); } catch (e) { msg('Could not read the verdict: ' + e.message, true); return; }
      if (!verdict || (typeof verdict === 'object' && Object.keys(verdict).length === 0)) { msg('Run the tool above first — there is no verdict to sign yet.', true); return; }
      var identity_id = $('#svIdentity').value.trim() || (kp && kp.did);
      if (!identity_id) { msg('Click "Generate keypair" first, or paste a did:key identity.', true); return; }
      if (!kp || !kp.privateKey) { msg('No private key in this session — click "Generate keypair" (pasting an identity.id alone cannot sign).', true); return; }
      sha256hex(jcsBytes(verdict)).then(function (hex) {
        var record_type = $('#svRecordType').value;
        var role = $('#svRole').value.trim() || 'attestor';
        var reason_code = $('#svReasonCode').value.trim();
        var ts = new Date().toISOString();
        var record = { record_type: record_type, role: role, subject_hash: 'sha256:' + hex, subject_tool_id: toolId, identity: { id: identity_id }, timestamp: ts };
        if (reason_code) record.reason_code = reason_code;
        if (record_type === 'approval') record.decision = 'approve';
        if (record_type === 'rejection') record.decision = 'reject';
        return signRecord(record, { verificationMethod: identity_id + '#key-1', created: ts, privateKey: kp.privateKey });
      }).then(function (signed) {
        $('#svOut').value = JSON.stringify(signed, null, 2);
        container.__lastSignedVerdictRecord = signed;
        msg('Signed — subject_hash covers this page\'s current verdict output.');
      }).catch(function (e) { msg('Sign failed: ' + e.message, true); });
    });

    $('#svBundleBtn').addEventListener('click', function () {
      var signed = container.__lastSignedVerdictRecord;
      if (!signed) { msg('Sign a record first — the evidence bundle wraps it.', true); return; }
      var bundle = { subject_hash: signed.subject_hash, subject_tool_id: toolId, records: [signed], generated_at: new Date().toISOString() };
      var blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a'); a.href = url; a.download = toolId + '-ha-evidence-bundle.json'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    });
  }

  window.SignVerdict = { mount: mount };
})();
