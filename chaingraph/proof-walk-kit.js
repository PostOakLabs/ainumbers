/* proof-walk-kit.js · shared by chaingraph/break-the-wall-explainer.html and chaingraph/auditors-walk-explainer.html.
   One copy of the verifier code and the evidence, so the two pages cannot drift. Loaded with a plain
   <script src>, it makes no network requests of its own. CC BY 4.0 · Post Oak Labs · github.com/PostOakLabs/ainumbers
   Sections: (1) OCG verifier, copied unchanged in logic from chaingraph/kernels/_computeproof.mjs and _hash.mjs
   (the export line adds verifyBinding); (2) OCG-PROOF, byte-identical to kernels/_proof.mjs; (3) RFC 3161 verifier,
   copied unchanged from verification-desk.html; (4) evidence; (5) kit logic. */

/* (1) */
/* OpenChainGraph reference verifier (Post Oak Labs, CC BY 4.0), copied unchanged in logic from chaingraph/kernels/_computeproof.mjs and _hash.mjs in github.com/PostOakLabs/ainumbers, converted from ES modules to a plain script. It bundles @noble/curves and @noble/hashes (MIT, (c) Paul Miller). */
(function(){
var __n=(function(){/* Vendored: @noble/curves + @noble/hashes v2.2.0 (MIT, (c) Paul Miller paulmillr.com). Self-contained ESM
   bundle (esbuild) exporting { bn254, sha256 }. DO NOT hand-edit — rebuild from pinned source. Used by OCG
   kernels/_computeproof.mjs as the §18 self-contained BN254 Groth16 reference verifier (zero npm/runtime dep). */
function ge(o){return o instanceof Uint8Array||ArrayBuffer.isView(o)&&o.constructor.name==="Uint8Array"&&"BYTES_PER_ELEMENT"in o&&o.BYTES_PER_ELEMENT===1}function Ft(o,t=""){if(typeof o!="number"){let n=t&&`"${t}" `;throw new TypeError(`${n}expected number, got ${typeof o}`)}if(!Number.isSafeInteger(o)||o<0){let n=t&&`"${t}" `;throw new RangeError(`${n}expected integer >= 0, got ${o}`)}}function J(o,t,n=""){let e=ge(o),r=o?.length,s=t!==void 0;if(!e||s&&r!==t){let i=n&&`"${n}" `,c=s?` of length ${t}`:"",u=e?`length=${r}`:`type=${typeof o}`,f=i+"expected Uint8Array"+c+", got "+u;throw e?new RangeError(f):new TypeError(f)}return o}function kt(o,t=!0){if(o.destroyed)throw new Error("Hash instance has been destroyed");if(t&&o.finished)throw new Error("Hash#digest() has already been called")}function xe(o,t){J(o,void 0,"digestInto() output");let n=t.outputLen;if(o.length<n)throw new RangeError('"digestInto() output" expected to be of length >='+n)}function bt(...o){for(let t=0;t<o.length;t++)o[t].fill(0)}function St(o){return new DataView(o.buffer,o.byteOffset,o.byteLength)}function Y(o,t){return o<<32-t|o>>>t}var Ee=typeof Uint8Array.from([]).toHex=="function"&&typeof Uint8Array.fromHex=="function",an=Array.from({length:256},(o,t)=>t.toString(16).padStart(2,"0"));function Rt(o){if(J(o),Ee)return o.toHex();let t="";for(let n=0;n<o.length;n++)t+=an[o[n]];return t}var $={_0:48,_9:57,A:65,F:70,a:97,f:102};function be(o){if(o>=$._0&&o<=$._9)return o-$._0;if(o>=$.A&&o<=$.F)return o-($.A-10);if(o>=$.a&&o<=$.f)return o-($.a-10)}function Xt(o){if(typeof o!="string")throw new TypeError("hex string expected, got "+typeof o);if(Ee)try{return Uint8Array.fromHex(o)}catch(r){throw r instanceof SyntaxError?new RangeError(r.message):r}let t=o.length,n=t/2;if(t%2)throw new RangeError("hex string expected, got unpadded hex of length "+t);let e=new Uint8Array(n);for(let r=0,s=0;r<n;r++,s+=2){let i=be(o.charCodeAt(s)),c=be(o.charCodeAt(s+1));if(i===void 0||c===void 0){let u=o[s]+o[s+1];throw new RangeError('hex string expected, got non-hex character "'+u+'" at index '+s)}e[r]=i*16+c}return e}function ye(...o){let t=0;for(let e=0;e<o.length;e++){let r=o[e];J(r),t+=r.length}let n=new Uint8Array(t);for(let e=0,r=0;e<o.length;e++){let s=o[e];n.set(s,r),r+=s.length}return n}function we(o,t={}){let n=(r,s)=>o(s).update(r).digest(),e=o(void 0);return n.outputLen=e.outputLen,n.blockLen=e.blockLen,n.canXOF=e.canXOF,n.create=r=>o(r),Object.assign(n,t),Object.freeze(n)}function Be(o=32){Ft(o,"bytesLength");let t=typeof globalThis=="object"?globalThis.crypto:null;if(typeof t?.getRandomValues!="function")throw new Error("crypto.getRandomValues must be defined");if(o>65536)throw new RangeError(`"bytesLength" expected <= 65536, got ${o}`);return t.getRandomValues(new Uint8Array(o))}var Oe=o=>({oid:Uint8Array.from([6,9,96,134,72,1,101,3,4,2,o])});var H=(o,t,n)=>J(o,t,n),Kt=Ft,ve=Rt,ot=(...o)=>ye(...o),Fe=o=>Xt(o);var $t=o=>Be(o),It=BigInt(0),_t=BigInt(1);function gt(o,t=""){if(typeof o!="boolean"){let n=t&&`"${t}" `;throw new TypeError(n+"expected boolean, got type="+typeof o)}return o}function Tt(o){if(typeof o=="bigint"){if(!Nt(o))throw new RangeError("positive bigint expected, got "+o)}else Kt(o);return o}function tt(o,t=""){if(typeof o!="number"){let n=t&&`"${t}" `;throw new TypeError(n+"expected number, got type="+typeof o)}if(!Number.isSafeInteger(o)){let n=t&&`"${t}" `;throw new RangeError(n+"expected safe integer, got "+o)}}function xt(o){let t=Tt(o).toString(16);return t.length&1?"0"+t:t}function Se(o){if(typeof o!="string")throw new TypeError("hex string expected, got "+typeof o);return o===""?It:BigInt("0x"+o)}function Et(o){return Se(Rt(o))}function Wt(o){return Se(Rt(ln(J(o)).reverse()))}function qt(o,t){if(Ft(t),t===0)throw new RangeError("zero length");o=Tt(o);let n=o.toString(16);if(n.length>t*2)throw new RangeError("number too large");return Xt(n.padStart(t*2,"0"))}function Qt(o,t){return qt(o,t).reverse()}function ln(o){return Uint8Array.from(H(o))}var Nt=o=>typeof o=="bigint"&&It<=o;function dn(o,t,n){return Nt(o)&&Nt(t)&&Nt(n)&&t<=o&&o<n}function At(o,t,n,e){if(!dn(t,n,e))throw new RangeError("expected valid "+o+": "+n+" <= n < "+e+", got "+t)}function G(o){if(o<It)throw new Error("expected non-negative bigint, got "+o);let t;for(t=0;o>It;o>>=_t,t+=1);return t}function Re(o,t){return o>>BigInt(t)&_t}var jt=o=>(_t<<BigInt(o))-_t;function st(o,t={},n={}){if(Object.prototype.toString.call(o)!=="[object Object]")throw new TypeError("expected valid options object");function e(s,i,c){if(!c&&i!=="function"&&!Object.hasOwn(o,s))throw new TypeError(`param "${s}" is invalid: expected own property`);let u=o[s];if(c&&u===void 0)return;let f=typeof u;if(f!==i||u===null)throw new TypeError(`param "${s}" is invalid: expected ${i}, got ${f}`)}let r=(s,i)=>Object.entries(s).forEach(([c,u])=>e(c,u,i));r(t,!1),r(n,!0)}var Lt=()=>{throw new Error("not implemented")};var z=BigInt(0),j=BigInt(1),it=BigInt(2),_e=BigInt(3),Te=BigInt(4),qe=BigInt(5),hn=BigInt(7),Ae=BigInt(8),pn=BigInt(9),je=BigInt(16);function k(o,t){if(t<=z)throw new Error("mod: expected positive modulus, got "+t);let n=o%t;return n>=z?n:t+n}function Ne(o,t){if(o===z)throw new Error("invert: expected non-zero number");if(t<=z)throw new Error("invert: expected positive modulus, got "+t);let n=k(o,t),e=t,r=z,s=j,i=j,c=z;for(;n!==z;){let f=e/n,a=e-n*f,d=r-i*f,x=s-c*f;e=n,n=a,r=i,s=c,i=d,c=x}if(e!==j)throw new Error("invert: does not exist");return k(r,t)}function Pt(o,t,n){let e=o;if(!e.eql(e.sqr(t),n))throw new Error("Cannot find square root")}function Le(o,t){let n=o,e=(n.ORDER+j)/Te,r=n.pow(t,e);return Pt(n,r,t),r}function mn(o,t){let n=o,e=(n.ORDER-qe)/Ae,r=n.mul(t,it),s=n.pow(r,e),i=n.mul(t,s),c=n.mul(n.mul(i,it),s),u=n.mul(i,n.sub(c,n.ONE));return Pt(n,u,t),u}function bn(o){let t=et(o),n=De(o),e=n(t,t.neg(t.ONE)),r=n(t,e),s=n(t,t.neg(e)),i=(o+hn)/je;return((c,u)=>{let f=c,a=f.pow(u,i),d=f.mul(a,e),x=f.mul(a,r),y=f.mul(a,s),N=f.eql(f.sqr(d),u),I=f.eql(f.sqr(x),u);a=f.cmov(a,d,N),d=f.cmov(y,x,I);let A=f.eql(f.sqr(d),u),D=f.cmov(a,d,A);return Pt(f,D,u),D})}function De(o){if(o<_e)throw new Error("sqrt is not defined for small field");let t=o-j,n=0;for(;t%it===z;)t/=it,n++;let e=it,r=et(o);for(;yt(r,e)===1;)if(e++>1e3)throw new Error("Cannot find square root: probably non-prime P");if(n===1)return Le;let s=r.pow(e,t),i=(t+j)/it;return function(u,f){let a=u;if(a.is0(f))return f;if(yt(a,f)!==1)throw new Error("Cannot find square root");let d=n,x=a.mul(a.ONE,s),y=a.pow(f,t),N=a.pow(f,i);for(;!a.eql(y,a.ONE);){if(a.is0(y))return a.ZERO;let I=1,A=a.sqr(y);for(;!a.eql(A,a.ONE);)if(I++,A=a.sqr(A),I===d)throw new Error("Cannot find square root");let D=j<<BigInt(d-I-1),rt=a.pow(x,D);d=I,x=a.sqr(rt),y=a.mul(y,x),N=a.mul(N,rt)}return N}}function gn(o){return o%Te===_e?Le:o%Ae===qe?mn:o%je===pn?bn(o):De(o)}var xn=["create","isValid","is0","neg","inv","sqrt","sqr","eql","add","sub","mul","pow","div","addN","subN","mulN","sqrN"];function Ue(o){let t={ORDER:"bigint",BYTES:"number",BITS:"number"},n=xn.reduce((e,r)=>(e[r]="function",e),t);if(st(o,n),tt(o.BYTES,"BYTES"),tt(o.BITS,"BITS"),o.BYTES<1||o.BITS<1)throw new Error("invalid field: expected BYTES/BITS > 0");if(o.ORDER<=j)throw new Error("invalid field: expected ORDER > 1, got "+o.ORDER);return o}function wt(o,t,n){let e=o;if(n<z)throw new Error("invalid exponent, negatives unsupported");if(n===z)return e.ONE;if(n===j)return t;let r=e.ONE,s=t;for(;n>z;)n&j&&(r=e.mul(r,s)),s=e.sqr(s),n>>=j;return r}function ct(o,t,n=!1){let e=o,r=new Array(t.length).fill(n?e.ZERO:void 0),s=t.reduce((c,u,f)=>e.is0(u)?c:(r[f]=c,e.mul(c,u)),e.ONE),i=e.inv(s);return t.reduceRight((c,u,f)=>e.is0(u)?c:(r[f]=e.mul(c,r[f]),e.mul(c,u)),i),r}function yt(o,t){let n=o,e=(n.ORDER-j)/it,r=n.pow(t,e),s=n.eql(r,n.ONE),i=n.eql(r,n.ZERO),c=n.eql(r,n.neg(n.ONE));if(!s&&!i&&!c)throw new Error("invalid Legendre symbol result");return s?1:i?0:-1}function En(o,t){if(t!==void 0&&Kt(t),o<=z)throw new Error("invalid n length: expected positive n, got "+o);if(t!==void 0&&t<1)throw new Error("invalid n length: expected positive bit length, got "+t);let n=G(o);if(t!==void 0&&t<n)throw new Error(`invalid n length: expected bit length (${n}) >= n.length (${t})`);let e=t!==void 0?t:n,r=Math.ceil(e/8);return{nBitLength:e,nByteLength:r}}var Ie=new WeakMap,Dt=class{ORDER;BITS;BYTES;isLE;ZERO=z;ONE=j;_lengths;_mod;constructor(t,n={}){if(t<=j)throw new Error("invalid field: expected ORDER > 1, got "+t);let e;this.isLE=!1,n!=null&&typeof n=="object"&&(typeof n.BITS=="number"&&(e=n.BITS),typeof n.sqrt=="function"&&Object.defineProperty(this,"sqrt",{value:n.sqrt,enumerable:!0}),typeof n.isLE=="boolean"&&(this.isLE=n.isLE),n.allowedLengths&&(this._lengths=Object.freeze(n.allowedLengths.slice())),typeof n.modFromBytes=="boolean"&&(this._mod=n.modFromBytes));let{nBitLength:r,nByteLength:s}=En(t,e);if(s>2048)throw new Error("invalid field: expected ORDER of <= 2048 bytes");this.ORDER=t,this.BITS=r,this.BYTES=s,Object.freeze(this)}create(t){return k(t,this.ORDER)}isValid(t){if(typeof t!="bigint")throw new TypeError("invalid field element: expected bigint, got "+typeof t);return z<=t&&t<this.ORDER}is0(t){return t===z}isValidNot0(t){return!this.is0(t)&&this.isValid(t)}isOdd(t){return(t&j)===j}neg(t){return k(-t,this.ORDER)}eql(t,n){return t===n}sqr(t){return k(t*t,this.ORDER)}add(t,n){return k(t+n,this.ORDER)}sub(t,n){return k(t-n,this.ORDER)}mul(t,n){return k(t*n,this.ORDER)}pow(t,n){return wt(this,t,n)}div(t,n){return k(t*Ne(n,this.ORDER),this.ORDER)}sqrN(t){return t*t}addN(t,n){return t+n}subN(t,n){return t-n}mulN(t,n){return t*n}inv(t){return Ne(t,this.ORDER)}sqrt(t){let n=Ie.get(this);return n||Ie.set(this,n=gn(this.ORDER)),n(this,t)}toBytes(t){return this.isLE?Qt(t,this.BYTES):qt(t,this.BYTES)}fromBytes(t,n=!1){H(t);let{_lengths:e,BYTES:r,isLE:s,ORDER:i,_mod:c}=this;if(e){if(t.length<1||!e.includes(t.length)||t.length>r)throw new Error("Field.fromBytes: expected "+e+" bytes, got "+t.length);let f=new Uint8Array(r);f.set(t,s?0:f.length-t.length),t=f}if(t.length!==r)throw new Error("Field.fromBytes: expected "+r+" bytes, got "+t.length);let u=s?Wt(t):Et(t);if(c&&(u=k(u,i)),!n&&!this.isValid(u))throw new Error("invalid field element: outside of range 0..ORDER");return u}invertBatch(t){return ct(this,t)}cmov(t,n,e){return gt(e,"condition"),e?n:t}};Object.freeze(Dt.prototype);function et(o,t={}){return new Dt(o,t)}function He(o){if(typeof o!="bigint")throw new Error("field order must be bigint");if(o<=j)throw new Error("field order must be greater than 1");let t=G(o-j);return Math.ceil(t/8)}function Jt(o){let t=He(o);return t+Math.ceil(t/2)}function ze(o,t,n=!1){H(o);let e=o.length,r=He(t),s=Math.max(Jt(t),16);if(e<s||e>1024)throw new Error("expected "+s+"-1024 bytes of input, got "+e);let i=n?Wt(o):Et(o),c=k(i,t-j)+j;return n?Qt(c,r):qt(c,r)}var dt=BigInt(0),ut=BigInt(1);function Bt(o,t){let n=t.negate();return o?n:t}function re(o,t){let n=ct(o.Fp,t.map(e=>e.Z));return t.map((e,r)=>o.fromAffine(e.toAffine(n[r])))}function Me(o,t){if(!Number.isSafeInteger(o)||o<=0||o>t)throw new Error("invalid window size, expected [1.."+t+"], got W="+o)}function te(o,t){Me(o,t);let n=Math.ceil(t/o)+1,e=2**(o-1),r=2**o,s=jt(o),i=BigInt(o);return{windows:n,windowSize:e,mask:s,maxNumber:r,shiftBy:i}}function Ce(o,t,n){let{windowSize:e,mask:r,maxNumber:s,shiftBy:i}=n,c=Number(o&r),u=o>>i;c>e&&(c-=s,u+=ut);let f=t*e,a=f+Math.abs(c)-1,d=c===0,x=c<0,y=t%2!==0;return{nextN:u,offset:a,isZero:d,isNeg:x,isNegF:y,offsetF:f}}var ee=new WeakMap,Ye=new WeakMap;function ne(o){return Ye.get(o)||1}function Ze(o){if(o!==dt)throw new Error("invalid wNAF")}var Ut=class{BASE;ZERO;Fn;bits;constructor(t,n){this.BASE=t.BASE,this.ZERO=t.ZERO,this.Fn=t.Fn,this.bits=n}_unsafeLadder(t,n,e=this.ZERO){let r=t;for(;n>dt;)n&ut&&(e=e.add(r)),r=r.double(),n>>=ut;return e}precomputeWindow(t,n){let{windows:e,windowSize:r}=te(n,this.bits),s=[],i=t,c=i;for(let u=0;u<e;u++){c=i,s.push(c);for(let f=1;f<r;f++)c=c.add(i),s.push(c);i=c.double()}return s}wNAF(t,n,e){if(!this.Fn.isValid(e))throw new Error("invalid scalar");let r=this.ZERO,s=this.BASE,i=te(t,this.bits);for(let c=0;c<i.windows;c++){let{nextN:u,offset:f,isZero:a,isNeg:d,isNegF:x,offsetF:y}=Ce(e,c,i);e=u,a?s=s.add(Bt(x,n[y])):r=r.add(Bt(d,n[f]))}return Ze(e),{p:r,f:s}}wNAFUnsafe(t,n,e,r=this.ZERO){let s=te(t,this.bits);for(let i=0;i<s.windows&&e!==dt;i++){let{nextN:c,offset:u,isZero:f,isNeg:a}=Ce(e,i,s);if(e=c,!f){let d=n[u];r=r.add(a?d.negate():d)}}return Ze(e),r}getPrecomputes(t,n,e){let r=ee.get(n);return r||(r=this.precomputeWindow(n,t),t!==1&&(typeof e=="function"&&(r=e(r)),ee.set(n,r))),r}cached(t,n,e){let r=ne(t);return this.wNAF(r,this.getPrecomputes(r,t,e),n)}unsafe(t,n,e,r){let s=ne(t);return s===1?this._unsafeLadder(t,n,r):this.wNAFUnsafe(s,this.getPrecomputes(s,t,e),n,r)}createCache(t,n){Me(n,this.bits),Ye.set(t,n),ee.delete(t)}hasCache(t){return ne(t)!==1}};function Ge(o,t,n,e){let r=t,s=o.ZERO,i=o.ZERO;for(;n>dt||e>dt;)n&ut&&(s=s.add(r)),e&ut&&(i=i.add(r)),r=r.double(),n>>=ut,e>>=ut;return{p1:s,p2:i}}function Ve(o,t,n){if(t){if(t.ORDER!==o)throw new Error("Field.ORDER must match order: Fp == p, Fn == n");return Ue(t),t}else return et(o,{isLE:n})}function ke(o,t,n={},e){if(e===void 0&&(e=o==="edwards"),!t||typeof t!="object")throw new Error(`expected valid ${o} CURVE object`);for(let u of["p","n","h"]){let f=t[u];if(!(typeof f=="bigint"&&f>dt))throw new Error(`CURVE.${u} must be positive bigint`)}let r=Ve(t.p,n.Fp,e),s=Ve(t.n,n.Fn,e),c=["Gx","Gy","a",o==="weierstrass"?"b":"d"];for(let u of c)if(!r.isValid(t[u]))throw new Error(`CURVE.${u} must be valid field element of CURVE.Fp`);return t=Object.freeze(Object.assign({},t)),{CURVE:t,Fp:r,Fn:s}}var Xe=(o,t)=>(o+(o>=0?t:-t)/Bn)/t;function wn(o,t,n){At("scalar",o,ft,n);let[[e,r],[s,i]]=t,c=Xe(i*o,n),u=Xe(-r*o,n),f=o-c*e-u*s,a=-c*r-u*i,d=f<ft,x=a<ft;d&&(f=-f),x&&(a=-a);let y=jt(Math.ceil(G(n)/2))+Ot;if(f<ft||f>=y||a<ft||a>=y)throw new Error("splitScalar (endomorphism): failed for k");return{k1neg:d,k1:f,k2neg:x,k2:a}}var oe=class extends Error{constructor(t=""){super(t)}},W={Err:oe,_tlv:{encode:(o,t)=>{let{Err:n}=W;if(tt(o,"tag"),o<0||o>255)throw new n("tlv.encode: wrong tag");if(typeof t!="string")throw new TypeError('"data" expected string, got type='+typeof t);if(t.length&1)throw new n("tlv.encode: unpadded data");let e=t.length/2,r=xt(e);if(r.length/2&128)throw new n("tlv.encode: long form length too big");let s=e>127?xt(r.length/2|128):"";return xt(o)+s+r+t},decode(o,t){let{Err:n}=W;t=H(t,void 0,"DER data");let e=0;if(o<0||o>255)throw new n("tlv.encode: wrong tag");if(t.length<2||t[e++]!==o)throw new n("tlv.decode: wrong tlv");let r=t[e++],s=!!(r&128),i=0;if(!s)i=r;else{let u=r&127;if(!u)throw new n("tlv.decode(long): indefinite length not supported");if(u>4)throw new n("tlv.decode(long): byte length is too big");let f=t.subarray(e,e+u);if(f.length!==u)throw new n("tlv.decode: length bytes not complete");if(f[0]===0)throw new n("tlv.decode(long): zero leftmost byte");for(let a of f)i=i<<8|a;if(e+=u,i<128)throw new n("tlv.decode(long): not minimal encoding")}let c=t.subarray(e,e+i);if(c.length!==i)throw new n("tlv.decode: wrong value length");return{v:c,l:t.subarray(e+i)}}},_int:{encode(o){let{Err:t}=W;if(Tt(o),o<ft)throw new t("integer: negative integers are not allowed");let n=xt(o);if(Number.parseInt(n[0],16)&8&&(n="00"+n),n.length&1)throw new t("unexpected DER parsing assertion: unpadded hex");return n},decode(o){let{Err:t}=W;if(o.length<1)throw new t("invalid signature integer: empty");if(o[0]&128)throw new t("invalid signature integer: negative");if(o.length>1&&o[0]===0&&!(o[1]&128))throw new t("invalid signature integer: unnecessary leading zero");return Et(o)}},toSig(o){let{Err:t,_int:n,_tlv:e}=W,r=H(o,void 0,"signature"),{v:s,l:i}=e.decode(48,r);if(i.length)throw new t("invalid signature: left bytes after parsing");let{v:c,l:u}=e.decode(2,s),{v:f,l:a}=e.decode(2,u);if(a.length)throw new t("invalid signature: left bytes after parsing");return{r:n.decode(c),s:n.decode(f)}},hexFromSig(o){let{_tlv:t,_int:n}=W,e=t.encode(2,n.encode(o.r)),r=t.encode(2,n.encode(o.s)),s=e+r;return t.encode(48,s)}};Object.freeze(W._tlv);Object.freeze(W._int);Object.freeze(W);var ft=BigInt(0),Ot=BigInt(1),Bn=BigInt(2),Ht=BigInt(3),On=BigInt(4);function se(o,t={}){let n=ke("weierstrass",o,t),e=n.Fp,r=n.Fn,s=n.CURVE,{h:i,n:c}=s;st(t,{},{allowInfinityPoint:"boolean",clearCofactor:"function",isTorsionFree:"function",fromBytes:"function",toBytes:"function",endo:"object"});let{endo:u,allowInfinityPoint:f}=t;if(u&&(!e.is0(s.a)||typeof u.beta!="bigint"||!Array.isArray(u.basises)))throw new Error('invalid endo: expected "beta": bigint and "basises": array');let a=Fn(e,r);function d(){if(!e.isOdd)throw new Error("compression is not supported: Field does not have .isOdd()")}function x(E,l,h){if(f&&l.is0())return Uint8Array.of(0);let{x:p,y:b}=l.toAffine(),O=e.toBytes(p);if(gt(h,"isCompressed"),h){d();let w=!e.isOdd(b);return ot(vn(w),O)}else return ot(Uint8Array.of(4),O,e.toBytes(b))}function y(E){H(E,void 0,"Point");let{publicKey:l,publicKeyUncompressed:h}=a,p=E.length,b=E[0],O=E.subarray(1);if(f&&p===1&&b===0)return{x:e.ZERO,y:e.ZERO};if(p===l&&(b===2||b===3)){let w=e.fromBytes(O);if(!e.isValid(w))throw new Error("bad point: is not on curve, wrong x");let B=A(w),m;try{m=e.sqrt(B)}catch(Z){let L=Z instanceof Error?": "+Z.message:"";throw new Error("bad point: is not on curve, sqrt error"+L)}d();let v=e.isOdd(m);return(b&1)===1!==v&&(m=e.neg(m)),{x:w,y:m}}else if(p===h&&b===4){let w=e.BYTES,B=e.fromBytes(O.subarray(0,w)),m=e.fromBytes(O.subarray(w,w*2));if(!D(B,m))throw new Error("bad point: is not on curve");return{x:B,y:m}}else throw new Error(`bad point: got length ${p}, expected compressed=${l} or uncompressed=${h}`)}let N=t.toBytes===void 0?x:t.toBytes,I=t.fromBytes===void 0?y:t.fromBytes;function A(E){let l=e.sqr(E),h=e.mul(l,E);return e.add(e.add(h,e.mul(E,s.a)),s.b)}function D(E,l){let h=e.sqr(l),p=A(E);return e.eql(h,p)}if(!D(s.Gx,s.Gy))throw new Error("bad curve params: generator point");let rt=e.mul(e.pow(s.a,Ht),On),Gt=e.mul(e.sqr(s.b),BigInt(27));if(e.is0(e.add(rt,Gt)))throw new Error("bad curve params: a or b");function P(E,l,h=!1){if(!e.isValid(l)||h&&e.is0(l))throw new Error(`bad point coordinate ${E}`);return l}function mt(E){if(!(E instanceof g))throw new Error("Weierstrass Point expected")}function vt(E){if(!u||!u.basises)throw new Error("no endo");return wn(E,u.basises,r.ORDER)}function T(E,l,h,p,b){return h=new g(e.mul(h.X,E),h.Y,h.Z),l=Bt(p,l),h=Bt(b,h),l.add(h)}class g{static BASE=new g(s.Gx,s.Gy,e.ONE);static ZERO=new g(e.ZERO,e.ONE,e.ZERO);static Fp=e;static Fn=r;X;Y;Z;constructor(l,h,p){this.X=P("x",l),this.Y=P("y",h,!0),this.Z=P("z",p),Object.freeze(this)}static CURVE(){return s}static fromAffine(l){let{x:h,y:p}=l||{};if(!l||!e.isValid(h)||!e.isValid(p))throw new Error("invalid affine point");if(l instanceof g)throw new Error("projective point not allowed");return e.is0(h)&&e.is0(p)?g.ZERO:new g(h,p,e.ONE)}static fromBytes(l){let h=g.fromAffine(I(H(l,void 0,"point")));return h.assertValidity(),h}static fromHex(l){return g.fromBytes(Fe(l))}get x(){return this.toAffine().x}get y(){return this.toAffine().y}precompute(l=8,h=!0){return R.createCache(this,l),h||this.multiply(Ht),this}assertValidity(){let l=this;if(l.is0()){if(t.allowInfinityPoint&&e.is0(l.X)&&e.eql(l.Y,e.ONE)&&e.is0(l.Z))return;throw new Error("bad point: ZERO")}let{x:h,y:p}=l.toAffine();if(!e.isValid(h)||!e.isValid(p))throw new Error("bad point: x or y not field elements");if(!D(h,p))throw new Error("bad point: equation left != right");if(!l.isTorsionFree())throw new Error("bad point: not in prime-order subgroup")}hasEvenY(){let{y:l}=this.toAffine();if(!e.isOdd)throw new Error("Field doesn't support isOdd");return!e.isOdd(l)}equals(l){mt(l);let{X:h,Y:p,Z:b}=this,{X:O,Y:w,Z:B}=l,m=e.eql(e.mul(h,B),e.mul(O,b)),v=e.eql(e.mul(p,B),e.mul(w,b));return m&&v}negate(){return new g(this.X,e.neg(this.Y),this.Z)}double(){let{a:l,b:h}=s,p=e.mul(h,Ht),{X:b,Y:O,Z:w}=this,B=e.ZERO,m=e.ZERO,v=e.ZERO,F=e.mul(b,b),Z=e.mul(O,O),L=e.mul(w,w),q=e.mul(b,O);return q=e.add(q,q),v=e.mul(b,w),v=e.add(v,v),B=e.mul(l,v),m=e.mul(p,L),m=e.add(B,m),B=e.sub(Z,m),m=e.add(Z,m),m=e.mul(B,m),B=e.mul(q,B),v=e.mul(p,v),L=e.mul(l,L),q=e.sub(F,L),q=e.mul(l,q),q=e.add(q,v),v=e.add(F,F),F=e.add(v,F),F=e.add(F,L),F=e.mul(F,q),m=e.add(m,F),L=e.mul(O,w),L=e.add(L,L),F=e.mul(L,q),B=e.sub(B,F),v=e.mul(L,Z),v=e.add(v,v),v=e.add(v,v),new g(B,m,v)}add(l){mt(l);let{X:h,Y:p,Z:b}=this,{X:O,Y:w,Z:B}=l,m=e.ZERO,v=e.ZERO,F=e.ZERO,Z=s.a,L=e.mul(s.b,Ht),q=e.mul(h,O),V=e.mul(p,w),M=e.mul(b,B),lt=e.add(h,p),U=e.add(O,w);lt=e.mul(lt,U),U=e.add(q,V),lt=e.sub(lt,U),U=e.add(h,b);let X=e.add(O,B);return U=e.mul(U,X),X=e.add(q,M),U=e.sub(U,X),X=e.add(p,b),m=e.add(w,B),X=e.mul(X,m),m=e.add(V,M),X=e.sub(X,m),F=e.mul(Z,U),m=e.mul(L,M),F=e.add(m,F),m=e.sub(V,F),F=e.add(V,F),v=e.mul(m,F),V=e.add(q,q),V=e.add(V,q),M=e.mul(Z,M),U=e.mul(L,U),V=e.add(V,M),M=e.sub(q,M),M=e.mul(Z,M),U=e.add(U,M),q=e.mul(V,U),v=e.add(v,q),q=e.mul(X,U),m=e.mul(lt,m),m=e.sub(m,q),q=e.mul(lt,V),F=e.mul(X,F),F=e.add(F,q),new g(m,v,F)}subtract(l){return mt(l),this.add(l.negate())}is0(){return this.equals(g.ZERO)}multiply(l){let{endo:h}=t;if(!r.isValidNot0(l))throw new RangeError("invalid scalar: out of range");let p,b,O=w=>R.cached(this,w,B=>re(g,B));if(h){let{k1neg:w,k1:B,k2neg:m,k2:v}=vt(l),{p:F,f:Z}=O(B),{p:L,f:q}=O(v);b=Z.add(q),p=T(h.beta,F,L,w,m)}else{let{p:w,f:B}=O(l);p=w,b=B}return re(g,[p,b])[0]}multiplyUnsafe(l){let{endo:h}=t,p=this,b=l;if(!r.isValid(b))throw new RangeError("invalid scalar: out of range");if(b===ft||p.is0())return g.ZERO;if(b===Ot)return p;if(R.hasCache(this))return this.multiply(b);if(h){let{k1neg:O,k1:w,k2neg:B,k2:m}=vt(b),{p1:v,p2:F}=Ge(g,p,w,m);return T(h.beta,v,F,O,B)}else return R.unsafe(p,b)}toAffine(l){let h=this,p=l,{X:b,Y:O,Z:w}=h;if(e.eql(w,e.ONE))return{x:b,y:O};let B=h.is0();p==null&&(p=B?e.ONE:e.inv(w));let m=e.mul(b,p),v=e.mul(O,p),F=e.mul(w,p);if(B)return{x:e.ZERO,y:e.ZERO};if(!e.eql(F,e.ONE))throw new Error("invZ was invalid");return{x:m,y:v}}isTorsionFree(){let{isTorsionFree:l}=t;return i===Ot?!0:l?l(g,this):R.unsafe(this,c).is0()}clearCofactor(){let{clearCofactor:l}=t;return i===Ot?this:l?l(g,this):this.multiplyUnsafe(i)}isSmallOrder(){return i===Ot?this.is0():this.clearCofactor().is0()}toBytes(l=!0){return gt(l,"isCompressed"),this.assertValidity(),N(g,this,l)}toHex(l=!0){return ve(this.toBytes(l))}toString(){return`<Point ${this.is0()?"ZERO":this.toHex()}>`}}let S=r.BITS,R=new Ut(g,t.endo?Math.ceil(S/2):S);return S>=8&&g.BASE.precompute(8),Object.freeze(g.prototype),Object.freeze(g),g}function vn(o){return Uint8Array.of(o?2:3)}function Fn(o,t){return{secretKey:t.BYTES,publicKey:1+o.BYTES,publicKeyUncompressed:1+2*o.BYTES,publicKeyHasPrefix:!0,signature:2*t.BYTES}}var Sn=BigInt(0),zt=BigInt(1),Ke=BigInt(2),ht=BigInt(3);function Rn(o){let t=[];for(;o>zt;o>>=zt)(o&zt)===Sn?t.unshift(0):(o&ht)===ht?(t.unshift(-1),o+=zt):t.unshift(1);return t}function Nn(o,t,n,e){let{Fr:r,Fp2:s,Fp12:i}=o,{twistType:c,ateLoopSize:u,xNegative:f,postPrecompute:a}=e,d;if(c==="multiplicative")d=(T,g,S,R,E,l)=>i.mul014(R,T,s.mul(g,E),s.mul(S,l));else if(c==="divisive")d=(T,g,S,R,E,l)=>i.mul034(R,s.mul(S,l),s.mul(g,E),T);else throw new Error("bls: unknown twist type");let x=s.div(s.ONE,s.mul(s.ONE,Ke));function y(T,g,S,R){let E=s.sqr(S),l=s.sqr(R),h=s.mulByB(s.mul(l,ht)),p=s.mul(h,ht),b=s.sub(s.sub(s.sqr(s.add(S,R)),l),E),O=s.sub(h,E),w=s.mul(s.sqr(g),ht),B=s.neg(b);return T.push([O,w,B]),g=s.mul(s.mul(s.mul(s.sub(E,p),g),S),x),S=s.sub(s.sqr(s.mul(s.add(E,p),x)),s.mul(s.sqr(h),ht)),R=s.mul(E,b),{Rx:g,Ry:S,Rz:R}}function N(T,g,S,R,E,l){let h=s.sub(S,s.mul(l,R)),p=s.sub(g,s.mul(E,R)),b=s.sub(s.mul(h,E),s.mul(p,l)),O=s.neg(h),w=p;T.push([b,O,w]);let B=s.sqr(p),m=s.mul(B,p),v=s.mul(B,g),F=s.add(s.sub(m,s.mul(v,Ke)),s.mul(s.sqr(h),R));return g=s.mul(p,F),S=s.sub(s.mul(s.sub(v,F),h),s.mul(m,S)),R=s.mul(R,m),{Rx:g,Ry:S,Rz:R}}let I=Rn(u),A=T=>{let g=T,{x:S,y:R}=g.toAffine(),E=S,l=R,h=s.neg(R),p=E,b=l,O=s.ONE,w=[];for(let B of I){let m=[];({Rx:p,Ry:b,Rz:O}=y(m,p,b,O)),B&&({Rx:p,Ry:b,Rz:O}=N(m,p,b,O,E,B===-1?h:l)),w.push(m)}if(a){let B=w[w.length-1];a(p,b,O,E,l,N.bind(null,B))}return w};function D(T,g=!1){let S=i.ONE;if(T.length){let R=T[0][0].length;for(let E=0;E<R;E++){S=i.sqr(S);for(let[l,h,p]of T)for(let[b,O,w]of l[E])S=d(b,O,w,S,h,p)}}return f&&(S=i.conjugate(S)),g?i.finalExponentiate(S):S}function rt(T,g=!0){let S=[];for(let{g1:R,g2:E}of T){if(R.is0()||E.is0())throw new Error("pairing is not available for ZERO point");R.assertValidity(),E.assertValidity();let l=R.toAffine();S.push([A(E),l.x,l.y])}return D(S,g)}function Gt(T,g,S=!0){return rt([{g1:T,g2:g}],S)}let P={seed:Jt(r.ORDER)},mt=e.randomBytes===void 0?$t:e.randomBytes,vt=T=>(T=T===void 0?mt(P.seed):T,H(T,P.seed,"seed"),ze(T,r.ORDER));return Object.freeze(P),{lengths:P,Fr:r,Fp12:i,millerLoopBatch:D,pairing:Gt,pairingBatch:rt,calcPairingPrecomputes:A,randomSecretKey:vt}}function $e(o,t,n,e){let{Fp:r,Fr:s,Fp2:i,Fp6:c,Fp12:u}=o,f={Point:t},a={Point:n},d=Nn(o,t,n,e),{millerLoopBatch:x,pairing:y,pairingBatch:N,calcPairingPrecomputes:I,randomSecretKey:A,lengths:D}=d;return f.Point.BASE.precompute(4),Object.freeze(f),Object.freeze(a),Object.freeze({lengths:Object.freeze(D),millerLoopBatch:x,pairing:y,pairingBatch:N,G1:f,G2:a,fields:Object.freeze({Fr:s,Fp:r,Fp2:i,Fp6:c,Fp12:u}),params:Object.freeze({ateLoopSize:e.ateLoopSize,twistType:e.twistType}),utils:Object.freeze({randomSecretKey:A,calcPairingPrecomputes:I})})}var Pe=BigInt(0),at=BigInt(1),C=BigInt(2),We=BigInt(3),In=BigInt(6),_n=BigInt(12),pt=o=>!!o&&typeof o=="object";function fe(o,t,n,e,r=1,s){tt(r,"num");let i=o;if(r<=0)throw new Error("calcFrobeniusCoefficients: expected positive row count, got "+r);let c=BigInt(s===void 0?e:s),u=n**BigInt(e),f=[];for(let a=0;a<r;a++){let d=BigInt(a+1),x=[];for(let y=0,N=at;y<e;y++){let I=d*N-d;if(I%c)throw new Error("calcFrobeniusCoefficients: inexact tower exponent");let A=I/c%u;x.push(i.pow(t,A)),N*=n}f.push(x)}return f}function Je(o,t,n){let e=t.pow(n,(o.ORDER-at)/We),r=t.pow(n,(o.ORDER-at)/C);function s(x,y){let N=t.mul(t.frobeniusMap(x,1),e),I=t.mul(t.frobeniusMap(y,1),r);return[N,I]}let i=t.pow(n,(o.ORDER**C-at)/We),c=t.pow(n,(o.ORDER**C-at)/C);if(!t.eql(c,t.neg(t.ONE)))throw new Error("psiFrobenius: PSI2_Y!==-1");function u(x,y){return[t.mul(x,i),t.neg(y)]}let f=x=>(y,N)=>{let I=N.toAffine(),A=x(I.x,I.y);return y.fromAffine({x:A[0],y:A[1]})},a=f(s),d=f(u);return{psi:s,psi2:u,G2psi:a,G2psi2:d,PSI_X:e,PSI_Y:r,PSI2_X:i,PSI2_Y:c}}var ie=class{ORDER;BITS;BYTES;isLE;ZERO;ONE;Fp;NONRESIDUE;mulByB;Fp_NONRESIDUE;Fp_div2;FROBENIUS_COEFFICIENTS;constructor(t,n={}){let{NONRESIDUE:e=BigInt(-1),FP2_NONRESIDUE:r,Fp2mulByB:s}=n,i=t.ORDER,c=i*i;this.Fp=t,this.ORDER=c,this.BITS=G(c),this.BYTES=Math.ceil(G(c)/8),this.isLE=t.isLE,this.ZERO=this.create({c0:t.ZERO,c1:t.ZERO}),this.ONE=this.create({c0:t.ONE,c1:t.ZERO}),this.Fp_NONRESIDUE=t.create(e),this.Fp_div2=t.div(t.ONE,C),this.NONRESIDUE=this.create({c0:r[0],c1:r[1]}),this.FROBENIUS_COEFFICIENTS=Object.freeze(fe(t,this.Fp_NONRESIDUE,t.ORDER,2)[0]),this.mulByB=u=>{let{c0:f,c1:a}=s(u);return Object.freeze({c0:f,c1:a})},Object.freeze(this)}fromBigTuple(t){if(!Array.isArray(t)||t.length!==2)throw new Error("invalid Fp2.fromBigTuple");let[n,e]=t;if(typeof n!="bigint"||typeof e!="bigint")throw new Error("invalid Fp2.fromBigTuple");return this.create({c0:n,c1:e})}create(t){let{Fp:n}=this,e=n.create(t.c0),r=n.create(t.c1);return Object.freeze({c0:e,c1:r})}isValid(t){if(!pt(t))throw new TypeError("invalid field element: expected object, got "+typeof t);let{c0:n,c1:e}=t,{Fp:r}=this;return r.isValid(n)&&r.isValid(e)}is0(t){if(!pt(t))return!1;let{c0:n,c1:e}=t,{Fp:r}=this;return r.is0(n)&&r.is0(e)}isValidNot0(t){return!this.is0(t)&&this.isValid(t)}eql({c0:t,c1:n},{c0:e,c1:r}){let{Fp:s}=this;return s.eql(t,e)&&s.eql(n,r)}neg({c0:t,c1:n}){let{Fp:e}=this;return Object.freeze({c0:e.neg(t),c1:e.neg(n)})}pow(t,n){return wt(this,t,n)}invertBatch(t){return ct(this,t)}add(t,n){let{Fp:e}=this,{c0:r,c1:s}=t,{c0:i,c1:c}=n;return Object.freeze({c0:e.add(r,i),c1:e.add(s,c)})}sub({c0:t,c1:n},{c0:e,c1:r}){let{Fp:s}=this;return Object.freeze({c0:s.sub(t,e),c1:s.sub(n,r)})}mul({c0:t,c1:n},e){let{Fp:r}=this;if(typeof e=="bigint")return Object.freeze({c0:r.mul(t,e),c1:r.mul(n,e)});let{c0:s,c1:i}=e,c=r.mul(t,s),u=r.mul(n,i),f=r.sub(c,u),a=r.sub(r.mul(r.add(t,n),r.add(s,i)),r.add(c,u));return Object.freeze({c0:f,c1:a})}sqr({c0:t,c1:n}){let{Fp:e}=this,r=e.add(t,n),s=e.sub(t,n),i=e.add(t,t);return Object.freeze({c0:e.mul(r,s),c1:e.mul(i,n)})}addN(t,n){return this.add(t,n)}subN(t,n){return this.sub(t,n)}mulN(t,n){return this.mul(t,n)}sqrN(t){return this.sqr(t)}div(t,n){let{Fp:e}=this;return this.mul(t,typeof n=="bigint"?e.inv(e.create(n)):this.inv(n))}inv({c0:t,c1:n}){let{Fp:e}=this,r=e.inv(e.create(t*t+n*n));return Object.freeze({c0:e.mul(r,e.create(t)),c1:e.mul(r,e.create(-n))})}sqrt(t){let{Fp:n}=this,e=this,{c0:r,c1:s}=t;if(n.is0(s))return yt(n,r)===1?e.create({c0:n.sqrt(r),c1:n.ZERO}):e.create({c0:n.ZERO,c1:n.sqrt(n.div(r,this.Fp_NONRESIDUE))});let i=n.sqrt(n.sub(n.sqr(r),n.mul(n.sqr(s),this.Fp_NONRESIDUE))),c=n.mul(n.add(i,r),this.Fp_div2);yt(n,c)===-1&&(c=n.sub(c,i));let f=n.sqrt(c),a=e.create({c0:f,c1:n.div(n.mul(s,this.Fp_div2),f)});if(!e.eql(e.sqr(a),t))throw new Error("Cannot find square root");let d=a,x=e.neg(d),{re:y,im:N}=e.reim(d),{re:I,im:A}=e.reim(x);return N>A||N===A&&y>I?d:x}isOdd(t){let{re:n,im:e}=this.reim(t),r=n%C,s=n===Pe,i=e%C;return BigInt(r||s&&i)==at}fromBytes(t){let{Fp:n}=this;if(H(t),t.length!==this.BYTES)throw new Error("fromBytes invalid length="+t.length);return this.create({c0:n.fromBytes(t.subarray(0,n.BYTES)),c1:n.fromBytes(t.subarray(n.BYTES))})}toBytes({c0:t,c1:n}){return ot(this.Fp.toBytes(t),this.Fp.toBytes(n))}cmov({c0:t,c1:n},{c0:e,c1:r},s){let{Fp:i}=this;return this.create({c0:i.cmov(t,e,s),c1:i.cmov(n,r,s)})}reim({c0:t,c1:n}){return{re:t,im:n}}Fp4Square(t,n){let e=this,r=e.sqr(t),s=e.sqr(n);return{first:e.add(e.mulByNonresidue(s),r),second:e.sub(e.sub(e.sqr(e.add(t,n)),r),s)}}mulByNonresidue({c0:t,c1:n}){return this.mul({c0:t,c1:n},this.NONRESIDUE)}frobeniusMap({c0:t,c1:n},e){return Object.freeze({c0:t,c1:this.Fp.mul(n,this.FROBENIUS_COEFFICIENTS[e%2])})}},ce=class{ORDER;BITS;BYTES;isLE;ZERO;ONE;Fp2;constructor(t){this.Fp2=t,this.ORDER=t.Fp.ORDER**In,this.BITS=3*t.BITS,this.BYTES=3*t.BYTES,this.isLE=t.isLE,this.ZERO=this.create({c0:t.ZERO,c1:t.ZERO,c2:t.ZERO}),this.ONE=this.create({c0:t.ONE,c1:t.ZERO,c2:t.ZERO}),Object.freeze(this)}get FROBENIUS_COEFFICIENTS_1(){let t=Ct.get(this);if(t)return t[0];let{Fp2:n}=this,{Fp:e}=n,r=fe(n,n.NONRESIDUE,e.ORDER,6,2,3),s=[Object.freeze(r[0]),Object.freeze(r[1])];return Ct.set(this,s),s[0]}get FROBENIUS_COEFFICIENTS_2(){let t=Ct.get(this);return t?t[1]:(this.FROBENIUS_COEFFICIENTS_1,Ct.get(this)[1])}add({c0:t,c1:n,c2:e},{c0:r,c1:s,c2:i}){let{Fp2:c}=this;return Object.freeze({c0:c.add(t,r),c1:c.add(n,s),c2:c.add(e,i)})}sub({c0:t,c1:n,c2:e},{c0:r,c1:s,c2:i}){let{Fp2:c}=this;return Object.freeze({c0:c.sub(t,r),c1:c.sub(n,s),c2:c.sub(e,i)})}mul({c0:t,c1:n,c2:e},r){let{Fp2:s}=this;if(typeof r=="bigint")return Object.freeze({c0:s.mul(t,r),c1:s.mul(n,r),c2:s.mul(e,r)});let{c0:i,c1:c,c2:u}=r,f=s.mul(t,i),a=s.mul(n,c),d=s.mul(e,u);return Object.freeze({c0:s.add(f,s.mulByNonresidue(s.sub(s.mul(s.add(n,e),s.add(c,u)),s.add(a,d)))),c1:s.add(s.sub(s.mul(s.add(t,n),s.add(i,c)),s.add(f,a)),s.mulByNonresidue(d)),c2:s.sub(s.add(a,s.mul(s.add(t,e),s.add(i,u))),s.add(f,d))})}sqr({c0:t,c1:n,c2:e}){let{Fp2:r}=this,s=r.sqr(t),i=r.mul(r.mul(t,n),C),c=r.mul(r.mul(n,e),C),u=r.sqr(e);return Object.freeze({c0:r.add(r.mulByNonresidue(c),s),c1:r.add(r.mulByNonresidue(u),i),c2:r.sub(r.sub(r.add(r.add(i,r.sqr(r.add(r.sub(t,n),e))),c),s),u)})}addN(t,n){return this.add(t,n)}subN(t,n){return this.sub(t,n)}mulN(t,n){return this.mul(t,n)}sqrN(t){return this.sqr(t)}create(t){let{Fp2:n}=this,e=n.create(t.c0),r=n.create(t.c1),s=n.create(t.c2);return Object.freeze({c0:e,c1:r,c2:s})}isValid(t){if(!pt(t))throw new TypeError("invalid field element: expected object, got "+typeof t);let{c0:n,c1:e,c2:r}=t,{Fp2:s}=this;return s.isValid(n)&&s.isValid(e)&&s.isValid(r)}is0(t){if(!pt(t))return!1;let{c0:n,c1:e,c2:r}=t,{Fp2:s}=this;return s.is0(n)&&s.is0(e)&&s.is0(r)}isValidNot0(t){return!this.is0(t)&&this.isValid(t)}neg({c0:t,c1:n,c2:e}){let{Fp2:r}=this;return Object.freeze({c0:r.neg(t),c1:r.neg(n),c2:r.neg(e)})}eql({c0:t,c1:n,c2:e},{c0:r,c1:s,c2:i}){let{Fp2:c}=this;return c.eql(t,r)&&c.eql(n,s)&&c.eql(e,i)}sqrt(t){return Lt()}div(t,n){let{Fp2:e}=this,{Fp:r}=e;return this.mul(t,typeof n=="bigint"?r.inv(r.create(n)):this.inv(n))}pow(t,n){return wt(this,t,n)}invertBatch(t){return ct(this,t)}inv({c0:t,c1:n,c2:e}){let{Fp2:r}=this,s=r.sub(r.sqr(t),r.mulByNonresidue(r.mul(e,n))),i=r.sub(r.mulByNonresidue(r.sqr(e)),r.mul(t,n)),c=r.sub(r.sqr(n),r.mul(t,e)),u=r.inv(r.add(r.mulByNonresidue(r.add(r.mul(e,i),r.mul(n,c))),r.mul(t,s)));return Object.freeze({c0:r.mul(u,s),c1:r.mul(u,i),c2:r.mul(u,c)})}fromBytes(t){let{Fp2:n}=this;if(H(t),t.length!==this.BYTES)throw new Error("fromBytes invalid length="+t.length);let e=n.BYTES;return this.create({c0:n.fromBytes(t.subarray(0,e)),c1:n.fromBytes(t.subarray(e,e*2)),c2:n.fromBytes(t.subarray(2*e))})}toBytes({c0:t,c1:n,c2:e}){let{Fp2:r}=this;return ot(r.toBytes(t),r.toBytes(n),r.toBytes(e))}cmov({c0:t,c1:n,c2:e},{c0:r,c1:s,c2:i},c){let{Fp2:u}=this;return this.create({c0:u.cmov(t,r,c),c1:u.cmov(n,s,c),c2:u.cmov(e,i,c)})}fromBigSix(t){let{Fp2:n}=this;if(!Array.isArray(t)||t.length!==6)throw new Error("invalid Fp6.fromBigSix");for(let r=0;r<6;r++)if(typeof t[r]!="bigint")throw new Error("invalid Fp6.fromBigSix");let e=t;return this.create({c0:n.fromBigTuple(e.slice(0,2)),c1:n.fromBigTuple(e.slice(2,4)),c2:n.fromBigTuple(e.slice(4,6))})}frobeniusMap({c0:t,c1:n,c2:e},r){let{Fp2:s}=this;return Object.freeze({c0:s.frobeniusMap(t,r),c1:s.mul(s.frobeniusMap(n,r),this.FROBENIUS_COEFFICIENTS_1[r%6]),c2:s.mul(s.frobeniusMap(e,r),this.FROBENIUS_COEFFICIENTS_2[r%6])})}mulByFp2({c0:t,c1:n,c2:e},r){let{Fp2:s}=this;return Object.freeze({c0:s.mul(t,r),c1:s.mul(n,r),c2:s.mul(e,r)})}mulByNonresidue({c0:t,c1:n,c2:e}){let{Fp2:r}=this;return Object.freeze({c0:r.mulByNonresidue(e),c1:t,c2:n})}mul1({c0:t,c1:n,c2:e},r){let{Fp2:s}=this;return Object.freeze({c0:s.mulByNonresidue(s.mul(e,r)),c1:s.mul(t,r),c2:s.mul(n,r)})}mul01({c0:t,c1:n,c2:e},r,s){let{Fp2:i}=this,c=i.mul(t,r),u=i.mul(n,s);return Object.freeze({c0:i.add(i.mulByNonresidue(i.sub(i.mul(i.add(n,e),s),u)),c),c1:i.sub(i.sub(i.mul(i.add(r,s),i.add(t,n)),c),u),c2:i.add(i.sub(i.mul(i.add(t,e),r),c),u)})}},Ct=new WeakMap,ue=class{ORDER;BITS;BYTES;isLE;ZERO;ONE;Fp6;X_LEN;finalExponentiate;constructor(t,n){let{X_LEN:e,Fp12finalExponentiate:r}=n,{Fp2:s}=t,{Fp:i}=s;this.Fp6=t,this.ORDER=i.ORDER**_n,this.BITS=2*t.BITS,this.BYTES=2*t.BYTES,this.isLE=t.isLE,this.ZERO=this.create({c0:t.ZERO,c1:t.ZERO}),this.ONE=this.create({c0:t.ONE,c1:t.ZERO}),this.X_LEN=e,this.finalExponentiate=c=>{let u=({c0:d,c1:x})=>Object.freeze({c0:d,c1:x}),f=({c0:d,c1:x,c2:y})=>Object.freeze({c0:u(d),c1:u(x),c2:u(y)}),a=r(c);return Object.freeze({c0:f(a.c0),c1:f(a.c1)})},Object.freeze(this)}get FROBENIUS_COEFFICIENTS(){let t=Qe.get(this);if(t)return t;let{Fp2:n}=this.Fp6,{Fp:e}=n,r=Object.freeze(fe(n,n.NONRESIDUE,e.ORDER,12,1,6)[0]);return Qe.set(this,r),r}create(t){let{Fp6:n}=this,e=n.create(t.c0),r=n.create(t.c1);return Object.freeze({c0:e,c1:r})}isValid(t){if(!pt(t))throw new TypeError("invalid field element: expected object, got "+typeof t);let{c0:n,c1:e}=t,{Fp6:r}=this;return r.isValid(n)&&r.isValid(e)}is0(t){if(!pt(t))return!1;let{c0:n,c1:e}=t,{Fp6:r}=this;return r.is0(n)&&r.is0(e)}isValidNot0(t){return!this.is0(t)&&this.isValid(t)}neg({c0:t,c1:n}){let{Fp6:e}=this;return Object.freeze({c0:e.neg(t),c1:e.neg(n)})}eql({c0:t,c1:n},{c0:e,c1:r}){let{Fp6:s}=this;return s.eql(t,e)&&s.eql(n,r)}sqrt(t){return Lt()}inv({c0:t,c1:n}){let{Fp6:e}=this,r=e.inv(e.sub(e.sqr(t),e.mulByNonresidue(e.sqr(n))));return Object.freeze({c0:e.mul(t,r),c1:e.neg(e.mul(n,r))})}div(t,n){let{Fp6:e}=this,{Fp2:r}=e,{Fp:s}=r;return this.mul(t,typeof n=="bigint"?s.inv(s.create(n)):this.inv(n))}pow(t,n){return wt(this,t,n)}invertBatch(t){return ct(this,t)}add({c0:t,c1:n},{c0:e,c1:r}){let{Fp6:s}=this;return Object.freeze({c0:s.add(t,e),c1:s.add(n,r)})}sub({c0:t,c1:n},{c0:e,c1:r}){let{Fp6:s}=this;return Object.freeze({c0:s.sub(t,e),c1:s.sub(n,r)})}mul({c0:t,c1:n},e){let{Fp6:r}=this;if(typeof e=="bigint")return Object.freeze({c0:r.mul(t,e),c1:r.mul(n,e)});let{c0:s,c1:i}=e,c=r.mul(t,s),u=r.mul(n,i);return Object.freeze({c0:r.add(c,r.mulByNonresidue(u)),c1:r.sub(r.mul(r.add(t,n),r.add(s,i)),r.add(c,u))})}sqr({c0:t,c1:n}){let{Fp6:e}=this,r=e.mul(t,n);return Object.freeze({c0:e.sub(e.sub(e.mul(e.add(e.mulByNonresidue(n),t),e.add(t,n)),r),e.mulByNonresidue(r)),c1:e.add(r,r)})}addN(t,n){return this.add(t,n)}subN(t,n){return this.sub(t,n)}mulN(t,n){return this.mul(t,n)}sqrN(t){return this.sqr(t)}fromBytes(t){let{Fp6:n}=this;if(H(t),t.length!==this.BYTES)throw new Error("fromBytes invalid length="+t.length);return this.create({c0:n.fromBytes(t.subarray(0,n.BYTES)),c1:n.fromBytes(t.subarray(n.BYTES))})}toBytes({c0:t,c1:n}){let{Fp6:e}=this;return ot(e.toBytes(t),e.toBytes(n))}cmov({c0:t,c1:n},{c0:e,c1:r},s){let{Fp6:i}=this;return this.create({c0:i.cmov(t,e,s),c1:i.cmov(n,r,s)})}fromBigTwelve(t){let{Fp6:n}=this;if(!Array.isArray(t)||t.length!==12)throw new Error("invalid Fp12.fromBigTwelve");for(let r=0;r<12;r++)if(typeof t[r]!="bigint")throw new Error("invalid Fp12.fromBigTwelve");let e=t;return this.create({c0:n.fromBigSix(e.slice(0,6)),c1:n.fromBigSix(e.slice(6,12))})}frobeniusMap(t,n){let{Fp6:e}=this,{Fp2:r}=e,{c0:s,c1:i,c2:c}=e.frobeniusMap(t.c1,n),u=this.FROBENIUS_COEFFICIENTS[n%12];return Object.freeze({c0:e.frobeniusMap(t.c0,n),c1:Object.freeze({c0:r.mul(s,u),c1:r.mul(i,u),c2:r.mul(c,u)})})}mulByFp2({c0:t,c1:n},e){let{Fp6:r}=this;return Object.freeze({c0:r.mulByFp2(t,e),c1:r.mulByFp2(n,e)})}conjugate({c0:t,c1:n}){return Object.freeze({c0:t,c1:this.Fp6.neg(n)})}mul014({c0:t,c1:n},e,r,s){let{Fp6:i}=this,{Fp2:c}=i,u=i.mul01(t,e,r),f=i.mul1(n,s);return Object.freeze({c0:i.add(i.mulByNonresidue(f),u),c1:i.sub(i.sub(i.mul01(i.add(n,t),e,c.add(r,s)),u),f)})}mul034({c0:t,c1:n},e,r,s){let{Fp6:i}=this,{Fp2:c}=i,u=Object.freeze({c0:c.mul(t.c0,e),c1:c.mul(t.c1,e),c2:c.mul(t.c2,e)}),f=i.mul01(n,r,s),a=i.mul01(i.add(t,n),c.add(e,r),s);return Object.freeze({c0:i.add(i.mulByNonresidue(f),u),c1:i.sub(a,i.add(u,f))})}_cyclotomicSquare({c0:t,c1:n}){let{Fp6:e}=this,{Fp2:r}=e,{c0:s,c1:i,c2:c}=t,{c0:u,c1:f,c2:a}=n,{first:d,second:x}=r.Fp4Square(s,f),{first:y,second:N}=r.Fp4Square(u,c),{first:I,second:A}=r.Fp4Square(i,a),D=r.mulByNonresidue(A);return Object.freeze({c0:Object.freeze({c0:r.add(r.mul(r.sub(d,s),C),d),c1:r.add(r.mul(r.sub(y,i),C),y),c2:r.add(r.mul(r.sub(I,c),C),I)}),c1:Object.freeze({c0:r.add(r.mul(r.add(D,u),C),D),c1:r.add(r.mul(r.add(x,f),C),x),c2:r.add(r.mul(r.add(N,a),C),N)})})}_cyclotomicExp(t,n){At("cyclotomic exponent",n,Pe,at<<BigInt(this.X_LEN));let e=this.ONE;for(let r=this.X_LEN-1;r>=0;r--)e=this._cyclotomicSquare(e),Re(n,r)&&(e=this.mul(e,t));return e}},Qe=new WeakMap;function tn(o){if(st(o,{ORDER:"bigint",X_LEN:"number",FP2_NONRESIDUE:"object",Fp2mulByB:"function",Fp12finalExponentiate:"function"},{NONRESIDUE:"bigint"}),tt(o.X_LEN,"X_LEN"),o.X_LEN<1)throw new Error("invalid X_LEN");let t=o.FP2_NONRESIDUE;if(!Array.isArray(t)||t.length!==2)throw new Error("invalid FP2_NONRESIDUE");if(typeof t[0]!="bigint"||typeof t[1]!="bigint")throw new Error("invalid FP2_NONRESIDUE");let n=et(o.ORDER),e=new ie(n,o),r=new ce(e),s=new ue(r,o);return{Fp:n,Fp2:e,Fp6:r,Fp12:s}}var Tn=BigInt(0),ae=BigInt(1),nn=BigInt(2),qn=BigInt(3),rn=BigInt(6),Zt=BigInt("4965661367192848881"),An=G(Zt),jn=rn*Zt**nn,Vt={p:BigInt("0x30644e72e131a029b85045b68181585d97816a916871ca8d3c208c16d87cfd47"),n:BigInt("0x30644e72e131a029b85045b68181585d2833e84879b9709143e1f593f0000001"),h:ae,a:Tn,b:qn,Gx:ae,Gy:BigInt(2)},Mt=et(Vt.n),on={c0:BigInt("19485874751759354771024239261021720505790618469301721065564631296452457478373"),c1:BigInt("266929791119991161246907387137283842545076965332900288569378510910307636690")},_,de=(()=>{let o=tn({ORDER:Vt.p,X_LEN:An,FP2_NONRESIDUE:[BigInt(9),ae],Fp2mulByB:t=>K.mul(t,on),Fp12finalExponentiate:t=>{let n=d=>_.conjugate(_._cyclotomicExp(d,Zt)),e=_.mul(_.conjugate(t),_.inv(t)),r=_.mul(_.frobeniusMap(e,2),e),s=_._cyclotomicSquare(n(r)),i=_.mul(_._cyclotomicSquare(s),s),c=n(i),u=n(_._cyclotomicSquare(c)),f=_.mul(_.mul(_.conjugate(u),c),_.conjugate(i)),a=_.mul(f,s);return _.mul(_.frobeniusMap(_.mul(_.conjugate(r),a),3),_.mul(_.frobeniusMap(f,2),_.mul(_.frobeniusMap(a,1),_.mul(_.mul(f,c),r))))}});return _=o.Fp12,o})(),he=de.Fp,K=de.Fp2,en,sn=()=>en||(en=Je(he,K,K.NONRESIDUE)),le=(o,t)=>{let n=sn().psi;return le=n,n(o,t)},cn=(o,t)=>{let n=sn().G2psi;return cn=n,n(o,t)},Ln=(o,t,n,e,r,s)=>{let i=le(e,r);({Rx:o,Ry:t,Rz:n}=s(o,t,n,i[0],i[1]));let c=le(i[0],i[1]);s(o,t,n,c[0],K.neg(c[1]))},Dn={p:K.ORDER,n:Vt.n,h:BigInt("0x30644e72e131a029b85045b68181585e06ceecda572a2489345f2299c0f9fa8d"),a:K.ZERO,b:on,Gx:K.fromBigTuple([BigInt("10857046999023057135944570762232829481370756359578518086990519993285655852781"),BigInt("11559732032986387107991004021392285783925812861821192530917403151452391805634")]),Gy:K.fromBigTuple([BigInt("8495653923123431417604973247489272438418190587263600148770280649306958101930"),BigInt("4082367875863433681332203403145435568316851327593401208105741076214120093531")])},Un={Fp:he,Fp2:K,Fp6:de.Fp6,Fp12:_,Fr:Mt},Hn=se(Vt,{Fp:he,Fn:Mt,allowInfinityPoint:!0}),zn=se(Dn,{Fp:K,Fn:Mt,allowInfinityPoint:!0,isTorsionFree:(o,t)=>t.multiplyUnsafe(jn).equals(cn(o,t))}),Cn={ateLoopSize:Zt*rn+nn,r:Mt.ORDER,xNegative:!1,twistType:"divisive",postPrecompute:Ln},Zn=$e(Un,Hn,zn,Cn);function un(o,t,n){return o&t^~o&n}function fn(o,t,n){return o&t^o&n^t&n}var Yt=class{blockLen;outputLen;canXOF=!1;padOffset;isLE;buffer;view;finished=!1;length=0;pos=0;destroyed=!1;constructor(t,n,e,r){this.blockLen=t,this.outputLen=n,this.padOffset=e,this.isLE=r,this.buffer=new Uint8Array(t),this.view=St(this.buffer)}update(t){kt(this),J(t);let{view:n,buffer:e,blockLen:r}=this,s=t.length;for(let i=0;i<s;){let c=Math.min(r-this.pos,s-i);if(c===r){let u=St(t);for(;r<=s-i;i+=r)this.process(u,i);continue}e.set(t.subarray(i,i+c),this.pos),this.pos+=c,i+=c,this.pos===r&&(this.process(n,0),this.pos=0)}return this.length+=t.length,this.roundClean(),this}digestInto(t){kt(this),xe(t,this),this.finished=!0;let{buffer:n,view:e,blockLen:r,isLE:s}=this,{pos:i}=this;n[i++]=128,bt(this.buffer.subarray(i)),this.padOffset>r-i&&(this.process(e,0),i=0);for(let d=i;d<r;d++)n[d]=0;e.setBigUint64(r-8,BigInt(this.length*8),s),this.process(e,0);let c=St(t),u=this.outputLen;if(u%4)throw new Error("_sha2: outputLen must be aligned to 32bit");let f=u/4,a=this.get();if(f>a.length)throw new Error("_sha2: outputLen bigger than state");for(let d=0;d<f;d++)c.setUint32(4*d,a[d],s)}digest(){let{buffer:t,outputLen:n}=this;this.digestInto(t);let e=t.slice(0,n);return this.destroy(),e}_cloneInto(t){t||=new this.constructor,t.set(...this.get());let{blockLen:n,buffer:e,length:r,finished:s,destroyed:i,pos:c}=this;return t.destroyed=i,t.finished=s,t.length=r,t.pos=c,r%n&&t.buffer.set(e),t}clone(){return this._cloneInto()}},Q=Uint32Array.from([1779033703,3144134277,1013904242,2773480762,1359893119,2600822924,528734635,1541459225]);var Vn=Uint32Array.from([1116352408,1899447441,3049323471,3921009573,961987163,1508970993,2453635748,2870763221,3624381080,310598401,607225278,1426881987,1925078388,2162078206,2614888103,3248222580,3835390401,4022224774,264347078,604807628,770255983,1249150122,1555081692,1996064986,2554220882,2821834349,2952996808,3210313671,3336571891,3584528711,113926993,338241895,666307205,773529912,1294757372,1396182291,1695183700,1986661051,2177026350,2456956037,2730485921,2820302411,3259730800,3345764771,3516065817,3600352804,4094571909,275423344,430227734,506948616,659060556,883997877,958139571,1322822218,1537002063,1747873779,1955562222,2024104815,2227730452,2361852424,2428436474,2756734187,3204031479,3329325298]),nt=new Uint32Array(64),pe=class extends Yt{constructor(t){super(64,t,8,!1)}get(){let{A:t,B:n,C:e,D:r,E:s,F:i,G:c,H:u}=this;return[t,n,e,r,s,i,c,u]}set(t,n,e,r,s,i,c,u){this.A=t|0,this.B=n|0,this.C=e|0,this.D=r|0,this.E=s|0,this.F=i|0,this.G=c|0,this.H=u|0}process(t,n){for(let d=0;d<16;d++,n+=4)nt[d]=t.getUint32(n,!1);for(let d=16;d<64;d++){let x=nt[d-15],y=nt[d-2],N=Y(x,7)^Y(x,18)^x>>>3,I=Y(y,17)^Y(y,19)^y>>>10;nt[d]=I+nt[d-7]+N+nt[d-16]|0}let{A:e,B:r,C:s,D:i,E:c,F:u,G:f,H:a}=this;for(let d=0;d<64;d++){let x=Y(c,6)^Y(c,11)^Y(c,25),y=a+x+un(c,u,f)+Vn[d]+nt[d]|0,I=(Y(e,2)^Y(e,13)^Y(e,22))+fn(e,r,s)|0;a=f,f=u,u=c,c=i+y|0,i=s,s=r,r=e,e=y+I|0}e=e+this.A|0,r=r+this.B|0,s=s+this.C|0,i=i+this.D|0,c=c+this.E|0,u=u+this.F|0,f=f+this.G|0,a=a+this.H|0,this.set(e,r,s,i,c,u,f,a)}roundClean(){bt(nt)}destroy(){this.destroyed=!0,this.set(0,0,0,0,0,0,0,0),bt(this.buffer)}},me=class extends pe{A=Q[0]|0;B=Q[1]|0;C=Q[2]|0;D=Q[3]|0;E=Q[4]|0;F=Q[5]|0;G=Q[6]|0;H=Q[7]|0;constructor(){super(32)}};var Mn=we(()=>new me,Oe(1));return {bn254:Zn,sha256:Mn};})();var bn254=__n.bn254,sha256=__n.sha256;
// OpenChainGraph shared canonicalizer + execution hash.
// SINGLE SOURCE OF TRUTH for the execution_hash preimage (OCG Standard §2/§6).
// The worker (mcp-apps-poc/worker.mjs) imports this file directly (WORKER-HASH-SSOT-1); there is no separate worker-local copy.
// Runs unchanged in: browsers, Cloudflare Workers, Node 18+ (all expose
// globalThis.crypto.subtle). Import this from BOTH the browser tool (inlined
// at build by generate.mjs) and the Worker so the two runtimes can never drift.
//
// Canonicalization (OCG §6): recursively sort object keys by Unicode code
// point, preserve array order, emit minimal-whitespace JSON, SHA-256, hex.
//
// RFC 8785 (JSON Canonicalization Scheme) alignment: for the I-JSON subset,
// jcsStringify() reproduces JCS output. JSON.stringify already uses the ECMAScript
// Number->String production and the minimal JSON string escaping that RFC 8785 §3.2
// mandates, and jcsStringify() orders member names by UTF-16 code unit while building
// the string directly, so RFC 8785 §3.2.3 member order holds even for array-index
// member names, which a JavaScript engine enumerates numerically. Every preimage
// without such names in a disagreeing order is byte-unchanged (2,575 of 2,575 pinned
// golden hashes verified 2026-09-28). The ONLY way this diverges from JCS is if a
// value is outside I-JSON (NaN/Infinity, or an integer beyond 2^53 that can't
// round-trip). assertIJson() rejects those so a non-canonical value can never
// silently produce an unstable hash.

// Structural limits. A payload deeper than MAX_DEPTH (or with more than MAX_ELEMENTS
// values) used to blow the JS stack with a bare `RangeError: Maximum call stack size
// exceeded` well below the worker's MAX_REQUEST_BODY_BYTES, i.e. an unbounded input
// produced an un-attributable crash instead of a named refusal. No committed payload
// comes near either ceiling, so nothing that hashes today starts failing.
const MAX_DEPTH = 512;
const MAX_ELEMENTS = 1_000_000;

class HashLimitError extends Error {
  constructor(message) {
    super(message);
    this.name = 'HashLimitError';
  }
}

function walkIJson(v, depth, counter) {
  if (depth > MAX_DEPTH) throw new HashLimitError(`Input nests deeper than MAX_DEPTH (${MAX_DEPTH}); cannot canonicalize for hashing.`);
  if (++counter.n > MAX_ELEMENTS) throw new HashLimitError(`Input has more than MAX_ELEMENTS (${MAX_ELEMENTS}) values; cannot canonicalize for hashing.`);
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) throw new Error(`Non-finite number (${v}) is not valid I-JSON; cannot canonicalize for hashing (RFC 8785 §3.2.2.3).`);
    if (Number.isInteger(v) && !Number.isSafeInteger(v)) throw new Error(`Integer ${v} exceeds 2^53 and is not safe I-JSON; pass it as a string (RFC 7493).`);
  } else if (Array.isArray(v)) {
    for (const el of v) walkIJson(el, depth + 1, counter);
  } else if (v && typeof v === 'object') {
    for (const k of Object.keys(v)) walkIJson(v[k], depth + 1, counter);
  }
}

function assertIJson(v) {
  walkIJson(v, 1, { n: 0 });
}

// JSON.stringify semantics that the hash preimage inherits, reproduced without an
// intermediate object:
//  - object members whose value is undefined / function / symbol are omitted
//  - array elements that are undefined / function / symbol / holes become null
//  - objects are enumerated by Object.keys (own enumerable string keys), sorted by
//    UTF-16 code unit with the default sort()
//  - primitives (string, number, boolean, null) via JSON.stringify (ES number format
//    = RFC 8785 §3.2.2.3)
// It builds the string directly, so array-index member names are no longer reordered
// by object enumeration order (RFC 8785 §3.2.3).
function jcsStringify(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) {
    let s = '[';
    for (let i = 0; i < v.length; i++) {
      if (i) s += ',';
      const e = v[i];
      s += (e === undefined || typeof e === 'function' || typeof e === 'symbol') ? 'null' : jcsStringify(e);
    }
    return s + ']';
  }
  const keys = Object.keys(v).sort();
  let s = '{', first = true;
  for (const k of keys) {
    const e = v[k];
    if (e === undefined || typeof e === 'function' || typeof e === 'symbol') continue;
    if (!first) s += ',';
    first = false;
    s += JSON.stringify(k) + ':' + jcsStringify(e);
  }
  return s + '}';
}

// Legacy object sorter kept byte-stable for the kernels that import it; it is not
// RFC 8785-complete for array-index member names, which a JavaScript engine enumerates
// numerically; the §4 and §PPH-1 hash paths use jcsStringify.
// The accumulator is null-prototype so that a JSON member literally named "__proto__"
// lands as an ordinary own enumerable key in sorted position (RFC 8785 §3.2.3 knows no
// special member names). With a `{}` accumulator that assignment set the prototype
// instead, so the key AND its whole subtree silently vanished from the preimage.
const cgCanon = (v) =>
  Array.isArray(v) ? v.map(cgCanon)
  : (v && typeof v === 'object')
    ? Object.keys(v).sort().reduce((o, k) => (o[k] = cgCanon(v[k]), o), Object.create(null))
    : v;

// The exact string that gets hashed. Exposed for debugging / parity proofs.
function canonicalPreimage(policy_parameters, output_payload) {
  const obj = { policy_parameters, output_payload };
  assertIJson(obj); // fail loud on non-canonical input rather than emit an unstable hash
  return jcsStringify(obj);
}

// Bare lowercase hex (matches worker.mjs and the browser tools). No "sha256:" prefix.
async function executionHash(policy_parameters, output_payload) {
  const bytes = new TextEncoder().encode(canonicalPreimage(policy_parameters, output_payload));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// OCG Standard §PPH-1 — JCS-SHA-256 of policy_parameters ALONE, via the same jcsStringify
// path executionHash() uses. Bare lowercase hex, no "sha256:" prefix. EXCLUDED from the
// execution_hash preimage by construction: this function never touches output_payload, and
// executionHash() never calls this one, so the member cannot reach the §4 preimage either way.
async function policyParametersHash(policy_parameters) {
  assertIJson(policy_parameters);
  const bytes = new TextEncoder().encode(jcsStringify(policy_parameters));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// OpenChainGraph shared compute-integrity-proof helper — OCG Standard §18 (Compute-Integrity Proof).
// SINGLE SOURCE OF TRUTH for the §18 zkVM-receipt BINDING (attach + binding check) AND the
// self-contained BN254 Groth16 reference verifier (§18.1).
//
// §18 turns the §4 hash from re-execute-to-verify into a SUCCINCT proof of correct execution — verifiable
// without re-execution and, optionally, without seeing the inputs (confidentiality, §18.3). OCG's analogue
// of the chained-verifiable-computation goal in Trusted Compute Units (arXiv:2504.15717), but SOFTWARE /
// CRYPTOGRAPHIC ONLY: no TEE, no hardware enclave, no blockchain anchor.
//
// HOME (NORMATIVE, §18.0): artifact.audit_signature.compute_proof — hash-excluded; never alters
// execution_hash or chaingraph_version (stays "0.4.0"); a v0.6 artifact still validates under the frozen
// v0.4 schema.
//
// SEAL VERIFICATION (NORMATIVE, §18.1): for receiptFormat:"groth16-bn254" OCG ships a SELF-CONTAINED
// reference verifier — a BN254 Groth16 pairing check (vendored @noble/curves, zero npm/runtime dep) that is
// chain-free and not runtime-dependent on the prover vendor (preserving "no blockchain in the verify path").
// It reconstructs the risc0 ReceiptClaim digest from (imageId, journal) exactly as the named system's verifier
// does, derives the 5 public inputs, and checks the pairing equation against the published risc0 verifying key.
// For receiptFormat:"stark" the seal verify stays DELEGATED to the vendor verifier (verifySeal throws).
//
// PROVING IS OFF-BAND (NORMATIVE, §18.2): zkVM proving needs a Rust toolchain + heavy compute; it MUST NOT
// run in the browser tool, the Worker, or CI. A compute_proof is produced offline and attached; these
// helpers only ATTACH and VERIFY. Default-off (§18.3).



// JCS-canonical compare (same canonicalizer as §4 — no second canonicalization path).
const canon = (o) => jcsStringify((o ?? null));

// §18.1 — a self-contained reference verifier is shipped for groth16-bn254; stark stays delegated.
const SEAL_VERIFICATION = 'reference-verifier';
const RECOMMENDED_RECEIPT_FORMAT = 'groth16-bn254';
const RECEIPT_FORMATS = new Set(['groth16-bn254', 'stark']);

// Attach a §18 compute_proof to an artifact (does NOT mutate the input; never touches the hash preimage).
function attachComputeProof(artifact, receipt) {
  const out = structuredClone(artifact);
  out.audit_signature = { ...(out.audit_signature || {}), compute_proof: receipt };
  return out;
}

function normId(d) {
  return typeof d === 'string' && d.startsWith('sha256:') ? d : 'sha256:' + d;
}

/**
 * §18.0/§18.1 BINDING check. Returns boolean (predicate — false on any structural/binding problem).
 * Checks: object shape (type/system/receiptFormat/imageId/seal/journal); journal binds output_payload
 * (journal.output JCS-equals artifact.output_payload); imageId published in the Graph Index
 * (node.compute_images[].image_id) when publishedImageIds is supplied; journal.kernel_digest matches the
 * node's published kernel identity (node.compute_images[].sha256_source / the Graph Index) when
 * publishedKernelDigests is supplied.
 *
 * SO #34: the digests supplied via publishedKernelDigests must be KNOWN FROM PUBLISHED SOURCE (recomputed
 * from the kernel bytes, or read from the Graph Index) — NEVER copied out of the receipt under test.
 * Absent param = today's behavior (leg not engaged); engaged param + missing journal.kernel_digest = FAIL
 * (absence is not a pass, SO #34c).
 *
 * Does NOT verify the cryptographic seal — use verifySeal() for that. A green binding means "this receipt
 * is well-formed and is ABOUT this artifact's output, by this published program"; the seal proves the
 * program actually produced it.
 */
function verifyBinding(artifact, { publishedImageIds = [], publishedKernelDigests = [] } = {}) {
  const cp = artifact?.audit_signature?.compute_proof;
  if (!cp || typeof cp !== 'object') return false;
  if (cp.type !== 'ZkVmReceipt') return false;
  if (typeof cp.system !== 'string' || !cp.system) return false;
  if (!RECEIPT_FORMATS.has(cp.receiptFormat)) return false;
  if (typeof cp.imageId !== 'string' || !cp.imageId) return false;
  if (typeof cp.seal !== 'string' || !cp.seal) return false;
  if (!cp.journal || typeof cp.journal !== 'object') return false;
  // §18.0: the journal's committed output MUST equal the artifact output_payload.
  if (!('output' in cp.journal)) return false;
  if (canon(cp.journal.output) !== canon(artifact.output_payload)) return false;
  // §18.1: imageId must be a published program identity for this node.
  if (publishedImageIds.length && !publishedImageIds.map(normId).includes(normId(cp.imageId))) return false;
  // §17/§18: when the caller supplies the node's PUBLISHED kernel digests, the receipt's kernel_digest
  // must match the node's published kernel identity (the CI gate's cross-check, mirrored; most receipts
  // share one universal guest imageId, so imageId alone does not bind a receipt to one tool's kernel).
  if (publishedKernelDigests.length) {
    if (typeof cp.journal.kernel_digest !== 'string' || !cp.journal.kernel_digest) return false;
    if (!publishedKernelDigests.map(normId).includes(normId(cp.journal.kernel_digest))) return false;
  }
  return true;
}

// ───────────────────────────────────────────────────────────────────────────────────────────────────────
// §18.1 — self-contained BN254 Groth16 reference verifier for receiptFormat:"groth16-bn254".
//
// Verifies a risc0 Groth16 receipt: reconstructs the ReceiptClaim digest from (imageId, journal) via risc0's
// tagged-struct hashing, derives the 5 Groth16 public inputs (split control_root + claim_digest, bn254 control
// id), and checks e(A,B)·e(-α,β)·e(-vk_x,γ)·e(-C,δ) == 1 against the published risc0 verifying key.
//
// Constants are risc0 v3.0.x verifier parameters:
//   VK  — risc0-groth16 verifier.rs (Groth16Verifier.sol ceremony output)
//   CONTROL_ROOT / BN254_CONTROL_ID — risc0-circuit-recursion control_id (Groth16ReceiptVerifierParameters::default)
// Cross-validated: this verifier ACCEPTS a real RISC0_DEV_MODE=0 receipt and REJECTS a tampered seal / wrong
// journal (kernels/fixtures/compute-proof/*.receipt.json + compute-proof.test.mjs).
// ───────────────────────────────────────────────────────────────────────────────────────────────────────

const { G1, G2, fields, pairingBatch } = bn254;
const Fp12 = fields.Fp12;

// risc0 default verifier parameters (v3.0.x), as 32-byte digests (Digest::as_bytes order).
const CONTROL_ROOT_HEX   = 'a54dc85ac99f851c92d7c96d7318af41dbe7c0194edfcc37eb4d422a998c1f56';
const BN254_CONTROL_ID_HEX = 'c07a65145c3cb48b6101962ea607a4dd93c753bb26975cb47feb00d3666e4404';

// risc0 Groth16 verifying key (decimal field coordinates).
const VK = {
  alpha: ['20491192805390485299153009773594534940189261866228447918068658471970481763042',
          '9383485363053290200918347156157836566562967994039712273449902621266178545958'],
  // beta/gamma/delta G2: [x.c0, x.c1, y.c0, y.c1] in noble Fp2 {c0,c1} convention.
  beta:  ['6375614351688725206403948262868962793625744043794305715222011528459656738731',
          '4252822878758300859123897981450591353533073413197771768651442665752259397132',
          '10505242626370262277552901082094356697409835680220590971873171140371331206856',
          '21847035105528745403288232691147584728191162732299865338377159692350059136679'],
  gamma: ['10857046999023057135944570762232829481370756359578518086990519993285655852781',
          '11559732032986387107991004021392285783925812861821192530917403151452391805634',
          '8495653923123431417604973247489272438418190587263600148770280649306958101930',
          '4082367875863433681332203403145435568316851327593401208105741076214120093531'],
  delta: ['12043754404802191763554326994664886008979042643626290185762540825416902247219',
          '1668323501672964604911431804142266013250380587483576094566949227275849579036',
          '13740680757317479711909903993315946540841369848973133181051452051592786724563',
          '7710631539206257456743780535472368339139328733484942210876916214502466455394'],
  IC: [
    ['8446592859352799428420270221449902464741693648963397251242447530457567083492','1064796367193003797175961162477173481551615790032213185848276823815288302804'],
    ['3179835575189816632597428042194253779818690147323192973511715175294048485951','20895841676865356752879376687052266198216014795822152491318012491767775979074'],
    ['5332723250224941161709478398807683311971555792614491788690328996478511465287','21199491073419440416471372042641226693637837098357067793586556692319371762571'],
    ['12457994489566736295787256452575216703923664299075106359829199968023158780583','19706766271952591897761291684837117091856807401404423804318744964752784280790'],
    ['19617808913178163826953378459323299110911217259216006187355745713323154132237','21663537384585072695701846972542344484111393047775983928357046779215877070466'],
    ['6834578911681792552110317589222010969491336870276623105249474534788043166867','15060583660288623605191393599883223885678013570733629274538391874953353488393'],
  ],
};

const enc = (s) => new TextEncoder().encode(s);
const hexToBytes = (h) => Uint8Array.from(h.match(/../g).map((x) => parseInt(x, 16)));
const intBE = (b) => b.reduce((a, x) => (a << 8n) + BigInt(x), 0n);
const intLE = (b) => intBE(Uint8Array.from(b).reverse());
const u32le = (n) => Uint8Array.from([n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >> 24) & 0xff]);
const u16le = (n) => Uint8Array.from([n & 0xff, (n >> 8) & 0xff]);
const concat = (arrs) => { const t = []; for (const a of arrs) for (const b of a) t.push(b); return Uint8Array.from(t); };
const ZERO32 = new Uint8Array(32);

// risc0 tagged_struct: sha256( sha256(tag) || down... || data(LE u32)... || u16le(down.len) ).
function taggedStruct(tag, down, data) {
  return sha256(concat([sha256(enc(tag)), ...down, ...data.map(u32le), u16le(down.length)]));
}

// risc0 ReceiptClaim::ok(image_id, journal).digest() — the claim a halted-0, no-assumptions receipt commits.
function claimDigestOk(imageIdBytes, journalBytes) {
  const post = taggedStruct('risc0.SystemState', [ZERO32], [0]);                 // {pc:0, merkle_root:ZERO}
  const output = taggedStruct('risc0.Output', [sha256(journalBytes), ZERO32], []); // assumptions Pruned(ZERO)
  return taggedStruct('risc0.ReceiptClaim', [ZERO32, imageIdBytes, post, output], [0, 0]); // input ZERO, exit (0,0)
}

// split_digest(d) -> [Fr(low 16B), Fr(high 16B)] (big-endian interpretation).
function splitDigest(bytes32) {
  const be = Uint8Array.from(bytes32).reverse();
  return [intBE(be.slice(16, 32)), intBE(be.slice(0, 16))];
}

const g1 = ([x, y]) => G1.Point.fromAffine({ x: BigInt(x), y: BigInt(y) });
const g2 = ([x0, x1, y0, y1]) => G2.Point.fromAffine({ x: { c0: BigInt(x0), c1: BigInt(x1) }, y: { c0: BigInt(y0), c1: BigInt(y1) } });

/**
 * §18.1 — verify a risc0 Groth16-BN254 receipt's cryptographic seal, self-contained and chain-free.
 *
 * receipt: the §18 compute_proof object { receiptFormat:'groth16-bn254', imageId:'sha256:..',
 *          seal:<base64 256B>, journal:{ chaingraph_version, kernel_digest, output } }.
 * Returns true iff the Groth16 proof verifies for the ReceiptClaim derived from (imageId, canonical journal).
 * Throws (delegated) for receiptFormat:'stark'. Returns false on any structural problem or invalid proof.
 */
function verifySeal(receipt) {
  const cp = receipt;
  if (!cp || typeof cp !== 'object') return false;
  if (cp.receiptFormat === 'stark') {
    throw new Error('§18.1: stark seal verification is DELEGATED to the vendor verifier (e.g. risc0-verifier); ' +
      'OCG ships only the self-contained BN254 Groth16 reference verifier for receiptFormat:"groth16-bn254".');
  }
  if (cp.receiptFormat !== 'groth16-bn254') return false;
  if (typeof cp.imageId !== 'string' || typeof cp.seal !== 'string') return false;
  if (!cp.journal || typeof cp.journal !== 'object') return false;

  // 1. canonical journal bytes the guest committed = utf8(JCS(journal object)).
  const journalBytes = enc(jcsStringify((cp.journal)));
  // 2. image id digest bytes.
  const imageIdBytes = hexToBytes(normId(cp.imageId).slice('sha256:'.length));
  if (imageIdBytes.length !== 32) return false;
  // 3. risc0 ReceiptClaim digest + 5 public inputs.
  const claimDigest = claimDigestOk(imageIdBytes, journalBytes);
  const [a0, a1] = splitDigest(hexToBytes(CONTROL_ROOT_HEX));
  const [c0, c1] = splitDigest(claimDigest);
  const idBn254 = intLE(hexToBytes(BN254_CONTROL_ID_HEX));
  const pub = [a0, a1, c0, c1, idBn254];

  // 4. parse the 256-byte seal -> A (G1), B (G2), C (G1). Each 32-byte element is big-endian.
  let seal;
  try { seal = Uint8Array.from(atob(cp.seal), (ch) => ch.charCodeAt(0)); } catch { return false; }
  if (seal.length !== 256) return false;
  let A, B, C, vkx;
  try {
    A = G1.Point.fromAffine({ x: intBE(seal.slice(0, 32)), y: intBE(seal.slice(32, 64)) });
    B = G2.Point.fromAffine({
      x: { c0: intBE(seal.slice(96, 128)), c1: intBE(seal.slice(64, 96)) },
      y: { c0: intBE(seal.slice(160, 192)), c1: intBE(seal.slice(128, 160)) },
    });
    C = G1.Point.fromAffine({ x: intBE(seal.slice(192, 224)), y: intBE(seal.slice(224, 256)) });
    A.assertValidity(); B.assertValidity(); C.assertValidity();
    // 5. vk_x = IC0 + Σ pub_i·IC[i+1].
    const IC = VK.IC.map(g1);
    vkx = IC[0];
    for (let i = 0; i < pub.length; i++) vkx = vkx.add(IC[i + 1].multiply(pub[i]));
  } catch { return false; }

  // 6. pairing equation.
  try {
    const gt = pairingBatch([
      { g1: A, g2: B },
      { g1: g1(VK.alpha).negate(), g2: g2(VK.beta) },
      { g1: vkx.negate(), g2: g2(VK.gamma) },
      { g1: C.negate(), g2: g2(VK.delta) },
    ]);
    return Fp12.eql(gt, Fp12.ONE);
  } catch { return false; }
}

window.OCG={verifySeal:verifySeal,verifyBinding:verifyBinding,jcsStringify:jcsStringify};
})();

/* (2) */
/* __ocgJcs is the canonicalizer the proof helper signs through. */
window.__ocgJcs=function(o){return window.OCG.jcsStringify(o)};
/* OCG-PROOF v1 — W3C Data Integrity eddsa-jcs-2022 (OCG §16). DO NOT hand-edit. Byte-identical to kernels/_proof.mjs. */
/* Signs through __ocgJcs (the OCG-CANON v1 block's serializer — single canon path; RFC 8785 §3.2.3-exact for array-index member names, same bytes as kernels/_proof.mjs jcsStringify since JCS-CANON-FIX-1). */
/* Exposes globals: __ocgSign(artifact,{verificationMethod,created,privateKey}) -> signed artifact;
   __ocgVerify(artifact,publicKey) -> bool; __ocgDidKeyFromPub(pubKey) -> did:key; __ocgPubFromDidKey(did) -> CryptoKey. */
(function(){
  var CS='eddsa-jcs-2022';
  function jcs(o){return new TextEncoder().encode(__ocgJcs(o));}
  function sha(b){return crypto.subtle.digest('SHA-256',b).then(function(d){return new Uint8Array(d);});}
  function secured(a){var c=structuredClone(a);if(c&&c.audit_signature){if('proof'in c.audit_signature)delete c.audit_signature.proof;if(Object.keys(c.audit_signature).length===0)delete c.audit_signature;}return c;}
  function opts(vm,created){return{type:'DataIntegrityProof',cryptosuite:CS,verificationMethod:vm,proofPurpose:'assertionMethod',created:created};}
  function hashData(a,o){return Promise.all([sha(jcs(o)),sha(jcs(secured(a)))]).then(function(h){var oh=h[0],dh=h[1];var c=new Uint8Array(oh.length+dh.length);c.set(oh,0);c.set(dh,oh.length);return c;});}
  var B58='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  function b58e(bytes){var z=0;while(z<bytes.length&&bytes[z]===0)z++;var d=[0];for(var i=z;i<bytes.length;i++){var c=bytes[i];for(var j=0;j<d.length;j++){c+=d[j]<<8;d[j]=c%58;c=(c/58)|0;}while(c){d.push(c%58);c=(c/58)|0;}}var s='';for(var k=0;k<z;k++)s+='1';for(var q=d.length-1;q>=0;q--)s+=B58[d[q]];return s;}
  function b58d(str){var z=0;while(z<str.length&&str[z]==='1')z++;var b=[0];for(var i=z;i<str.length;i++){var c=B58.indexOf(str[i]);if(c<0)throw new Error('bad base58');for(var j=0;j<b.length;j++){c+=b[j]*58;b[j]=c&255;c>>=8;}while(c){b.push(c&255);c>>=8;}}var out=new Uint8Array(z+b.length);for(var k=0;k<b.length;k++)out[z+b.length-1-k]=b[k];return out;}
  var MC=[0xed,0x01];
  function didFromPub(pk){return crypto.subtle.exportKey('raw',pk).then(function(r){var raw=new Uint8Array(r);var p=new Uint8Array(MC.length+raw.length);p.set(MC,0);p.set(raw,MC.length);return 'did:key:z'+b58e(p);});}
  function pubFromDid(did){if(did.indexOf('did:key:z')!==0)throw new Error('not did:key z-form');var p=b58d(did.slice(9));if(p[0]!==0xed||p[1]!==0x01)throw new Error('did:key not Ed25519');return crypto.subtle.importKey('raw',p.slice(2),{name:'Ed25519'},true,['verify']);}
  function sign(a,o){var po=opts(o.verificationMethod,o.created);return hashData(a,po).then(function(hd){return crypto.subtle.sign('Ed25519',o.privateKey,hd);}).then(function(s){var proof=Object.assign({},po,{proofValue:'z'+b58e(new Uint8Array(s))});var out=structuredClone(a);out.audit_signature=Object.assign({},out.audit_signature||{},{proof:proof});return out;});}
  function verify(a,pub){var pr=a&&a.audit_signature&&a.audit_signature.proof;if(!pr||pr.type!=='DataIntegrityProof'||pr.cryptosuite!==CS)return Promise.resolve(false);if(pr.proofPurpose!=='assertionMethod'||typeof pr.proofValue!=='string'||pr.proofValue[0]!=='z')return Promise.resolve(false);var po=opts(pr.verificationMethod,pr.created);return hashData(a,po).then(function(hd){var sig;try{sig=b58d(pr.proofValue.slice(1));}catch(e){return false;}return crypto.subtle.verify('Ed25519',pub,sig,hd);}).catch(function(){return false;});}
  window.__ocgSign=sign;window.__ocgVerify=verify;window.__ocgDidKeyFromPub=didFromPub;window.__ocgPubFromDidKey=pubFromDid;
})();

/* (3) */
/* RFC 3161 token verifier copied unchanged from verification-desk.html in github.com/PostOakLabs/ainumbers (Post Oak Labs, CC BY 4.0). */

/* §20/§23-rfc3161-snapshot ANCHOR VERIFY — hand-rolled minimal DER/CMS reader + WebCrypto signature check.
   SCOPED PER START-INFRA-BUILD-SPEC.md KILL CRITERION: a full pkijs vendoring (819KB in anchor.ainumbers.co's
   anchor-suite) breaks this repo's zero-dep page-weight norms, so this verifier does the real cryptography —
   messageImprint digest binding AND the CMS SignedData signature, checked against the certificate embedded in
   the token — but stops at a SMALL pinned-root subset (the same four authorities anchor-suite trusts) with a
   single-hop-per-cert issuer check, not full RFC 5280 path validation (no CRL/OCSP, no policy constraints).
   For full multi-CA chain verification, use the complete PKI.js engine at anchor.ainumbers.co/verify.html. */
(function(){
'use strict';

var OID_DN_LABELS={'2.5.4.3':'CN','2.5.4.10':'O','2.5.4.11':'OU','2.5.4.6':'C','2.5.4.7':'L','2.5.4.8':'ST','1.2.840.113549.1.9.1':'E'};
var HASH_OID={'2.16.840.1.101.3.4.2.1':'SHA-256','2.16.840.1.101.3.4.2.2':'SHA-384','2.16.840.1.101.3.4.2.3':'SHA-512','1.3.14.3.2.26':'SHA-1'};
var OID_RSA='1.2.840.113549.1.1.1', OID_EC='1.2.840.10045.2.1', OID_EKU='2.5.29.37', OID_TIMESTAMPING='1.3.6.1.5.5.7.3.8';
var PINNED_ROOTS_PEM={
  digicert:"-----BEGIN CERTIFICATE-----\nMIIFkDCCA3igAwIBAgIQBZsbV56OITLiOQe9p3d1XDANBgkqhkiG9w0BAQwFADBi\nMQswCQYDVQQGEwJVUzEVMBMGA1UEChMMRGlnaUNlcnQgSW5jMRkwFwYDVQQLExB3\nd3cuZGlnaWNlcnQuY29tMSEwHwYDVQQDExhEaWdpQ2VydCBUcnVzdGVkIFJvb3Qg\nRzQwHhcNMTMwODAxMTIwMDAwWhcNMzgwMTE1MTIwMDAwWjBiMQswCQYDVQQGEwJV\nUzEVMBMGA1UEChMMRGlnaUNlcnQgSW5jMRkwFwYDVQQLExB3d3cuZGlnaWNlcnQu\nY29tMSEwHwYDVQQDExhEaWdpQ2VydCBUcnVzdGVkIFJvb3QgRzQwggIiMA0GCSqG\nSIb3DQEBAQUAA4ICDwAwggIKAoICAQC/5pBzaN675F1KPDAiMGkz7MKnJS7JIT3y\nithZwuEppz1Yq3aaza57G4QNxDAf8xukOBbrVsaXbR2rsnnyyhHS5F/WBTxSD1If\nxp4VpX6+n6lXFllVcq9ok3DCsrp1mWpzMpTREEQQLt+C8weE5nQ7bXHiLQwb7iDV\nySAdYyktzuxeTsiT+CFhmzTrBcZe7FsavOvJz82sNEBfsXpm7nfISKhmV1efVFiO\nDCu3T6cw2Vbuyntd463JT17lNecxy9qTXtyOj4DatpGYQJB5w3jHtrHEtWoYOAMQ\njdjUN6QuBX2I9YI+EJFwq1WCQTLX2wRzKm6RAXwhTNS8rhsDdV14Ztk6MUSaM0C/\nCNdaSaTC5qmgZ92kJ7yhTzm1EVgX9yRcRo9k98FpiHaYdj1ZXUJ2h4mXaXpI8OCi\nEhtmmnTK3kse5w5jrubU75KSOp493ADkRSWJtppEGSt+wJS00mFt6zPZxd9LBADM\nfRyVw4/3IbKyEbe7f/LVjHAsQWCqsWMYRJUadmJ+9oCw++hkpjPRiQfhvbfmQ6QY\nuKZ3AeEPlAwhHbJUKSWJbOUOUlFHdL4mrLZBdd56rF+NP8m800ERElvlEFDrMcXK\nchYiCd98THU/Y+whX8QgUWtvsauGi0/C1kVfnSD8oR7FwI+isX4KJpn15GkvmB0t\n9dmpsh3lGwIDAQABo0IwQDAPBgNVHRMBAf8EBTADAQH/MA4GA1UdDwEB/wQEAwIB\nhjAdBgNVHQ4EFgQU7NfjgtJxXWRM3y5nP+e6mK4cD08wDQYJKoZIhvcNAQEMBQAD\nggIBALth2X2pbL4XxJEbw6GiAI3jZGgPVs93rnD5/ZpKmbnJeFwMDF/k5hQpVgs2\nSV1EY+CtnJYYZhsjDT156W1r1lT40jzBQ0CuHVD1UvyQO7uYmWlrx8GnqGikJ9yd\n+SeuMIW59mdNOj6PWTkiU0TryF0Dyu1Qen1iIQqAyHNm0aAFYF/opbSnr6j3bTWc\nfFqK1qI4mfN4i/RN0iAL3gTujJtHgXINwBQy7zBZLq7gcfJW5GqXb5JQbZaNaHqa\nsjYUegbyJLkJEVDXCLG4iXqEI2FCKeWjzaIgQdfRnGTZ6iahixTXTBmyUEFxPT9N\ncCOGDErcgdLMMpSEDQgJlxxPwO5rIHQw0uA5NBCFIRUBCOhVMt5xSdkoF1BN5r5N\n0XWs0Mr7QbhDparTwwVETyw2m+L64kW4I1NsBm9nVX9GtUw/bihaeSbSpKhil9Ie\n4u1Ki7wb/UdKDd9nZn6yW0HQO+T0O/QEY+nvwlQAUaCKKsnOeMzV6ocEGLPOr0mI\nr/OSmbaz5mEP0oUA51Aa5BuVnRmhuZyxm7EAHu/QD09CbMkKvO5D+jpxpchNJqU1\n/YldvIViHTLSoCtU7ZpXwdv6EM8Zt4tKG48BtieVU+i2iW1bvGjUI+iLUaJW+fCm\ngKDWHrO8Dw9TdSmq6hN35N6MgSGtBxBHEa2HPQfRdbzP82Z+\n-----END CERTIFICATE-----\n",
  sectigo:"-----BEGIN CERTIFICATE-----\nMIIFejCCA2KgAwIBAgIQeD0FbPqDLn5p+FYidp8CuTANBgkqhkiG9w0BAQwFADBX\nMQswCQYDVQQGEwJHQjEYMBYGA1UEChMPU2VjdGlnbyBMaW1pdGVkMS4wLAYDVQQD\nEyVTZWN0aWdvIFB1YmxpYyBUaW1lIFN0YW1waW5nIFJvb3QgUjQ2MB4XDTIxMDMy\nMjAwMDAwMFoXDTQ2MDMyMTIzNTk1OVowVzELMAkGA1UEBhMCR0IxGDAWBgNVBAoT\nD1NlY3RpZ28gTGltaXRlZDEuMCwGA1UEAxMlU2VjdGlnbyBQdWJsaWMgVGltZSBT\ndGFtcGluZyBSb290IFI0NjCCAiIwDQYJKoZIhvcNAQEBBQADggIPADCCAgoCggIB\nAIid2LlFZ50d3ei5JoGaVFTAfEkFm8xaFQ/ZlBBEtEFAgXcUmanU5HYsyAhTXiDQ\nkiUvpVdYqZ1uYoZEMgtHES1l1Cc6HaqZzEbOOp6YiTx63ywTon434aXVydmhx7Dx\n4IBrAou7hNGsKioIBPy5GMN7KmgYmuu4f92sKKjbxqohUSfjk1mJlAjthgF7Hjx4\nvvyVDQGsd5KarLW5d73E3ThobSkob2SL48LpUR/O627pDchxll+bTSv1gASn/hp6\nIuHJorEu6EopoB1CNFp/+HpTXeNARXUmdRMKbnXWflq+/g36NJXB35ZvxQw6zid6\n1qmrlD/IbKJA6COw/8lFSPQwBP1ityZdwuCysCKZ9ZjczMqbUcLFyq6KdOpuzVDR\n3ZUwxDKL1wCAxgL2Mpz7eZbrb/JWXiOcNzDpQsmwGQ6Stw8tTCqPumhLRPb7YkzM\n8/6NnWH3T9ClmcGSF22LEyJYNWCHrQqYubNeKolzqUbCqhSqmr/UdUeb49zYHr7A\nLL8bAJyPDmubNqMtuaobKASBqP84uhqcRY/pjnYd+V5/dcu9ieERjiRKKsxCG1t6\ntG9oj7liwPddXEcYGOUiWLm742st50jGwTzxbMpepmOP1mLnJskvZaN5e45NuzAH\nteORlsSuDt5t4BBRCJL+5EZnnw0ezntk9R8QJyAkL6/bAgMBAAGjQjBAMB0GA1Ud\nDgQWBBT2d2rdP/0BE/8WoWyCAi/QCj0UJTAOBgNVHQ8BAf8EBAMCAYYwDwYDVR0T\nAQH/BAUwAwEB/zANBgkqhkiG9w0BAQwFAAOCAgEACv68sZqZvmHk7JoU7AfTEZ7b\nX45u40OrLX/6vzHQAwDg1TB00bWbiwj+7+we60BP8AMsw1h5NCXWxeyvrEVC54Mi\nrwVrcF6SFGjRwRoelRuiaZ5FDO4oWhaePjZx3/jkQ7j653CA5WscYqlneLXBEZiY\no6rRNqnsZHZTQ606mlkNpsy3TFMADv5whZmilVEZ83OvydfH2DNL3FTkpZG7+lHS\n1DFHMSUB5UtSSeSRg2UWTXwU5oObGjFk/35fC/dlF+nJIXdqsw0TZSS86bi5GRCJ\nVjqjnkpZ0Jut7ucEv4PNOIU8ijkMRj17QPjHMtdy+WxBDDSdas/UFTVB/GF+Fofn\nOD3iZ4tXxFjPU3EWRcMWx8fcGyzlBfcjeoPNbNC7wfyV9Qkzfk2Bd48jGxG7OThY\nWolc56vmBHqDEfguDwYc9AeWirMVRDi+WYlsktzAEObiFoPqs+LWU5q7+Q1+nEcs\ntNuDIedeBRcHmtjL2hV3luuEWwDSnRhSjhPLPXzqpJ1rG3r4yqm1NjKg5A5QO9Az\nveHqRQldluTSKuu96oPEPusL2oF+4MxkJ+SQMGFWTw/PNCblUN8GXeL5+mR20diP\n5LiJMq8U3IpM/0Q7OFFQ+lXuYFIuDvUprWBPsp5La2WhL2+iLVVXItSl7up5yQqX\nXftzTXTX48FRiJ6PA9o=\n-----END CERTIFICATE-----\n",
  freetsa:"-----BEGIN CERTIFICATE-----\nMIIH/zCCBeegAwIBAgIJAMHphhYNqOmAMA0GCSqGSIb3DQEBDQUAMIGVMREwDwYD\nVQQKEwhGcmVlIFRTQTEQMA4GA1UECxMHUm9vdCBDQTEYMBYGA1UEAxMPd3d3LmZy\nZWV0c2Eub3JnMSIwIAYJKoZIhvcNAQkBFhNidXNpbGV6YXNAZ21haWwuY29tMRIw\nEAYDVQQHEwlXdWVyemJ1cmcxDzANBgNVBAgTBkJheWVybjELMAkGA1UEBhMCREUw\nHhcNMTYwMzEzMDE1MjEzWhcNNDEwMzA3MDE1MjEzWjCBlTERMA8GA1UEChMIRnJl\nZSBUU0ExEDAOBgNVBAsTB1Jvb3QgQ0ExGDAWBgNVBAMTD3d3dy5mcmVldHNhLm9y\nZzEiMCAGCSqGSIb3DQEJARYTYnVzaWxlemFzQGdtYWlsLmNvbTESMBAGA1UEBxMJ\nV3VlcnpidXJnMQ8wDQYDVQQIEwZCYXllcm4xCzAJBgNVBAYTAkRFMIICIjANBgkq\nhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEAtgKODjAy8REQ2WTNqUudAnjhlCrpE6ql\nmQfNppeTmVvZrH4zutn+NwTaHAGpjSGv4/WRpZ1wZ3BRZ5mPUBZyLgq0YrIfQ5Fx\n0s/MRZPzc1r3lKWrMR9sAQx4mN4z11xFEO529L0dFJjPF9MD8Gpd2feWzGyptlel\nb+PqT+++fOa2oY0+NaMM7l/xcNHPOaMz0/2olk0i22hbKeVhvokPCqhFhzsuhKsm\nq4Of/o+t6dI7sx5h0nPMm4gGSRhfq+z6BTRgCrqQG2FOLoVFgt6iIm/BnNffUr7V\nDYd3zZmIwFOj/H3DKHoGik/xK3E82YA2ZulVOFRW/zj4ApjPa5OFbpIkd0pmzxzd\nEcL479hSA9dFiyVmSxPtY5ze1P+BE9bMU1PScpRzw8MHFXxyKqW13Qv7LWw4sbk3\nSciB7GACbQiVGzgkvXG6y85HOuvWNvC5GLSiyP9GlPB0V68tbxz4JVTRdw/Xn/XT\nFNzRBM3cq8lBOAVt/PAX5+uFcv1S9wFE8YjaBfWCP1jdBil+c4e+0tdywT2oJmYB\nBF/kEt1wmGwMmHunNEuQNzh1FtJY54hbUfiWi38mASE7xMtMhfj/C4SvapiDN837\ngYaPfs8x3KZxbX7C3YAsFnJinlwAUss1fdKar8Q/YVs7H/nU4c4Ixxxz4f67fcVq\nM2ITKentbCMCAwEAAaOCAk4wggJKMAwGA1UdEwQFMAMBAf8wDgYDVR0PAQH/BAQD\nAgHGMB0GA1UdDgQWBBT6VQ2MNGZRQ0z357OnbJWveuaklzCBygYDVR0jBIHCMIG/\ngBT6VQ2MNGZRQ0z357OnbJWveuakl6GBm6SBmDCBlTERMA8GA1UEChMIRnJlZSBU\nU0ExEDAOBgNVBAsTB1Jvb3QgQ0ExGDAWBgNVBAMTD3d3dy5mcmVldHNhLm9yZzEi\nMCAGCSqGSIb3DQEJARYTYnVzaWxlemFzQGdtYWlsLmNvbTESMBAGA1UEBxMJV3Vl\ncnpidXJnMQ8wDQYDVQQIEwZCYXllcm4xCzAJBgNVBAYTAkRFggkAwemGFg2o6YAw\nMwYDVR0fBCwwKjAooCagJIYiaHR0cDovL3d3dy5mcmVldHNhLm9yZy9yb290X2Nh\nLmNybDCBzwYDVR0gBIHHMIHEMIHBBgorBgEEAYHyJAEBMIGyMDMGCCsGAQUFBwIB\nFidodHRwOi8vd3d3LmZyZWV0c2Eub3JnL2ZyZWV0c2FfY3BzLmh0bWwwMgYIKwYB\nBQUHAgEWJmh0dHA6Ly93d3cuZnJlZXRzYS5vcmcvZnJlZXRzYV9jcHMucGRmMEcG\nCCsGAQUFBwICMDsaOUZyZWVUU0EgdHJ1c3RlZCB0aW1lc3RhbXBpbmcgU29mdHdh\ncmUgYXMgYSBTZXJ2aWNlIChTYWFTKTA3BggrBgEFBQcBAQQrMCkwJwYIKwYBBQUH\nMAGGG2h0dHA6Ly93d3cuZnJlZXRzYS5vcmc6MjU2MDANBgkqhkiG9w0BAQ0FAAOC\nAgEAaK9+v5OFYu9M6ztYC+L69sw1omdyli89lZAfpWMMh9CRmJhM6KBqM/ipwoLt\nnxyxGsbCPhcQjuTvzm+ylN6VwTMmIlVyVSLKYZcdSjt/eCUN+41K7sD7GVmxZBAF\nILnBDmTGJmLkrU0KuuIpj8lI/E6Z6NnmuP2+RAQSHsfBQi6sssnXMo4HOW5gtPO7\ngDrUpVXID++1P4XndkoKn7Svw5n0zS9fv1hxBcYIHPPQUze2u30bAQt0n0iIyRLz\naWuhtpAtd7ffwEbASgzB7E+NGF4tpV37e8KiA2xiGSRqT5ndu28fgpOY87gD3ArZ\nDctZvvTCfHdAS5kEO3gnGGeZEVLDmfEsv8TGJa3AljVa5E40IQDsUXpQLi8G+UC4\n1DWZu8EVT4rnYaCw1VX7ShOR1PNCCvjb8S8tfdudd9zhU3gEB0rxdeTy1tVbNLXW\n99y90xcwr1ZIDUwM/xQ/noO8FRhm0LoPC73Ef+J4ZBdrvWwauF3zJe33d4ibxEcb\n8/pz5WzFkeixYM2nsHhqHsBKw7JPouKNXRnl5IAE1eFmqDyC7G/VT7OF669xM6hb\nUt5G21JE4cNK6NNucS+fzg1JPX0+3VhsYZjj7D5uljRvQXrJ8iHgr/M6j2oLHvTA\nI2MLdq2qjZFDOCXsxBxJpbmLGBx9ow6ZerlUxzws2AWv2pk=\n-----END CERTIFICATE-----"
};

// ---- generic BER/DER TLV walker --------------------------------------
function derParse(bytes,offset){
  var b0=bytes[offset];var tagClass=b0>>6;var constructed=!!(b0&0x20);var tagNumber=b0&0x1f;var p=offset+1;
  if(tagNumber===0x1f){tagNumber=0;while(true){var b=bytes[p++];tagNumber=(tagNumber<<7)|(b&0x7f);if(!(b&0x80))break;}}
  var lenByte=bytes[p++];var length;
  if(lenByte&0x80){var n=lenByte&0x7f;length=0;for(var i=0;i<n;i++)length=(length*256)+bytes[p++];}else{length=lenByte;}
  var contentStart=p,contentEnd=p+length;
  return{start:offset,tagClass:tagClass,constructed:constructed,tagNumber:tagNumber,contentStart:contentStart,contentEnd:contentEnd,end:contentEnd};
}
function derChildren(bytes,node){var out=[];var p=node.contentStart;while(p<node.contentEnd){var c=derParse(bytes,p);out.push(c);p=c.end;}return out;}
function derBytes(bytes,node){return bytes.slice(node.contentStart,node.contentEnd);}
function derOid(bytes,node){var b=derBytes(bytes,node);var s=[];var first=b[0];s.push(Math.floor(first/40));s.push(first%40);var val=0;for(var i=1;i<b.length;i++){val=val*128+(b[i]&0x7f);if(!(b[i]&0x80)){s.push(val);val=0;}}return s.join('.');}
function derInt(bytes,node){var b=derBytes(bytes,node);var v=0n;for(var i=0;i<b.length;i++)v=(v<<8n)|BigInt(b[i]);return v;}
function derTime(bytes,node){var s=new TextDecoder().decode(derBytes(bytes,node));var m;if(node.tagNumber===24){m=s.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(\.\d+)?Z$/);if(!m)return null;return new Date(Date.UTC(+m[1],+m[2]-1,+m[3],+m[4],+m[5],+m[6]));}m=s.match(/^(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})Z$/);if(!m)return null;var yy=+m[1];var yyyy=yy<50?2000+yy:1900+yy;return new Date(Date.UTC(yyyy,+m[2]-1,+m[3],+m[4],+m[5],+m[6]));}
function dnString(bytes,nameNode){var rdns=derChildren(bytes,nameNode);var parts=[];rdns.forEach(function(rdn){derChildren(bytes,rdn).forEach(function(atv){var kv=derChildren(bytes,atv);var oid=derOid(bytes,kv[0]);var valBytes=derBytes(bytes,kv[1]);var val;try{val=new TextDecoder('utf-8').decode(valBytes);}catch(e){val=Array.from(valBytes).map(function(b){return b.toString(16).padStart(2,'0');}).join('');}parts.push((OID_DN_LABELS[oid]||oid)+'='+val);});});return parts.join(', ');}
function b64ToBytes(b64){var bin=atob(b64.replace(/\s/g,''));var out=new Uint8Array(bin.length);for(var i=0;i<bin.length;i++)out[i]=bin.charCodeAt(i);return out;}
function encodeDerLength(len){if(len<0x80)return Uint8Array.from([len]);var arr=[];var l=len;while(l>0){arr.unshift(l&0xff);l=l>>>8;}return Uint8Array.from([0x80|arr.length].concat(arr));}
function concatBytes(arrs){var total=0;arrs.forEach(function(a){total+=a.length;});var out=new Uint8Array(total);var o=0;arrs.forEach(function(a){out.set(a,o);o+=a.length;});return out;}

// ---- certificate model -------------------------------------------------
function parseCert(bytes){
  var root=derParse(bytes,0);var top=derChildren(bytes,root); // [tbsCertificate, sigAlg, sigValue]
  var tbsNode=top[0];var tbsRaw=bytes.slice(tbsNode.start,tbsNode.end);
  var tbsChildren=derChildren(bytes,tbsNode);
  var ci=0;
  if(tbsChildren[0].tagClass===2&&tbsChildren[0].tagNumber===0)ci=1; // skip [0] explicit version
  ci++; // serialNumber
  ci++; // signature algorithm (inside tbs)
  var issuerNode=tbsChildren[ci++];
  ci++; // validity
  var subjectNode=tbsChildren[ci++];
  var spkiNode=tbsChildren[ci++];
  var spkiRaw=bytes.slice(spkiNode.start,spkiNode.end);
  var spkiChildren=derChildren(bytes,spkiNode);
  var spkiAlgOid=derOid(bytes,derChildren(bytes,spkiChildren[0])[0]);
  var sigAlgOid=derOid(bytes,derChildren(bytes,top[1])[0]);
  var sigBits=derBytes(bytes,top[2]);var sigValue=sigBits.slice(1); // drop unused-bits count byte
  var extNode=null;
  tbsChildren.slice(ci).forEach(function(n){if(n.tagClass===2&&n.tagNumber===3)extNode=n;}); // [3] extensions
  var hasTimestampingEku=false;
  if(extNode){
    var extSeq=derChildren(bytes,extNode)[0];
    derChildren(bytes,extSeq).forEach(function(extEntry){
      var parts=derChildren(bytes,extEntry);
      var oid=derOid(bytes,parts[0]);
      if(oid===OID_EKU){
        var valNode=parts[parts.length-1];var raw=derBytes(bytes,valNode);
        // brute-scan the OCTET STRING payload for the timeStamping OID's DER bytes (1.3.6.1.5.5.7.3.8 -> 06 08 2B 06 01 05 05 07 03 08)
        var needle=[0x06,0x08,0x2b,0x06,0x01,0x05,0x05,0x07,0x03,0x08];
        outer: for(var i=0;i<=raw.length-needle.length;i++){for(var j=0;j<needle.length;j++)if(raw[i+j]!==needle[j])continue outer;hasTimestampingEku=true;break;}
      }
    });
  }
  return{issuerDn:dnString(bytes,issuerNode),subjectDn:dnString(bytes,subjectNode),spkiRaw:spkiRaw,spkiAlgOid:spkiAlgOid,tbsRaw:tbsRaw,sigAlgOid:sigAlgOid,sigValue:sigValue,hasTimestampingEku:hasTimestampingEku};
}

function ecdsaDerToRaw(sigDer,size){
  var root=derParse(sigDer,0);var kids=derChildren(sigDer,root);
  function toFixed(b){b=(b[0]===0&&b.length>size)?b.slice(1):b;var out=new Uint8Array(size);out.set(b,size-b.length);return out;}
  var r=toFixed(derBytes(sigDer,kids[0])),s=toFixed(derBytes(sigDer,kids[1]));
  var out=new Uint8Array(size*2);out.set(r,0);out.set(s,size);return out;
}

async function importSpki(spkiRaw,spkiAlgOid,hashName){
  if(spkiAlgOid===OID_RSA)return crypto.subtle.importKey('spki',spkiRaw,{name:'RSASSA-PKCS1-v1_5',hash:hashName},true,['verify']);
  if(spkiAlgOid===OID_EC){
    try{return await crypto.subtle.importKey('spki',spkiRaw,{name:'ECDSA',namedCurve:'P-256'},true,['verify']);}
    catch(e){return crypto.subtle.importKey('spki',spkiRaw,{name:'ECDSA',namedCurve:'P-384'},true,['verify']);}
  }
  throw new Error('unsupported public key algorithm OID '+spkiAlgOid);
}
var SIGALG_HASH={'1.2.840.113549.1.1.5':'SHA-1','1.2.840.113549.1.1.11':'SHA-256','1.2.840.113549.1.1.12':'SHA-384','1.2.840.113549.1.1.13':'SHA-512','1.2.840.10045.4.3.1':'SHA-224','1.2.840.10045.4.3.2':'SHA-256','1.2.840.10045.4.3.3':'SHA-384','1.2.840.10045.4.3.4':'SHA-512'};
async function verifyCertSignature(cert,issuerCert){
  var hashName=SIGALG_HASH[cert.sigAlgOid]||'SHA-256';
  try{
    var pub=await importSpki(issuerCert.spkiRaw,issuerCert.spkiAlgOid,hashName);
    if(issuerCert.spkiAlgOid===OID_EC){
      var size=pub.algorithm.namedCurve==='P-384'?48:32;
      var rawSig=ecdsaDerToRaw(cert.sigValue,size);
      return await crypto.subtle.verify({name:'ECDSA',hash:hashName},pub,rawSig,cert.tbsRaw);
    }
    return await crypto.subtle.verify('RSASSA-PKCS1-v1_5',pub,cert.sigValue,cert.tbsRaw);
  }catch(e){return false;}
}

// ---- TST (RFC 3161 TimeStampToken / TimeStampResp) parsing -----------
function parseTstDer(bytes){
  var root=derParse(bytes,0);var top=derChildren(bytes,root);
  var sdNode;
  if(top[0].tagClass===0&&top[0].tagNumber===6){ // bare ContentInfo: OID, [0] explicit
    var ciChildren=derChildren(bytes,top[1]);sdNode=ciChildren[0];
  }else{ // TimeStampResp: PKIStatusInfo, ContentInfo
    var statusChildren=derChildren(bytes,top[0]);
    var statusInt=derInt(bytes,statusChildren[0]);
    if(statusInt!==0n&&statusInt!==1n)throw new Error('TSA refused the request (PKIStatus '+statusInt+')');
    var ciChildren2=derChildren(bytes,top[1]);
    var inner=derChildren(bytes,ciChildren2[1]);sdNode=inner[0];
  }
  var sd=derChildren(bytes,sdNode); // version, digestAlgorithms, encapContentInfo, [certs], [crls], signerInfos
  var idx=3; // skip version, digestAlgorithms, encapContentInfo positions handled below
  var encapContentInfo=sd[2];
  var certsNode=null,signerInfosNode=null;
  sd.slice(3).forEach(function(n){
    if(n.tagClass===2&&n.tagNumber===0)certsNode=n;
    else if(n.tagClass===0&&n.tagNumber===17)signerInfosNode=n;
  });
  var certs=certsNode?derChildren(bytes,certsNode).map(function(n){return{node:n,raw:bytes.slice(n.start,n.end)};}):[];
  var signerInfos=signerInfosNode?derChildren(bytes,signerInfosNode):[];
  var eci=derChildren(bytes,encapContentInfo);
  var eContentNode=eci[1]?derChildren(bytes,eci[1])[0]:null;
  var tstInfoDerBytes=eContentNode?derBytes(bytes,eContentNode):null;
  if(!tstInfoDerBytes)throw new Error('SignedData missing encapContentInfo eContent');
  return{bytes:bytes,certs:certs,signerInfos:signerInfos,tstInfoDerBytes:tstInfoDerBytes};
}
function parseTstInfo(tiBytes){
  var root=derParse(tiBytes,0);var f=derChildren(tiBytes,root);
  var idx=0;idx++; // version
  var policy=derOid(tiBytes,f[idx++]);
  var miNode=f[idx++];var mi=derChildren(tiBytes,miNode);
  var hashAlgOid=derOid(tiBytes,derChildren(tiBytes,mi[0])[0]);
  var hashedMessage=derBytes(tiBytes,mi[1]);
  var serialNumber=derInt(tiBytes,f[idx++]);
  var genTime=derTime(tiBytes,f[idx++]);
  return{policy:policy,hashAlgOid:hashAlgOid,hashedMessage:hashedMessage,serialNumber:serialNumber,genTime:genTime};
}
function parseSignerInfo(bytes,siNode){
  var f=derChildren(bytes,siNode);var idx=0;idx++; // version
  idx++; // sid
  var digestAlgOid=derOid(bytes,derChildren(bytes,f[idx++])[0]);
  var signedAttrsNode=null;
  if(f[idx]&&f[idx].tagClass===2&&f[idx].tagNumber===0)signedAttrsNode=f[idx++];
  var sigAlgOid=derOid(bytes,derChildren(bytes,f[idx++])[0]);
  var signature=derBytes(bytes,f[idx++]);
  return{digestAlgOid:digestAlgOid,signedAttrsNode:signedAttrsNode,sigAlgOid:sigAlgOid,signature:signature};
}
function signedAttrsToSet(bytes,node){
  var content=bytes.slice(node.contentStart,node.contentEnd);
  return concatBytes([Uint8Array.from([0x31]),encodeDerLength(content.length),content]);
}

// ---- top-level verify: messageImprint + CMS signature + scoped pinned-root chain ----
async function verifyRfc3161(proofB64,expectedHashHex,authorityHint){
  var out={ok:false,structural:false,digestBound:false,signatureVerified:false,chainedToRoot:null,ekuOk:null,genTime:null,serial:null,policy:null,errors:[]};
  var bytes;
  try{bytes=b64ToBytes(proofB64);}catch(e){out.errors.push('proof is not valid base64');return out;}
  var parsed;
  try{parsed=parseTstDer(bytes);}catch(e){out.errors.push('DER parse failed: '+e.message);return out;}
  out.structural=true;
  var tstInfo;
  try{tstInfo=parseTstInfo(parsed.tstInfoDerBytes);}catch(e){out.errors.push('TSTInfo parse failed: '+e.message);return out;}
  out.genTime=tstInfo.genTime?tstInfo.genTime.toISOString():null;
  out.serial=tstInfo.serialNumber.toString();
  out.policy=tstInfo.policy;
  var imprintHex=Array.from(tstInfo.hashedMessage).map(function(b){return b.toString(16).padStart(2,'0');}).join('');
  out.digestBound=(expectedHashHex&&imprintHex===expectedHashHex.replace(/^sha\d+:/,''));
  if(!out.digestBound)out.errors.push('messageImprint ('+imprintHex+') does not match the expected hash ('+expectedHashHex+')');

  if(!parsed.signerInfos.length){out.errors.push('no signerInfo in SignedData');return out;}
  var certs=parsed.certs.map(function(c){try{return parseCert(c.raw);}catch(e){return null;}}).filter(Boolean);
  var si=parseSignerInfo(bytes,parsed.signerInfos[0]);
  var hashName=HASH_OID[si.digestAlgOid]||'SHA-256';
  var dataToVerify=si.signedAttrsNode?signedAttrsToSet(bytes,si.signedAttrsNode):parsed.tstInfoDerBytes;

  var signerCert=null;
  for(var i=0;i<certs.length;i++){
    var cand=certs[i];
    try{
      var pub=await importSpki(cand.spkiRaw,cand.spkiAlgOid,hashName);
      var okSig;
      if(cand.spkiAlgOid===OID_EC){
        var size=pub.algorithm.namedCurve==='P-384'?48:32;
        okSig=await crypto.subtle.verify({name:'ECDSA',hash:hashName},pub,ecdsaDerToRaw(si.signature,size),dataToVerify);
      }else{
        okSig=await crypto.subtle.verify('RSASSA-PKCS1-v1_5',pub,si.signature,dataToVerify);
      }
      if(okSig){signerCert=cand;break;}
    }catch(e){/* try next cert */}
  }
  if(!signerCert){out.errors.push('CMS signature did not verify against any embedded certificate');return out;}
  out.signatureVerified=true;
  out.ekuOk=signerCert.hasTimestampingEku;
  if(!out.ekuOk)out.errors.push('signer certificate lacks the id-kp-timeStamping EKU (or it could not be located by the structural scan)');

  // scoped pinned-root chain: try to close signerCert -> [any bundled cert] -> a pinned root, up to 3 hops
  var pool=certs.slice();
  var pinned={};
  Object.keys(PINNED_ROOTS_PEM).forEach(function(k){
    try{
      var der=b64ToBytes(PINNED_ROOTS_PEM[k].replace(/-----(BEGIN|END) CERTIFICATE-----/g,'').replace(/\s/g,''));
      pinned[k]=parseCert(der);
    }catch(e){}
  });
  var current=signerCert,hops=0,chainedTo=null,visited=new Set();
  while(hops<3&&!chainedTo){
    hops++;
    var rootKeys=Object.keys(pinned);
    var matched=false;
    for(var ri=0;ri<rootKeys.length;ri++){
      var rk=rootKeys[ri];
      if(await verifyCertSignature(current,pinned[rk])){chainedTo=rk;matched=true;break;}
    }
    if(matched)break;
    var next=null;
    for(var pi=0;pi<pool.length;pi++){
      var c=pool[pi];
      if(visited.has(c.subjectDn))continue;
      if(c.subjectDn===current.issuerDn&&await verifyCertSignature(current,c)){next=c;break;}
    }
    if(!next)break;
    visited.add(next.subjectDn);current=next;
  }
  out.chainedToRoot=chainedTo;
  if(!chainedTo)out.errors.push('could not chain the signer certificate to a pinned root ('+Object.keys(PINNED_ROOTS_PEM).join(', ')+') within 3 hops — this is the scoped kill-criterion limitation, not a token defect');

  out.ok=out.digestBound&&out.signatureVerified;
  return out;
}

// ---- OpenTimestamps structural check (per kill criterion: structural + upgrade pointer only) ----
function checkOts(proofB64OrBytes){
  var bytes;
  try{bytes=typeof proofB64OrBytes==='string'?b64ToBytes(proofB64OrBytes):proofB64OrBytes;}catch(e){return{ok:false,error:'not valid base64'};}
  var MAGIC=[0x00,0x4f,0x70,0x65,0x6e,0x54,0x69,0x6d,0x65,0x73,0x74,0x61,0x6d,0x70,0x73,0x00,0x00,0x50,0x72,0x6f,0x6f,0x66,0x00,0xbf,0x89,0xe2,0xe8,0x84,0xe8,0x92,0x94];
  if(bytes.length<MAGIC.length)return{ok:false,error:'too short to be an OTS proof'};
  for(var i=0;i<MAGIC.length;i++)if(bytes[i]!==MAGIC[i])return{ok:false,error:'missing OpenTimestamps magic header'};
  return{ok:true,byteLength:bytes.length,note:'Valid OTS structural header detected. Full verification requires walking the Merkle op-chain against a Bitcoin block header, which needs a network/blockchain lookup — out of scope for this zero-egress client-side tool. Use the upgrade/verify path at opentimestamps.org.'};
}

window.__ocgVerifyRfc3161=verifyRfc3161;
window.__ocgCheckOts=checkOts;
})();

/* (4) Evidence, generated from the repository: art-07 node, kernel and fixtures; Agent Staircase session of 26 Sep 2026. */
window.PWK={EV:{"tool_id":"art-07-basel31-reporting-delta-calculator","name":"Basel 3.1 Reporting Delta Calculator","proof":{"type":"ZkVmReceipt","system":"risc0","receiptFormat":"groth16-bn254","imageId":"sha256:a1a0bc89b5b1febaeda3519f6dbade0fa5ac16beeb143c4e1b01689573567bc6","seal":"IHfBGtT0qGiU2bFEFgG3pWVb1Q94FzrdJfBcYBtrd+8s/Kbj5Uk3XsBezYDssCw9lbIMh3iNnivKMu7qrMs8nDBCVkHBosfqEJ4KPivHhmgZ3Z4BAtXBAOIiyhXOcx0oL2gE/0pL5h84iEqjAW4KEdcTP86xdp9vDa7npnN0/CUS4L9+iKdPvbJrSh2QifY5EbBh8tOuMv8DVckIW881ZxSfo4qUO1oDre0gyEZxL/oXX4xVToFDpaKfVH7SUPzDJh8dEBGjsbDvU0qf9CiNWWDbwm6D9yEZeXZUbjj72g4gK03GxujtKjN/EGqbhxKBjHjM7u/slkH989njTyjh/Q==","journal":{"chaingraph_version":"0.4.0","kernel_digest":"sha256:bb655f6f08ccd299198d1eff963940525ec31c073ef296bfce08503620cb28c7","output":{"asset_class_summary":[{"basel31_rwa_bn":20,"current_rwa_bn":35,"ead_bn":100,"id":"residential_mortgage","label":"Residential Mortgage","rwa_delta_bn":-15,"rwa_delta_pct":-42.86}],"basel31_rwa_bn":20,"capital_shortfall_bn":0,"cet1_ratio_basel31_pct":27.13,"cet1_ratio_current_pct":15.5,"compliance_flags":["OUTPUT_FLOOR_NOT_BINDING","CET1_ADEQUATE"],"current_rwa_bn":35,"floor_rwa_bn":25.375,"output_floor_binding":false,"rwa_delta_bn":-15,"rwa_delta_pct":-42.86,"verdict":"MINIMAL_IMPACT"}}},"published_digest":"sha256:bb655f6f08ccd299198d1eff963940525ec31c073ef296bfce08503620cb28c7","kernel_source":"/**\n * art-07-basel31-reporting-delta-calculator.kernel.mjs\n * Basel 3.1 Reporting Delta Calculator — fully deterministic, no PRNG.\n * Pure decision kernel — no DOM, no window, no Date.now().\n */\n\nimport { executionHash } from './_hash.mjs';\n\nexport const meta = {\n  tool_id:      'art-07-basel31-reporting-delta-calculator',\n  mcp_name:     'compute_basel31_delta',\n  mandate_type: 'capital_assessment',\n  version:      '1.0.0',\n};\n\nconst TOOL_ID = 'art-07-basel31-reporting-delta-calculator';\nconst TOOL_VERSION = '1.0.0';\n\n// ── Asset class definitions (SA risk weights current vs Basel 3.1) ────────────\nconst ASSET_CLASSES = [\n  { id: 'residential_mortgage', label: 'Residential Mortgage',  current_sa_rw: 0.35, basel31_sa_rw: 0.20, irb_rw: 0.15 },\n  { id: 'sme_retail',           label: 'SME Retail',            current_sa_rw: 0.75, basel31_sa_rw: 0.75, irb_rw: 0.60 },\n  { id: 'large_corporate',      label: 'Large Corporate',       current_sa_rw: 1.00, basel31_sa_rw: 0.85, irb_rw: 0.72 },\n  { id: 'bank',                 label: 'Bank / FI',             current_sa_rw: 0.20, basel31_sa_rw: 0.40, irb_rw: 0.30 },\n  { id: 'sovereign',            label: 'Sovereign',             current_sa_rw: 0.00, basel31_sa_rw: 0.00, irb_rw: 0.00 },\n  { id: 'equity',               label: 'Equity',                current_sa_rw: 1.00, basel31_sa_rw: 1.50, irb_rw: 1.25 },\n];\n\nconst OUTPUT_FLOOR = 0.725; // BCBS d424 §CAP30\n\n// ── Presets ───────────────────────────────────────────────────────────────────\nconst PRESETS = {\n  retail_bank: {\n    ead_bn: 100,\n    approach: 'sa',\n    cet1_ratio: 0.155,\n    mix: { residential_mortgage: 0.55, sme_retail: 0.20, large_corporate: 0.10, bank: 0.08, sovereign: 0.05, equity: 0.02 },\n  },\n  wholesale_bank: {\n    ead_bn: 200,\n    approach: 'irb',\n    cet1_ratio: 0.170,\n    mix: { residential_mortgage: 0.10, sme_retail: 0.10, large_corporate: 0.40, bank: 0.20, sovereign: 0.15, equity: 0.05 },\n  },\n  universal_bank: {\n    ead_bn: 500,\n    approach: 'irb',\n    cet1_ratio: 0.160,\n    mix: { residential_mortgage: 0.30, sme_retail: 0.15, large_corporate: 0.25, bank: 0.15, sovereign: 0.10, equity: 0.05 },\n  },\n};\n\nexport function compute(pp) {\n  // Resolve preset or use custom mix\n  const preset = pp.preset ? PRESETS[pp.preset] : null;\n  const ead_bn        = pp.ead_bn        ?? preset?.ead_bn        ?? 100;\n  const approach      = pp.approach      ?? preset?.approach      ?? 'sa';\n  const cet1_ratio    = pp.cet1_ratio    ?? preset?.cet1_ratio    ?? 0.155;\n  const mix           = pp.mix           ?? preset?.mix           ?? { residential_mortgage: 1.0 };\n\n  // Per-class calculation\n  let current_rwa_bn  = 0;\n  let basel31_rwa_bn  = 0;\n  const asset_class_summary = [];\n\n  for (const ac of ASSET_CLASSES) {\n    const weight = mix[ac.id] ?? 0;\n    if (weight === 0) continue;\n    const ead_class = ead_bn * weight;\n    const rw = approach === 'irb' ? ac.irb_rw : ac.current_sa_rw;\n    const current_rwa  = ead_class * rw;\n    const basel31_rwa_sa = ead_class * ac.basel31_sa_rw;\n    const basel31_irb    = approach === 'irb' ? ead_class * ac.irb_rw : basel31_rwa_sa;\n    // For IRB banks: floored at 72.5% of SA\n    const basel31_final  = approach === 'irb'\n      ? Math.max(basel31_irb, ead_class * ac.basel31_sa_rw * OUTPUT_FLOOR)\n      : basel31_rwa_sa;\n\n    current_rwa_bn  += current_rwa;\n    basel31_rwa_bn  += basel31_final;\n\n    asset_class_summary.push({\n      id:                   ac.id,\n      label:                ac.label,\n      ead_bn:               +ead_class.toFixed(3),\n      current_rwa_bn:       +current_rwa.toFixed(3),\n      basel31_rwa_bn:       +basel31_final.toFixed(3),\n      rwa_delta_bn:         +(basel31_final - current_rwa).toFixed(3),\n      rwa_delta_pct:        current_rwa > 0 ? +((basel31_final / current_rwa - 1) * 100).toFixed(2) : 0,\n    });\n  }\n\n  const floor_rwa_bn       = current_rwa_bn * OUTPUT_FLOOR;  // 72.5% of current SA\n  const output_floor_binding = approach === 'irb' && basel31_rwa_bn < floor_rwa_bn;\n  const effective_rwa_bn   = output_floor_binding ? floor_rwa_bn : basel31_rwa_bn;\n  const rwa_delta_bn       = +(effective_rwa_bn - current_rwa_bn).toFixed(3);\n  const rwa_delta_pct      = current_rwa_bn > 0 ? +((effective_rwa_bn / current_rwa_bn - 1) * 100).toFixed(2) : 0;\n  const cet1_bn            = current_rwa_bn * cet1_ratio;\n  const cet1_ratio_current_pct  = +(cet1_ratio * 100).toFixed(2);\n  const cet1_ratio_basel31_pct  = effective_rwa_bn > 0\n    ? +((cet1_bn / effective_rwa_bn) * 100).toFixed(2)\n    : cet1_ratio_current_pct;\n  const capital_shortfall_bn = +(Math.max(0, (effective_rwa_bn - current_rwa_bn) * 0.08)).toFixed(3);\n\n  const compliance_flags = [];\n  if (output_floor_binding) compliance_flags.push('OUTPUT_FLOOR_BINDING');\n  else compliance_flags.push('OUTPUT_FLOOR_NOT_BINDING');\n  if (rwa_delta_pct > 20)   compliance_flags.push('SIGNIFICANT_RWA_INCREASE');\n  if (cet1_ratio_basel31_pct < 10.5) compliance_flags.push('CET1_BELOW_MINIMUM_THRESHOLD');\n  else compliance_flags.push('CET1_ADEQUATE');\n\n  return {\n    verdict:               rwa_delta_pct > 10 ? 'MATERIAL_IMPACT' : rwa_delta_pct > 0 ? 'MODERATE_IMPACT' : 'MINIMAL_IMPACT',\n    current_rwa_bn:        +current_rwa_bn.toFixed(3),\n    basel31_rwa_bn:        +effective_rwa_bn.toFixed(3),\n    rwa_delta_bn,\n    rwa_delta_pct,\n    output_floor_binding,\n    floor_rwa_bn:          +floor_rwa_bn.toFixed(3),\n    capital_shortfall_bn,\n    cet1_ratio_current_pct,\n    cet1_ratio_basel31_pct,\n    asset_class_summary,\n    compliance_flags,\n  };\n}\n\nexport async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {\n  const result = compute(pp);\n  const { compliance_flags = {} } = result;\n  const output_payload = result;\n  const hash = await executionHash(pp, output_payload);\n  return {\n    '@context': 'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',\n    chaingraph_version: '0.4.0',\n    mandate_type: meta.mandate_type,\n    tool_id: TOOL_ID,\n    tool_version: TOOL_VERSION,\n    generated_at: now ?? null,\n    execution_hash: hash,\n    chain: { parent_hashes, parent_tool_ids, chain_depth },\n    policy_parameters: pp,\n    output_payload,\n    compliance_flags,\n    compute_mode: 'server',\n    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },\n  };\n}\n","vectors":[{"name":"default-inputs","policy_parameters":{},"output_payload":{"verdict":"MINIMAL_IMPACT","current_rwa_bn":35,"basel31_rwa_bn":20,"rwa_delta_bn":-15,"rwa_delta_pct":-42.86,"output_floor_binding":false,"floor_rwa_bn":25.375,"capital_shortfall_bn":0,"cet1_ratio_current_pct":15.5,"cet1_ratio_basel31_pct":27.13,"asset_class_summary":[{"id":"residential_mortgage","label":"Residential Mortgage","ead_bn":100,"current_rwa_bn":35,"basel31_rwa_bn":20,"rwa_delta_bn":-15,"rwa_delta_pct":-42.86}],"compliance_flags":["OUTPUT_FLOOR_NOT_BINDING","CET1_ADEQUATE"]},"golden_hash":"9b0448f2076a7b72af0d2722dd22ce526d96fbe1877b064644ae5e88d2059320"},{"name":"vector-own-inputs","policy_parameters":{"ead_bn":100,"approach":"sa","cet1_ratio":0.155,"mix":{"equity":1}},"output_payload":{"verdict":"MATERIAL_IMPACT","current_rwa_bn":100,"basel31_rwa_bn":150,"rwa_delta_bn":50,"rwa_delta_pct":50,"output_floor_binding":false,"floor_rwa_bn":72.5,"capital_shortfall_bn":4,"cet1_ratio_current_pct":15.5,"cet1_ratio_basel31_pct":10.33,"asset_class_summary":[{"id":"equity","label":"Equity","ead_bn":100,"current_rwa_bn":100,"basel31_rwa_bn":150,"rwa_delta_bn":50,"rwa_delta_pct":50}],"compliance_flags":["OUTPUT_FLOOR_NOT_BINDING","SIGNIFICANT_RWA_INCREASE","CET1_BELOW_MINIMUM_THRESHOLD"]},"golden_hash":"1e23a32b0d4e54dddec92e3d4794f2a53fef910ea59947ddf9e9c4028b0cc59c"},{"name":"nominal-variant","policy_parameters":{"ead_bn":100,"approach":"sa","cet1_ratio":0.155,"mix":{"bank":1}},"output_payload":{"verdict":"MATERIAL_IMPACT","current_rwa_bn":20,"basel31_rwa_bn":40,"rwa_delta_bn":20,"rwa_delta_pct":100,"output_floor_binding":false,"floor_rwa_bn":14.5,"capital_shortfall_bn":1.6,"cet1_ratio_current_pct":15.5,"cet1_ratio_basel31_pct":7.75,"asset_class_summary":[{"id":"bank","label":"Bank / FI","ead_bn":100,"current_rwa_bn":20,"basel31_rwa_bn":40,"rwa_delta_bn":20,"rwa_delta_pct":100}],"compliance_flags":["OUTPUT_FLOOR_NOT_BINDING","SIGNIFICANT_RWA_INCREASE","CET1_BELOW_MINIMUM_THRESHOLD"]},"golden_hash":"d225834025326dffb2f40417bdebbd615756e51fd740f1b83c9422e47c67709e"}],"anchored":{"tool_id":"art-04-agent-identity-attestation-checker","policy_parameters":{"credential":{"credential_type":"AgentCredential","agent_id":"a1","issuer":"did:key:zStub","issued_at":1,"expires_at":4102444800,"scopes":["read:account"],"signature":"ed25519:zz"},"validate_at_unix":1750000000,"requester_context":"anchor-binding-gate-fixture"},"output_payload":{"overall_status":"warn","pass":6,"fail":0,"warn":2,"checks":[{"code":"KYA-T01","status":"pass"},{"code":"KYA-R01","status":"pass"},{"code":"KYA-R02","status":"pass"},{"code":"KYA-R03","status":"pass"},{"code":"KYA-R04","status":"warn"},{"code":"KYA-R05","status":"pass"},{"code":"KYA-R06","status":"pass"},{"code":"KYA-EU1","status":"warn"}],"root_agent_id":"a1","scopes":["read:account"]},"execution_hash":"21dc3f277a599cf9eae79a1c67c70a55782c6fa4e732c86ba50e6e3773ee4418"}},
PUBLISHED_IMAGE_IDS:["sha256:a1a0bc89b5b1febaeda3519f6dbade0fa5ac16beeb143c4e1b01689573567bc6"],
STAIR:{"root":"7bc2980bc7d8a719166804e9bd9e553f767d9dd2fd3f96c1ac9b14cbd669c26b","merkle_algorithm":"SHA-256 binary tree, duplicate-last-leaf padding","generated_at":"2026-09-26T02:48:21.482Z","hashes":["ad46564c00bd402b0e6e5c930187d19236149d75d84cd4b40529bb2bdf84211b","a7a6588be0ebbb9d74430c09c1e40021f9f5ac98e3608c8e373daaec912b0269","424209654e4c3106de219067251a739f023c7c65ef259b32cac649b1d933575e","2266ce3efbb34154345acda9018a1955b7a187b310849721b9f02fafcf3e5f73","c5486c0547530fc9542360f73a53f3149d0df9e25abff01071d653088f975eb6","7519b7d687df882f191cb5580ca7f9df93fc1b60bb2d2e56978290d7ad8b3e46","ef76f68fe520581b62ead2423822022b70d71d0dbd69445e9bde8226260892b5","3ef8679a7817268f7df888891874caf57a037f39547eb69604590ff8d7c77ea1","f5a9670511d044f8ae1f180c39d75c66fa84f6944157791befb523b7044e5205","e89f8f61eb15ddbbd19553c0abb28869c8ed53e46d100228ec171c21f05c5cc8"],"bindings":[{"authority":"sigstore","label":"Sigstore TSA","gen_time":"2026-09-26T02:48:56.000Z","serial":"00cb1d269d4efb1f2374f5f2672c9bdf02ff7d803a","proof":"MIIE6DADAgEAMIIE3wYJKoZIhvcNAQcCoIIE0DCCBMwCAQMxDTALBglghkgBZQMEAgEwgcAGCyqGSIb3DQEJEAEEoIGwBIGtMIGqAgEBBgkrBgEEAYO/MAIwMTANBglghkgBZQMEAgEFAAQge8KYC8fYpxkWaATpvZ5VP3Z9ndL9P5bBrJsUy9ZpwmsCFQDLHSadTvsfI3T18mcsm98C/32AOhgPMjAyNjA5MjYwMjQ4NTZaMAMCAQECBna6Ox3VCKAypDAwLjEVMBMGA1UEChMMc2lnc3RvcmUuZGV2MRUwEwYDVQQDEwxzaWdzdG9yZS10c2GgggIUMIICEDCCAZagAwIBAgIUOhNULwyQYe68wUMvy4qOiyojiwwwCgYIKoZIzj0EAwMwOTEVMBMGA1UEChMMc2lnc3RvcmUuZGV2MSAwHgYDVQQDExdzaWdzdG9yZS10c2Etc2VsZnNpZ25lZDAeFw0yNTA0MDgwNjU5NDNaFw0zNTA0MDYwNjU5NDNaMC4xFTATBgNVBAoTDHNpZ3N0b3JlLmRldjEVMBMGA1UEAxMMc2lnc3RvcmUtdHNhMHYwEAYHKoZIzj0CAQYFK4EEACIDYgAE4ra2Z8hKNig2T9kFjCAToGG30jky+WQv3BzL+mKvh1SKNR/UwuwsfNCg4sryoYAd8E6isovVA3M4aoNdm9QDi50Z8nTEyvqgfDPtTIwXItfiW/AFf1V7uwkbkAoj0xxco2owaDAOBgNVHQ8BAf8EBAMCB4AwHQYDVR0OBBYEFIn9eUOHz9BlRsMCRscsc1t9tOsDMB8GA1UdIwQYMBaAFJjsAe9/u1H/1JUeb4qImFMHic6/MBYGA1UdJQEB/wQMMAoGCCsGAQUFBwMIMAoGCCqGSM49BAMDA2gAMGUCMDtpsV/6KaO0qyF/UMsX2aSUXKQFdoGTptQGc0ftq1csulHPGG6dsmyMNd3JB+G3EQIxAOajvBcjpJmKb4Nv+2Taoj8Uc5+b6ih6FXCCKraSqupe07zqswMcXJTe1cExvHvvlzGCAdswggHXAgEBMFEwOTEVMBMGA1UEChMMc2lnc3RvcmUuZGV2MSAwHgYDVQQDExdzaWdzdG9yZS10c2Etc2VsZnNpZ25lZAIUOhNULwyQYe68wUMvy4qOiyojiwwwCwYJYIZIAWUDBAIBoIH8MBoGCSqGSIb3DQEJAzENBgsqhkiG9w0BCRABBDAcBgkqhkiG9w0BCQUxDxcNMjYwOTI2MDI0ODU2WjAvBgkqhkiG9w0BCQQxIgQgnpcpagD3/5ve6YoKfccmr6IRrinBncKFkIWdfM2QAvwwgY4GCyqGSIb3DQEJEAIvMX8wfTB7MHkEIIX5J7wHq2LKw7RDVsEO/IGyxog/2nq55thw2dE6zQW3MFUwPaQ7MDkxFTATBgNVBAoTDHNpZ3N0b3JlLmRldjEgMB4GA1UEAxMXc2lnc3RvcmUtdHNhLXNlbGZzaWduZWQCFDoTVC8MkGHuvMFDL8uKjosqI4sMMAoGCCqGSM49BAMCBGcwZQIwaXIf0TZlmYZEAASacXxi362/5LiZ7/Q9S/2gIa+GvSQtaz1HQW7lFFOpzL7x6TbvAjEA9P9jOaTSuyvDSnJS7LGdzSYVsLosjEU9HOBYS2TiC73xHUwwVpena20/Pi1nPl2k"},{"authority":"digicert","label":"DigiCert","gen_time":"2026-09-26T02:48:56.000Z","serial":"00b6271da38ff8ad6f4d04f5573f348191","proof":"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"},{"authority":"freetsa","label":"FreeTSA","gen_time":"2026-09-26T02:48:57.000Z","serial":"08773b2a","proof":"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"}],"mandate":{"chaingraph_version":"0.4.0","mandate_type":"work_mandate","tool_id":"work-mandate","generated_at":"2026-09-25T12:00:00Z","policy_parameters":{},"output_payload":{"mandate_type":"work_mandate","scope":{"tool_ids":[],"chains":["agent-commerce-conformance","escalation-sla-supervised-autonomy-receipt"]},"conditions":[],"escalation_triggers":[],"validity":{"not_before":"2026-09-25T00:00:00Z","not_after":"2026-10-25T00:00:00Z"},"principal":{"id":"did:key:z6MkhU7ioaZXvWTnV5eQPCfEuwyX6JMM3roPpgBf3XcDu2T4"}},"execution_hash":"2266ce3efbb34154345acda9018a1955b7a187b310849721b9f02fafcf3e5f73","audit_signature":{"proof":{"type":"DataIntegrityProof","cryptosuite":"eddsa-jcs-2022","verificationMethod":"did:key:z6MkhU7ioaZXvWTnV5eQPCfEuwyX6JMM3roPpgBf3XcDu2T4","proofPurpose":"assertionMethod","created":"2026-09-25T12:00:00Z","proofValue":"z3qwKgvT7MmVLd9XDD4fSnUorXhhq9sruyTvoEwTe4qgzTv6LV7b4Q3JYPduYQ6VeF6rdEL4FixBCHV7tBJZuLVxd"}}}}};

/* (5) */
/* ---------------------------------------------------------------------------------------------
   PROOF-WALK-KIT logic: the evidence bundle, the corruptions and the six checks shared by
   break-the-wall-explainer.html and auditors-walk-explainer.html. Both pages read window.PWK,
   so a fix to a check lands once and the two pages cannot drift.

   Evidence (all real, all from the public repository):
   - PWK.STAIR: the Agent Staircase session of 26 September 2026 from
     chaingraph/agent-staircase-explainer.html (#data-receipt, #data-mandate): ten execution
     hashes, the session root, three RFC 3161 tokens over that root (Sigstore, DigiCert,
     FreeTSA) and the signed synthetic Work Mandate whose hash is leaf 4.
   - PWK.EV: node art-07 (Basel 3.1 reporting delta) with its Groth16 receipt, kernel source
     and fixture vectors from chaingraph/kernels.
   No network call anywhere: every check runs on these bytes with the verifier code above.
   --------------------------------------------------------------------------------------------- */
(function(){
'use strict';
var K=window.PWK;
var EV=K.EV,ST=K.STAIR;

function sha(x){var u=typeof x==='string'?new TextEncoder().encode(x):x;return crypto.subtle.digest('SHA-256',u).then(function(b){return new Uint8Array(b)})}
function hex(u){return Array.prototype.map.call(u,function(x){return ('0'+x.toString(16)).slice(-2)}).join('')}
function bare(h){return String(h).replace(/^sha256:/,'').toLowerCase()}
function clone(o){return JSON.parse(JSON.stringify(o))}
/* Execution hash: SHA-256 over the RFC 8785 canonical JSON of {policy_parameters, output_payload},
   using the jcsStringify bundled above (the same code as chaingraph/kernels/_hash.mjs). */
function ehash(pp,out){return sha(window.OCG.jcsStringify({policy_parameters:pp,output_payload:out})).then(hex)}
/* Session root: the rule build_session_receipt uses in the MCP worker (mcp-apps-poc/worker.mjs):
   SHA-256 over the two hex strings joined, binary tree, last leaf repeated on an odd level.
   It reproduces the anchored root 7bc2980b…c26b from the ten hashes. */
function sessionRoot(hashes){var level=hashes.map(bare);
  function step(){if(level.length<=1)return Promise.resolve(level[0]);var jobs=[];
    for(var i=0;i<level.length;i+=2){var l=level[i],r=i+1<level.length?level[i+1]:level[i];jobs.push(sha(l+r).then(hex))}
    return Promise.all(jobs).then(function(n){level=n;return step()})}
  return step()}
function serialHex(dec){try{return BigInt(dec).toString(16)}catch(e){return String(dec)}}
function flip(str,i){var c=str[i];return str.slice(0,i)+(c==='0'?'1':'0')+str.slice(i+1)}

/* The art-07 run under review: fixture vector 0 as an artifact, with its stored receipt attached
   (audit_signature.compute_proof, SPEC section 18.0). It is not signed and not in the session. */
function art07(){var v=EV.vectors[0];return {tool_id:EV.tool_id,policy_parameters:clone(v.policy_parameters),output_payload:clone(v.output_payload),execution_hash:v.golden_hash,audit_signature:{compute_proof:clone(EV.proof)}}}

/* What can be corrupted before checking. Each note says exactly what changed. */
K.CORR={
 none:{label:'nothing (an untampered bundle)',note:''},
 mandate:{label:'the signed Work Mandate, after signing',note:'Corrupted: the Work Mandate\'s validity was widened after the principal signed it (not_after 2026-10-25 became 2027-10-25).'},
 sigval:{label:'one character of the mandate signature',note:'Corrupted: one character of the proofValue on the Work Mandate. The mandate itself is unchanged.'},
 session:{label:'one character of a session hash',note:'Corrupted: the first character of leaf 2 of the ten session hashes.'},
 anchor:{label:'the root the timestamps are claimed for',note:'Corrupted: one character of the stated session root, so the bundle claims the tokens cover a different root.'},
 input:{label:'one input of the art-07 run',note:'Corrupted: the art-07 run used its default inputs; an input ead_bn of 101 was written in afterwards. The result is unchanged.'},
 result:{label:'one digit of the art-07 result',note:'Corrupted: current_rwa_bn in the recorded result of the art-07 run, 35 became 36.'},
 journal:{label:'one digit of the receipt journal',note:'Corrupted: rwa_delta_pct in the journal of the art-07 receipt, -42.86 became -42.87.'},
 seal:{label:'one character of the receipt seal',note:'Corrupted: one character of the 256-byte Groth16 seal.'},
 kernel:{label:'one character of the kernel source',note:'Corrupted: one character of the 6,528-byte kernel source of art-07.'},
 borrow:{label:'the receipt, moved onto another artifact',note:'Corrupted: the valid art-07 receipt is attached to a different artifact (the section 20 fixture, art-04).'}};

/* An evidence bundle, optionally corrupted in one place. */
K.bundle=function(kind){
 var d={root:ST.root,hashes:ST.hashes.slice(),tokens:clone(ST.bindings),mandate:clone(ST.mandate),run:art07(),src:EV.kernel_source};
 if(kind==='mandate')d.mandate.output_payload.validity.not_after='2027-10-25T00:00:00Z';
 if(kind==='sigval'){var pv=d.mandate.audit_signature.proof.proofValue;d.mandate.audit_signature.proof.proofValue=pv.slice(0,20)+(pv[20]==='A'?'B':'A')+pv.slice(21)}
 if(kind==='session')d.hashes[1]=flip(d.hashes[1],0);
 if(kind==='anchor')d.root=flip(d.root,10);
 if(kind==='input')d.run.policy_parameters.ead_bn=101;
 if(kind==='result')d.run.output_payload.current_rwa_bn=36;
 if(kind==='journal')d.run.audit_signature.compute_proof.journal.output.rwa_delta_pct=-42.87;
 if(kind==='seal'){var s=d.run.audit_signature.compute_proof.seal;d.run.audit_signature.compute_proof.seal=s.slice(0,8)+(s[8]==='A'?'B':'A')+s.slice(9)}
 if(kind==='kernel')d.src=d.src.slice(0,200)+(d.src[200]==='e'?'f':'e')+d.src.slice(201);
 if(kind==='borrow'){var a=EV.anchored;d.run={tool_id:a.tool_id,policy_parameters:clone(a.policy_parameters),output_payload:clone(a.output_payload),execution_hash:a.execution_hash,audit_signature:{compute_proof:clone(EV.proof)}}}
 return d};

/* A short, readable view of the bundle for the diff panel. */
K.view=function(d){return JSON.stringify({
 session:{root_stated:'sha256:'+d.root,merkle_rule:ST.merkle_algorithm,leaves:d.hashes.map(function(h){return h.slice(0,16)+'…'}),timestamps:d.tokens.map(function(t){return t.authority+' · '+t.gen_time})},
 work_mandate:{execution_hash:d.mandate.execution_hash,validity:d.mandate.output_payload.validity,signer:d.mandate.audit_signature.proof.verificationMethod.slice(0,24)+'…',proofValue:d.mandate.audit_signature.proof.proofValue.slice(0,28)+'…'},
 run_under_review:{tool_id:d.run.tool_id,policy_parameters:d.run.policy_parameters,output_payload:d.run.output_payload,execution_hash:d.run.execution_hash,receipt_journal_output:d.run.audit_signature.compute_proof.journal.output,receipt_kernel_digest:d.run.audit_signature.compute_proof.journal.kernel_digest},
 published_kernel_digest:EV.published_digest},null,1)};

/* The six checks, run one after another so each timing is its own. ok is true, false, or null
   (null means the check could not run, which is never a pass). */
var NAMES=['Anchor tokens','Session root','Groth16 receipt','Kernel identity','Signature','Execution hash'];
K.NAMES=NAMES;
function timed(fn){var t=performance.now();return Promise.resolve().then(fn).then(function(r){r.ms=Math.max(0.1,performance.now()-t);return r})}
function cAnchor(d){
 return Promise.all(d.tokens.map(function(t){return window.__ocgVerifyRfc3161(t.proof,d.root,t.authority).then(function(r){return {t:t,r:r}})})).then(function(L){
  var parts=L.map(function(x){var r=x.r,st;
   if(!r.digestBound||!r.signatureVerified)st=false;else if(!r.chainedToRoot)st=null;else st=true;
   /* show the serial as the authority published it, after checking it is the one inside the token */
   if(st&&r.serial&&serialHex(r.serial)!==x.t.serial.replace(/^0+/,''))st=false;
   return {authority:x.t.authority,label:x.t.label,ok:st,genTime:r.genTime,serial:x.t.serial}});
  var bad=parts.filter(function(p){return p.ok===false}),good=parts.filter(function(p){return p.ok===true}),open=parts.filter(function(p){return p.ok===null});
  var ok=bad.length?false:(good.length?true:null);
  var say=ok===false?'The tokens do not fit the stated root: '+bad.map(function(p){return p.label}).join(' and ')+(bad.length>1?' each fail':' fails')+' the message-imprint check, so the bundle claims a timestamp for a root the authorities never saw.'
   :good.map(function(p){return p.label+' signed the root at '+p.genTime+' (serial '+p.serial+')'}).join('; ')+'. Each token\'s imprint equals the stated root, its CMS signature checks, and its certificate chains to a root pinned in this page.'
    +(open.length?' The '+open.map(function(p){return p.label}).join(' and ')+' token also verifies against the root, but its certificate chain is not pinned in this page, so that chain was not checked here.':'');
  return {ok:ok,parts:parts,tag:good.length+' of '+parts.length+' tokens chained to a pinned root',say:say}})}
function cSession(d){return sessionRoot(d.hashes).then(function(r){var same=r===bare(d.root),inSet=d.hashes.map(bare).indexOf(bare(d.mandate.execution_hash))>=0;
 return {ok:same&&inSet,tag:'ten real hashes, worker rule',say:same&&inSet?'Folding the ten hashes with the session-receipt rule gives the stated root '+r.slice(0,8)+'…'+r.slice(-4)+', and the Work Mandate\'s hash is leaf 4.':(!same?'Folding the ten hashes gives '+r.slice(0,12)+'…, not the stated root '+bare(d.root).slice(0,12)+'…, so a hash in the session or the stated root was changed.':'The root folds correctly, but the Work Mandate\'s hash is not one of the ten leaves.')}})}
function cGroth(d){var cp=d.run.audit_signature.compute_proof,seal=false,bind=false;
 try{seal=window.OCG.verifySeal(cp)}catch(e){seal=false}
 bind=window.OCG.verifyBinding(d.run,{publishedImageIds:K.PUBLISHED_IMAGE_IDS,publishedKernelDigests:[EV.published_digest]});
 return {ok:seal&&bind,seal:seal,binding:bind,tag:'real receipt, real pairing check',say:seal&&bind?'The Groth16 pairing check passes, the ImageID is the one the node publishes, and the journal\'s output and kernel digest are this artifact\'s.':(!seal?'The pairing check fails, so the journal, the ImageID or the seal was changed after proving.':'The seal still verifies, but the binding check fails: the journal\'s output or kernel digest is not this artifact\'s, so the proof is about a different answer.')}}
function cKernel(d){return sha(d.src).then(function(x){var hx='sha256:'+hex(x),j=d.run.audit_signature.compute_proof.journal.kernel_digest,ok=hx===j&&hx===EV.published_digest;
 return {ok:ok,tag:'real kernel source',say:ok?'SHA-256 of the art-07 kernel source (6,528 bytes) equals the digest in the receipt journal and the digest the node publishes: all three agree.':'The source hashes to '+hx.slice(0,19)+'…, which does not match the published digest '+EV.published_digest.slice(0,19)+'…, so this is not the code that was proven.'}})}
function cSig(d){var vm=d.mandate.audit_signature&&d.mandate.audit_signature.proof&&d.mandate.audit_signature.proof.verificationMethod;
 if(!(crypto.subtle&&vm))return Promise.resolve({ok:null,tag:'needs Ed25519 in WebCrypto',say:'This browser cannot run the Ed25519 check, so the signature step did not run.'});
 return Promise.resolve(window.__ocgPubFromDidKey(vm)).then(function(pub){return window.__ocgVerify(d.mandate,pub)}).then(function(ok){
  return {ok:ok,tag:'eddsa-jcs-2022, the mandate\'s own key',say:ok?'The eddsa-jcs-2022 proof on the Work Mandate verifies for '+vm.slice(0,24)+'…, the principal named in the mandate. The mandate is synthetic, but the signature is real.':'The signature on the Work Mandate does not verify, so the mandate or its proof was changed after signing.'}},
  function(){return {ok:null,tag:'needs Ed25519 in WebCrypto',say:'This browser cannot run the Ed25519 check, so the signature step did not run.'}})}
function cHash(d){return Promise.all([ehash(d.mandate.policy_parameters,d.mandate.output_payload),ehash(d.run.policy_parameters,d.run.output_payload)]).then(function(h){
 var m=h[0]===d.mandate.execution_hash,r=h[1]===d.run.execution_hash,ok=m&&r,bad=[];if(!m)bad.push('the Work Mandate');if(!r)bad.push('the '+d.run.tool_id.slice(0,6)+' run');
 return {ok:ok,mandate:m,run:r,tag:'RFC 8785 canonical JSON',say:ok?'Recomputing SHA-256 over the canonical JSON of inputs and result gives the stated execution hash for both the Work Mandate and the art-07 run.':'Recomputing gives a different hash for '+bad.join(' and ')+', so its inputs or result changed after the hash was stated.'}})}
var CHECKS=[cAnchor,cSession,cGroth,cKernel,cSig,cHash];
K.checks=function(d){var out=[];return CHECKS.reduce(function(p,fn){return p.then(function(){return timed(function(){return fn(d)}).then(function(r){out.push(r)})})},Promise.resolve()).then(function(){return out})};

/* Network requests, split in two: what the page loaded (fonts, this file) and what started
   while the checks ran. Resource Timing only; nothing is sent anywhere. */
K.netReport=function(t0,t1){var E=[];try{E=performance.getEntriesByType('resource')}catch(e){}
 E=E.filter(function(e){return String(e.name).indexOf('data:')!==0});
 var load=E.filter(function(e){return e.startTime<t0}),during=E.filter(function(e){return e.startTime>=t0&&(t1==null||e.startTime<=t1)});
 var hosts={};load.forEach(function(e){var h;try{h=new URL(e.name).host}catch(x){h='?'}hosts[h]=(hosts[h]||0)+1});
 return {load:load.length,hosts:hosts,during:during.length}};
K.sha=sha;K.hex=hex;K.ehash=ehash;K.sessionRoot=sessionRoot;
})();
