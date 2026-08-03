#!/usr/bin/env python3
"""
sweep-ain-bridge-v1_1.py — SPINE-BRIDGE-SEND2VERIFY-1

Bumps the AIN Bridge to v1.1 across the tool fleet: adds a Send to Verify
sender (apSendToVerify, mirrors gen-workbench.mjs's sender but with
kind:'policy-mandate'/field 'mandate' instead of kind:'ocg-artifact'/
'artifact') and a visible button in .results-export-row.

Three file classes, each handled by anchor, not by a whole-file diff:
  A. Has the standard v1.0 object literal `window.AINBridge={...}` —
     surgical insert: apSendToVerify() + HANDOFF_MAX_CHARS before the
     literal, sendToVerify:apSendToVerify, added inside it.
  B. Has NEITHER that literal — no working bridge at all despite the
     file referencing AIN_BRIDGE_CFG in places (measured, not the
     spec's 28/29 guess) — full v1.1 English-only block inserted fresh
     before </body>, CFG runFn:null (matches the master snippet's own
     default; tools that already self-populate window._lastMandate
     keep working unchanged since getMandate() checks that first).
  C. Button placement: files with .results-export-row get the button
     inserted as the row's first child (uniform anchor — works whether
     or not the row also carries ap2ExportBtn). Files with no
     .results-export-row at all get no button (get the function only,
     via class A/B) — logged, not silently dropped.

Usage (from repo root of the worktree):
  python scripts/sweep-ain-bridge-v1_1.py            # dry-run
  python scripts/sweep-ain-bridge-v1_1.py --write    # apply
"""

import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
WRITE = "--write" in sys.argv

HEADER_OLD = "AIN Bridge v1.0"
HEADER_NEW = "AIN Bridge v1.1"

ANCHOR_AINBRIDGE = "window.AINBridge={"

SEND_TO_VERIFY_JS = """var HANDOFF_MAX_CHARS=2000000;
function apSendToVerify(){
  var m;try{m=window.AINBridge.getMandate();}catch(e){m=null;}
  if(!m){notice('\\u26a0 No Policy Mandate to send \\u2014 run the tool first.','warn');return;}
  var json;try{json=JSON.stringify(m);}catch(e){notice('\\u26a0 Could not serialize the mandate: '+e.message,'warn');return;}
  if(json.length>HANDOFF_MAX_CHARS){notice('\\u26a0 Too large to hand off ('+json.length+' chars).','warn');return;}
  var target=new URL('../chaingraph/verify.html',window.location.href).href;
  var win=window.open(target,'_blank');
  if(!win){notice('\\u26a0 The verifier window was blocked. Allow pop-ups for this site.','warn');return;}
  var sent=false,timer=null;
  function onReady(ev){
    if(ev.origin!==window.location.origin)return;
    if(ev.source!==win)return;
    var d=ev.data;
    if(!d||typeof d!=='object'||d.type!=='ain-handoff-ready/v1')return;
    if(sent)return;sent=true;
    window.removeEventListener('message',onReady);
    if(timer)clearTimeout(timer);
    win.postMessage({type:'ain-handoff/v1',kind:'policy-mandate',mandate:json},window.location.origin);
    notice('\\u27a1 Sent to the Artifact Verifier in the new tab.','ok');
  }
  window.addEventListener('message',onReady);
  notice('Opening the Artifact Verifier\\u2026','ok');
  timer=setTimeout(function(){
    if(sent)return;
    window.removeEventListener('message',onReady);
    notice('\\u26a0 The verifier did not answer. Export the mandate and paste it in.','warn');
  },10000);
}
"""

BUTTON_HTML = (
    '<button id="ainSendVerifyBtn" onclick="apSendToVerify()" '
    'title="Open the Artifact Verifier and hand it this Policy Mandate \\u2014 '
    'same-origin message, no file, no network" '
    'style="font-family:\'JetBrains Mono\',monospace;font-size:.6rem;letter-spacing:.1em;'
    'text-transform:uppercase;padding:.45rem 1rem;background:var(--bg-3);color:var(--text);'
    'border:1px solid var(--border);border-radius:var(--radius,6px);cursor:pointer;opacity:.85;'
    'transition:opacity .2s,border-color .2s" '
    'onmouseover="this.style.opacity=\'1\'" onmouseout="this.style.opacity=\'.85\'">'
    '&#x27A1; Send to Verify</button>'
)

ROW_RE = re.compile(r'<div\b[^>]*\bclass="[^"]*\bresults-export-row\b[^"]*"[^>]*>')
SCRIPT_RE = re.compile(r'<script\b[^>]*>.*?</script>', re.DOTALL | re.IGNORECASE)


def in_script(src, pos):
    """True if pos falls inside a <script>...</script> block — a
    results-export-row match there is a JS string literal building HTML
    at runtime, not real markup; inserting into it breaks JS syntax."""
    for m in SCRIPT_RE.finditer(src):
        if m.start() <= pos < m.end():
            return True
    return False

# Full fresh v1.1 English-only block for files with no working bridge at all
# (class B). Mirrors the shape already deployed to the 491 class-A files —
# not the master snippet's multi-lingual body, matching the convention
# fix_bridge_t.py already pinned across the fleet (English-only, no
# sessionStorage lang read).
FULL_BLOCK = """
<!-- ═══ AIN Bridge v1.1: prefill deep-links (#in=<base64url JSON>[&run=1]) + Send to Verify. Master: scripts/ain-bridge-v1.snippet.html ═══ -->
<script>window.AIN_BRIDGE_CFG={runFn:null,intake:false,intakeTarget:null,intakeAnchor:null};</script>
<script>
(function(){
'use strict';
var CFG=window.AIN_BRIDGE_CFG||{};
var L={
 en:{pf:'Inputs prefilled from link \\u2014 review, then Run',ran:'Inputs prefilled from link and executed',fields:'fields',it:'Import Policy Mandate (.policy.json)',drop:'Drop a .policy.json here, or',choose:'Choose file',paste:'Paste JSON',apply:'Apply',ok:'Policy Mandate imported from',bad:'Not a valid AINumbers Policy Mandate JSON'},
};
function t(k){return (L.en&&L.en[k])||k;}
function b64uDec(s){s=s.replace(/-/g,'+').replace(/_/g,'/');while(s.length%4)s+='=';return decodeURIComponent(Array.prototype.map.call(atob(s),function(c){return '%'+('00'+c.charCodeAt(0).toString(16)).slice(-2);}).join(''));}
function b64uEnc(s){return btoa(unescape(encodeURIComponent(s))).replace(/\\+/g,'-').replace(/\\//g,'_').replace(/=+$/,'');}
function applyFields(fields){
  var n=0;if(!fields||typeof fields!=='object')return 0;
  Object.keys(fields).forEach(function(id){
    var el=document.getElementById(id);if(!el)return;
    var tag=el.tagName;if(tag!=='INPUT'&&tag!=='SELECT'&&tag!=='TEXTAREA')return;
    var v=fields[id];
    if(el.type==='checkbox'||el.type==='radio'){el.checked=!!v;}
    else{el.value=(v!==null&&typeof v==='object')?JSON.stringify(v,null,2):String(v);}
    try{el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));}catch(e){}
    n++;
  });
  return n;
}
function runTool(){if(!CFG.runFn)return false;var f=window[CFG.runFn];if(typeof f==='function'){try{f();return true;}catch(e){return false;}}return false;}
function anchorEl(){return (CFG.intakeAnchor&&document.querySelector(CFG.intakeAnchor))||document.querySelector('.pii-notice')||document.querySelector('.panel')||document.body.firstElementChild;}
function notice(msg,kind){
  var d=document.getElementById('ainBridgeNotice');
  if(!d){d=document.createElement('div');d.id='ainBridgeNotice';
    var a=document.getElementById('ainIntakeZone')||anchorEl();
    if(a&&a.parentNode)a.parentNode.insertBefore(d,a);else document.body.insertBefore(d,document.body.firstChild);}
  d.setAttribute('style','font-family:\\'JetBrains Mono\\',monospace;font-size:.68rem;letter-spacing:.04em;margin:0 0 1rem;padding:.55rem .8rem;border-radius:6px;border:1px solid '+(kind==='warn'?'#F59E0B':'#14B8A6')+';color:'+(kind==='warn'?'#F59E0B':'#2DD4BF')+';background:'+(kind==='warn'?'rgba(245,158,11,.08)':'rgba(20,184,166,.08)'));
  d.textContent=msg;
}
function looksLikeMandate(o){return !!(o&&typeof o==='object'&&o.mandate_id&&o.tool_id&&('payload' in o));}
function intakeApply(text){
  var o;try{o=JSON.parse(text);}catch(e){notice('\\u26a0 '+t('bad'),'warn');return 0;}
  if(!looksLikeMandate(o)){notice('\\u26a0 '+t('bad'),'warn');return 0;}
  var n=0;
  if(CFG.intakeTarget){var ta=document.getElementById(CFG.intakeTarget);
    if(ta){ta.value=JSON.stringify(o,null,2);try{ta.dispatchEvent(new Event('input',{bubbles:true}));}catch(e){}n++;}}
  if(o.payload&&typeof o.payload==='object')n+=applyFields(o.payload);
  if(o.source_tool_inputs&&typeof o.source_tool_inputs==='object')n+=applyFields(o.source_tool_inputs);
  notice((n>0?'\\ud83d\\udce5 ':'\\u26a0 ')+t('ok')+' '+(o.tool_id||'?')+' \\u00b7 '+n+' '+t('fields'),n>0?'ok':'warn');
  return n;
}
function buildIntakeUI(){
  if(!CFG.intake)return;
  var a=anchorEl();if(!a||!a.parentNode)return;
  var z=document.createElement('div');z.id='ainIntakeZone';
  z.setAttribute('style','border:1px dashed #263855;border-radius:6px;padding:.7rem .9rem;margin:0 0 1.25rem;font-family:\\'JetBrains Mono\\',monospace;font-size:.66rem;color:#6888A8;letter-spacing:.04em');
  var lbl=document.createElement('div');lbl.textContent='\\ud83d\\udce5 '+t('it');lbl.setAttribute('style','color:#A8C4DE;margin-bottom:.4rem;text-transform:uppercase;letter-spacing:.1em;font-size:.6rem');
  var row=document.createElement('div');row.setAttribute('style','display:flex;gap:.6rem;align-items:center;flex-wrap:wrap');
  var txt=document.createElement('span');txt.textContent=t('drop');
  function mkBtn(label){var b=document.createElement('button');b.type='button';b.textContent=label;b.setAttribute('style','background:transparent;border:1px solid #263855;color:#A8C4DE;border-radius:6px;padding:.3rem .7rem;font-family:inherit;font-size:.62rem;cursor:pointer');return b;}
  var bFile=mkBtn(t('choose')),bPaste=mkBtn(t('paste'));
  var fi=document.createElement('input');fi.type='file';fi.accept='.json,application/json';fi.style.display='none';
  fi.addEventListener('change',function(){var f=fi.files&&fi.files[0];if(!f)return;var r=new FileReader();r.onload=function(){intakeApply(String(r.result));};r.readAsText(f);fi.value='';});
  bFile.addEventListener('click',function(){fi.click();});
  var pasteRow=document.createElement('div');pasteRow.style.display='none';pasteRow.setAttribute('style','display:none;margin-top:.6rem');
  var ta=document.createElement('textarea');ta.rows=5;ta.spellcheck=false;ta.setAttribute('style','width:100%;background:#0D1627;border:1px solid #263855;border-radius:6px;color:#A8C4DE;font-family:inherit;font-size:.64rem;padding:.5rem');
  var bApply=mkBtn(t('apply'));bApply.style.marginTop='.4rem';
  bApply.addEventListener('click',function(){if(ta.value.trim()){intakeApply(ta.value);ta.value='';pasteRow.style.display='none';}});
  pasteRow.appendChild(ta);pasteRow.appendChild(bApply);
  bPaste.addEventListener('click',function(){pasteRow.style.display=(pasteRow.style.display==='none')?'block':'none';if(pasteRow.style.display==='block')ta.focus();});
  z.addEventListener('dragover',function(e){e.preventDefault();z.style.borderColor='#14B8A6';});
  z.addEventListener('dragleave',function(){z.style.borderColor='#263855';});
  z.addEventListener('drop',function(e){e.preventDefault();z.style.borderColor='#263855';var f=e.dataTransfer&&e.dataTransfer.files&&e.dataTransfer.files[0];if(f){var r=new FileReader();r.onload=function(){intakeApply(String(r.result));};r.readAsText(f);}});
  row.appendChild(txt);row.appendChild(bFile);row.appendChild(bPaste);row.appendChild(fi);
  z.appendChild(lbl);z.appendChild(row);z.appendChild(pasteRow);
  a.parentNode.insertBefore(z,a);
}
function initPrefill(){
  var h=location.hash||'';var m=h.match(/[#&]in=([A-Za-z0-9_\\-]+)/);if(!m)return;
  var obj;try{obj=JSON.parse(b64uDec(m[1]));}catch(e){return;}
  var fields=(obj&&obj.fields&&typeof obj.fields==='object')?obj.fields:obj;
  var n=applyFields(fields);
  if(n>0){
    if(/[#&]run=1/.test(h)&&runTool())notice('\\u26a1 '+t('ran')+' ('+n+' '+t('fields')+')','ok');
    else notice('\\ud83d\\udd17 '+t('pf')+' ('+n+' '+t('fields')+')','ok');
  }
}
""" + SEND_TO_VERIFY_JS + """window.AINBridge={
  version:'1.1',
  apply:applyFields,
  run:runTool,
  intake:intakeApply,
  sendToVerify:apSendToVerify,
  getMandate:function(){if(window._lastMandate)return window._lastMandate;if(typeof window.AIN_BUILD_MANDATE==='function'){try{var m=window.AIN_BUILD_MANDATE();if(m)return m;}catch(e){}}return window._currentMandate||null;},
  makeLink:function(fields,run){return location.origin+location.pathname+'#in='+b64uEnc(JSON.stringify(fields))+(run?'&run=1':'');}
};
window.addEventListener('message',function(e){
  if(window.parent===window||e.source!==window.parent)return;
  if(e.origin&&e.origin!=='null'&&location.origin&&location.origin!=='null'&&e.origin!==location.origin)return;
  var ro=(e.origin&&e.origin!=='null')?e.origin:'*';
  var d=e.data||{};
  if(d.type==='ain:prefill'){var n=applyFields(d.fields||{});e.source.postMessage({type:'ain:prefilled',applied:n,tool:location.pathname},ro);}
  else if(d.type==='ain:run'){var ok=runTool();e.source.postMessage({type:'ain:ran',ok:ok,tool:location.pathname},ro);}
  else if(d.type==='ain:getMandate'){e.source.postMessage({type:'ain:mandate',mandate:window.AINBridge.getMandate(),tool:location.pathname},ro);}
});
function boot(){buildIntakeUI();initPrefill();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
</script>
"""


def patch_button(src):
    for m in ROW_RE.finditer(src):
        if in_script(src, m.start()):
            continue
        pos = m.end()
        return src[:pos] + BUTTON_HTML + src[pos:], True
    return src, False


VERSION_RE = re.compile(r"window\.AINBridge=\{\s*version:'1\.0',")
COMPACT_STUB_RE = re.compile(
    r"window\.AINBridge=\{apply:applyFields,run:safeRun,cfg:CFG\};"
)

# Compact custom-stub variant (~12 files, an older hand-rolled bridge shape
# with no notice()/t() helpers in scope) — self-contained notify so it never
# throws a ReferenceError if invoked where no UI feedback element exists.
SEND_TO_VERIFY_JS_COMPACT = """function apSendToVerify(){
  function _n(msg){try{if(typeof notice==='function'){notice(msg);return;}}catch(e){}try{console.log('[AIN Bridge] '+msg);}catch(e2){}}
  var m=null;try{if(window.AIN_BUILD_MANDATE)m=window.AIN_BUILD_MANDATE();}catch(e){}
  if(!m)m=window._currentMandate||null;
  if(!m){_n('No Policy Mandate to send \\u2014 run the tool first.');return;}
  var json;try{json=JSON.stringify(m);}catch(e){_n('Could not serialize the mandate: '+e.message);return;}
  if(json.length>2000000){_n('Too large to hand off ('+json.length+' chars).');return;}
  var target=new URL('../chaingraph/verify.html',window.location.href).href;
  var win=window.open(target,'_blank');
  if(!win){_n('The verifier window was blocked. Allow pop-ups for this site.');return;}
  var sent=false,timer=null;
  function onReady(ev){
    if(ev.origin!==window.location.origin)return;
    if(ev.source!==win)return;
    var d=ev.data;
    if(!d||typeof d!=='object'||d.type!=='ain-handoff-ready/v1')return;
    if(sent)return;sent=true;
    window.removeEventListener('message',onReady);
    if(timer)clearTimeout(timer);
    win.postMessage({type:'ain-handoff/v1',kind:'policy-mandate',mandate:json},window.location.origin);
    _n('Sent to the Artifact Verifier in the new tab.');
  }
  window.addEventListener('message',onReady);
  _n('Opening the Artifact Verifier\\u2026');
  timer=setTimeout(function(){
    if(sent)return;
    window.removeEventListener('message',onReady);
    _n('The verifier did not answer. Export the mandate and paste it in.');
  },10000);
}
"""


def patch_class_a(src):
    """Files that already have the working v1.0 window.AINBridge={ literal."""
    changed = False
    if HEADER_OLD in src:
        src = src.replace(HEADER_OLD, HEADER_NEW)
        changed = True
    if ANCHOR_AINBRIDGE in src and "apSendToVerify" not in src and VERSION_RE.search(src):
        src = VERSION_RE.sub(
            "window.AINBridge={\n  version:'1.1',", src, count=1
        )
        src = src.replace(ANCHOR_AINBRIDGE, SEND_TO_VERIFY_JS + ANCHOR_AINBRIDGE, 1)
        src = src.replace(
            "  intake:intakeApply,\n",
            "  intake:intakeApply,\n  sendToVerify:apSendToVerify,\n",
            1,
        )
        changed = True
    elif "apSendToVerify" not in src and COMPACT_STUB_RE.search(src):
        replacement = (
            SEND_TO_VERIFY_JS_COMPACT
            + "window.AINBridge={apply:applyFields,run:safeRun,cfg:CFG,sendToVerify:apSendToVerify};"
        )
        src = COMPACT_STUB_RE.sub(lambda _m: replacement, src, count=1)
        changed = True
    btn_added = False
    if "ainSendVerifyBtn" not in src:
        src, btn_added = patch_button(src)
        changed = changed or btn_added
    return src, changed, btn_added


def patch_class_b(src):
    """Files with no working bridge scaffold at all — insert the full block."""
    if "</body>" not in src:
        return src, False, False
    src2 = src.replace("</body>", FULL_BLOCK + "</body>", 1)
    src2, btn_added = patch_button(src2)
    return src2, True, btn_added


def main():
    mode = "APPLYING" if WRITE else "DRY-RUN"
    print(f"=== {mode} ===\n")

    snippet = REPO / "scripts" / "ain-bridge-v1.snippet.html"
    if snippet.exists():
        print(f"  master snippet already patched by hand: {snippet.relative_to(REPO)}")

    # kernel-vm-widget.html is machine-generated (gen-kernel-vm-widget.mjs) —
    # never carried the bridge and must stay in generator lockstep, not swept.
    GENERATED_EXCLUDE = {"kernel-vm-widget.html"}
    tools_dir = REPO / "tools"
    files = [
        p for p in sorted(tools_dir.glob("*.html")) if p.name not in GENERATED_EXCLUDE
    ]

    n_a = n_b = n_btn = n_nobtn = n_skip = 0
    for path in files:
        src = path.read_text(encoding="utf-8", errors="replace")
        if ANCHOR_AINBRIDGE in src:
            out, changed, btn_added = patch_class_a(src)
            n_a += 1
        else:
            out, changed, btn_added = patch_class_b(src)
            n_b += 1
        if btn_added:
            n_btn += 1
        elif "results-export-row" not in src:
            n_nobtn += 1
        if not changed:
            n_skip += 1
            continue
        if WRITE:
            path.write_text(out, encoding="utf-8", newline="")

    print(f"\n  class A (surgical patch, had v1.0 scaffold): {n_a}")
    print(f"  class B (full block inserted, no working scaffold): {n_b}")
    print(f"  button inserted: {n_btn}")
    print(f"  no .results-export-row (function-only, no button): {n_nobtn}")
    print(f"  files total: {len(files)}")
    if not WRITE:
        print("\nRe-run with --write to apply.")


if __name__ == "__main__":
    main()
