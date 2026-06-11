#!/usr/bin/env python3
"""
add_ap2_export.py — V6 compliance fix
Injects the AP2 Policy Mandate export button into tools that need it.

What gets injected into each target file:
  1. Export button HTML (inline-styled) before <section id="mfstSec">
  2. Toast div + exportAP2() utilities + bridge-wrap before </body>

The bridge-wrap intercepts the tool's declared AIN_BRIDGE_CFG.runFn and:
  - After each run, checks window._lastMandate (tool-specific) or
    window._mandate (T477 compatibility) then falls back to a DOM snapshot.
  - Enables the ap2ExportBtn once a mandate is ready.

Usage:
  python scripts/add_ap2_export.py           # dry-run (no writes)
  python scripts/add_ap2_export.py --apply   # write changes
"""

import re
import sys
import os

TARGETS = [
    # 18 mandatory
    "54-smart-contract-validator.html",
    "221-cross-border-finality-comparator.html",
    "291-mandate-diff.html",
    "394-mica-periodic-reporting-obligation-mapper.html",
    "426-trade-sanctions-compliance-checker.html",
    "452-fair-lending-ai-bias-assessment.html",
    "453-account-takeover-detection-policy-builder.html",
    "454-first-party-fraud-mule-detection-framework.html",
    "465-carf-dac8-reportable-classifier.html",
    "467-form-1099-da-generator.html",
    "468-casp-tax-reporting-readiness-scorer.html",
    "472-pillar-3-disclosure-builder.html",
    "475-pillar-two-safe-harbour-checker.html",
    "476-gir-builder.html",
    "477-fatf-customer-risk-rating.html",
    "478-kya-compliance-firewall.html",
    "479-b2b-micro-clearinghouse.html",
    "480-baas-orchestrator.html",
    # 2 borderline
    "42-cashflow-forecaster-stress-lab.html",
    "427-bank-guarantee-structuring-tool.html",
    # Round-2: manifests declared ap2_export:true but button was missing (caught by verify_repo.py 2026-06-11)
    "328-genius-act-reserve-optimizer.html",
    "332-mica-casp-authorization-checker.html",
    "333-eu-ai-act-article9-risk-mgmt-builder.html",
    "334-eu-ai-act-article10-data-governance-mapper.html",
    "335-eu-ai-act-provider-deployer-obligations-splitter.html",
    "336-genius-act-issuer-classification-mapper.html",
    "337-genius-act-reserve-attestation-checklist.html",
    "338-genius-act-aml-sanctions-scope-builder.html",
    "342-eu-ipr-iso20022-address-validator.html",
    "343-psd3-psr2-transition-impact-assessor.html",
    "344-rwa-tokenized-asset-jurisdiction-mapper.html",
    "419-sca-exemption-classifier.html",
    "466-crypto-cost-basis-gain-calculator.html",
    "469-lcr-calculator.html",
    "470-nsfr-calculator.html",
    "471-leverage-ratio-calculator.html",
    "473-globe-etr-jurisdiction-calculator.html",
    "474-topup-tax-qdmtt-calculator.html",
]

# ── Injected HTML: export button ─────────────────────────────────────────────
# Uses inline styles to avoid conflicts with existing tool CSS.
BUTTON_HTML = """\
<div id="ap2ExportRow" style="display:flex;flex-wrap:wrap;gap:.55rem;margin:1.5rem 0 .5rem;padding-top:1rem;border-top:1px solid var(--border,#1E2F4A)">
  <button id="ap2ExportBtn" disabled onclick="exportAP2()"
    style="display:inline-flex;align-items:center;gap:.45rem;padding:.5rem 1rem;border-radius:var(--radius,6px);font-family:'JetBrains Mono',monospace;font-size:.58rem;letter-spacing:.1em;text-transform:uppercase;border:1px solid var(--border-2,#263855);color:var(--muted,#3A5270);background:transparent;cursor:not-allowed;opacity:.32;white-space:nowrap;transition:all .2s"
    title="Run the tool first to enable Policy Mandate export">
    &#123;&#125; Export Policy Mandate
    <span style="display:block;font-size:.44rem;letter-spacing:.04em;opacity:.7;text-transform:none;margin-top:.1rem">API &#xb7; audit trail</span>
  </button>
</div>
"""

# ── Injected JS + toast div ───────────────────────────────────────────────────
SCRIPT_BLOCK = """\
<div id="ainToast" style="position:fixed;bottom:1.4rem;left:50%;transform:translateX(-50%);background:var(--bg-4,#162340);border:1px solid var(--teal,#14B8A6);color:var(--bright,#D4E8F8);font-family:'JetBrains Mono',monospace;font-size:.66rem;padding:.6rem 1.1rem;border-radius:var(--radius,6px);z-index:9999;display:none;white-space:nowrap;pointer-events:none"></div>
<style>#ap2ExportBtn.ready{opacity:1!important;cursor:pointer!important;border-color:var(--teal,#14B8A6)!important;color:var(--bright,#D4E8F8)!important}#ap2ExportBtn.ready:hover{background:var(--bg-4,#162340)!important}</style>
<script>
/* AP2 export — injected by add_ap2_export.py */
(function(){
  'use strict';

  function uuid4(){
    var b=new Uint8Array(16);crypto.getRandomValues(b);
    b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;
    var h=Array.prototype.map.call(b,function(x){return('0'+x.toString(16)).slice(-2);}).join('');
    return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20);
  }

  function showToast(msg,err){
    var t=document.getElementById('ainToast');
    if(!t)return;
    t.textContent=msg;
    t.style.borderColor=err?'var(--red,#EF4444)':'var(--teal,#14B8A6)';
    t.style.color=err?'var(--red,#EF4444)':'var(--bright,#D4E8F8)';
    t.style.display='block';
    clearTimeout(t._h);
    t._h=setTimeout(function(){t.style.display='none';},3200);
  }

  function dl(content,name){
    var url=URL.createObjectURL(new Blob([content],{type:'application/json'}));
    var a=document.createElement('a');a.href=url;a.download=name;
    document.body.appendChild(a);a.click();document.body.removeChild(a);
    setTimeout(function(){URL.revokeObjectURL(url);},800);
  }

  window.exportAP2=function(){
    var m=window._lastMandate;
    if(!m){showToast('Run the tool first.',true);return;}
    var slug=location.pathname.split('/').pop().replace('.html','');
    var ts=new Date().toISOString().replace(/[-:T]/g,'').slice(0,14);
    dl(JSON.stringify(m,null,2),slug+'_'+ts+'.policy.json');
    showToast('Policy Mandate exported ✓');
  };

  function enableAP2Btn(){
    var ab=document.getElementById('ap2ExportBtn');
    if(!ab||ab.classList.contains('ready'))return;
    ab.disabled=false;
    ab.classList.add('ready');
    ab.title='Download Policy Mandate JSON';
  }

  function buildFallbackMandate(){
    /* Grab text from the first visible results panel as payload */
    var sel='.results-panel,.result-panel,.output-panel,#resultsPanel,#results,'+
            '[id*="result"]:not(button):not(input):not(label):not(script)';
    var panels=document.querySelectorAll(sel);
    var snap='';
    for(var i=0;i<panels.length;i++){
      if(panels[i].offsetParent!==null&&panels[i].innerText.trim()){
        snap=panels[i].innerText.slice(0,3000);break;
      }
    }
    return {
      ap2_version:'1.0',
      mandate_id:uuid4(),
      issued_at:new Date().toISOString(),
      issued_by:'ainumbers.co',
      tool_id:location.pathname.split('/').pop().replace('.html',''),
      tool_version:'1.0',
      mandate_type:'compliance_assessment',
      jurisdiction:'see_payload',
      payload:{output_snapshot:snap||'run tool to populate'},
      audit_metadata:{client_side:true,pii_transmitted:false}
    };
  }

  function tryWrap(){
    var cfg=window.AIN_BRIDGE_CFG;
    if(!cfg||!cfg.runFn)return false;
    var fn=window[cfg.runFn];
    if(typeof fn!=='function'||fn._ap2Wrapped)return true;
    window[cfg.runFn]=function(){
      var r=fn.apply(this,arguments);
      setTimeout(function(){
        /* Priority: tool-specific _lastMandate > _mandate string (T477) > DOM fallback */
        if(!window._lastMandate){
          if(window._mandate&&typeof window._mandate==='string'){
            try{window._lastMandate=JSON.parse(window._mandate);}catch(e){}
          }
        }
        if(!window._lastMandate){
          window._lastMandate=buildFallbackMandate();
        }
        enableAP2Btn();
      },150);
      return r;
    };
    window[cfg.runFn]._ap2Wrapped=true;
    return true;
  }

  /* Wrap immediately if bridge already loaded; retry after DOM ready otherwise */
  if(!tryWrap()){
    var ready=document.readyState;
    if(ready==='loading'){
      document.addEventListener('DOMContentLoaded',function(){tryWrap();setTimeout(tryWrap,300);});
    } else {
      setTimeout(function(){tryWrap();setTimeout(tryWrap,300);},0);
    }
  }

})();
</script>
"""

# ── Injection logic ───────────────────────────────────────────────────────────

MFST_RE = re.compile(r'(<section\b[^>]*\bid="mfstSec")', re.IGNORECASE)


def fix_file(path, dry_run):
    try:
        content = open(path, encoding="utf-8").read()
    except FileNotFoundError:
        print(f"  MISSING: {path}")
        return "missing"

    if 'id="ap2ExportBtn"' in content:
        print(f"  SKIP (already present): {os.path.basename(path)}")
        return "skip"

    modified = content
    actions = []

    # 1. Inject button before <section id="mfstSec">
    if MFST_RE.search(modified):
        modified = MFST_RE.sub(BUTTON_HTML + r"\1", modified, count=1)
        actions.append("button")
    else:
        # Fallback: inject before </body>
        if "</body>" in modified:
            modified = modified.replace("</body>", BUTTON_HTML + "</body>", 1)
            actions.append("button(fallback)")
        else:
            print(f"  WARN (no anchor): {os.path.basename(path)}")
            return "warn"

    # 2. Inject toast + JS before </body>
    if "</body>" in modified:
        modified = modified.replace("</body>", SCRIPT_BLOCK + "</body>", 1)
        actions.append("script")
    else:
        print(f"  WARN (no </body>): {os.path.basename(path)}")
        return "warn"

    print(f"  {'WRITE' if not dry_run else 'would-write'} [{','.join(actions)}]: {os.path.basename(path)}")

    if not dry_run:
        open(path, "w", encoding="utf-8").write(modified)

    return "done"


def main():
    dry_run = "--apply" not in sys.argv

    script_dir = os.path.dirname(os.path.abspath(__file__))
    tools_dir = os.path.join(os.path.dirname(script_dir), "tools")

    if dry_run:
        print("=== DRY RUN (pass --apply to write) ===\n")
    else:
        print("=== APPLYING ===\n")

    counts = {"skip": 0, "done": 0, "missing": 0, "warn": 0}
    for fname in TARGETS:
        r = fix_file(os.path.join(tools_dir, fname), dry_run)
        counts[r if r in counts else "done"] += 1

    print(f"\n  injected: {counts['done']}  skip: {counts['skip']}  "
          f"missing: {counts['missing']}  warn: {counts['warn']}")
    if dry_run and counts["done"]:
        print(f"\nRe-run with --apply to write {counts['done']} file(s).")


if __name__ == "__main__":
    main()
