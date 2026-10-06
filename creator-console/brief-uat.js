'use strict';
const $=id=>document.getElementById(id);
const STATE={feed:[],selected:null,storage:false,lastBundle:null};
const ready=x=>['primary-source-enriched','verified-seed'].includes(x?.status);
function esc(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function setNotice(text,kind='warn'){$('notice').className=`notice ${kind}`;$('notice').textContent=text}
function sourceClass(item){
  if(!item)return 'inference';
  if(String(item.sourceType||'').includes('official'))return 'official-source';
  return 'first-party-public';
}
function sourceResolution(item){return ready(item)?'resolved':'unresolved';}
function renderSelected(){
  const x=STATE.selected;if(!x)return;
  $('topic').value=x.topic||'';
  $('trigger').value=`Discovered by Creator Console from ${x.vendor||'an official source'}: ${x.sourceUrl||''}`;
  $('claimText').value=x.summary&&ready(x)?x.summary:'';
  $('sourceDetail').innerHTML=`<b>${esc(x.topic)}</b><div class="tiny" style="margin:5px 0">${esc(x.vendor)} · ${esc(x.status)} · ${esc(sourceClass(x))}</div><div>${esc(x.summary||'')}</div><div style="margin-top:7px"><a href="${esc(x.sourceUrl)}" target="_blank" rel="noopener">Open primary source ↗</a></div>`;
  $('sourceBadge').className=`badge ${ready(x)?'good':'warn'}`;
  $('sourceBadge').textContent=ready(x)?'source evidence-capable':'source not yet evidence-capable';
}
async function load(){
  try{
    const [sr,dr]=await Promise.all([fetch('/api/storage-health'),fetch('/api/discover?limit=12')]);
    const storage=await sr.json(),discovery=await dr.json();
    STATE.storage=Boolean(storage.configured);STATE.feed=discovery.items||[];
    $('storageBadge').className=`badge ${STATE.storage?'good':'warn'}`;
    $('storageBadge').textContent=STATE.storage?'durable storage connected':'browser-only persistence';
    $('roadmapState').innerHTML=STATE.storage?'<b>Storage connected:</b> Slice A can proceed to durable persistence verification.':'<b>Not fully certified:</b> durable server storage is not connected; browser UAT can pass but persistence UAT remains blocked.';
    $('roadmapState').className=STATE.storage?'goodText':'badText';
    $('sourceSelect').innerHTML=STATE.feed.map((x,i)=>`<option value="${i}">${esc(x.vendor)} — ${esc(x.topic)}${ready(x)?' ✓':''}</option>`).join('')||'<option>No sources found</option>';
    STATE.selected=STATE.feed[0]||null;renderSelected();
  }catch(e){setNotice(`Initialization failed: ${e.message}`,'bad')}
}
$('sourceSelect').addEventListener('change',()=>{STATE.selected=STATE.feed[Number($('sourceSelect').value)]||null;STATE.lastBundle=null;$('persistBtn').disabled=true;renderSelected()});
$('evaluateBtn').addEventListener('click',async()=>{
  const x=STATE.selected,claimText=$('claimText').value.trim();if(!x)return setNotice('Choose a source.','bad');if(!claimText)return setNotice('Write one precise claim first.','bad');
  const sourceId=`uat-${x.id||Date.now()}`;
  const payload={
    brief:{topic:$('topic').value.trim(),trigger:$('trigger').value.trim(),teachingOutcome:$('teachingOutcome').value.trim(),creatorTake:$('creatorTake').value.trim(),mode:$('mode').value,createdAt:new Date().toISOString()},
    sources:[{id:sourceId,url:x.sourceUrl,evidenceClass:sourceClass(x),title:x.sourceTitle||x.topic,publisher:x.vendor,publishedAt:x.publishedAt||null,resolutionStatus:sourceResolution(x),capturedAt:new Date().toISOString(),userNote:'Captured through clean-room Slice A browser UAT.'}],
    claims:[{text:claimText,claimType:$('claimType').value,supportingSourceIds:$('claimType').value==='creator-opinion'?[]:[sourceId]}],
    evaluatedAt:new Date().toISOString()
  };
  $('evaluateBtn').disabled=true;setNotice('Evaluating claim support through hosted clean-room API…','warn');
  try{
    const r=await fetch('/api/brief-evaluate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}),j=await r.json();if(!r.ok)throw new Error(j.message||j.error||`HTTP ${r.status}`);
    STATE.lastBundle=j;
    $('gateBadge').className=`badge ${j.gate?.passed?'good':'warn'}`;$('gateBadge').textContent=j.gate?.passed?'evidence gate passed':'evidence gate blocked';
    $('resultState').className=`badge ${j.brief?.status==='evidence-ready'?'good':'warn'}`;$('resultState').textContent=j.brief?.status||'unknown';
    $('humanResult').innerHTML=j.gate?.passed?`<div class="goodText"><b>Evidence-ready.</b> The claim is supported by an allowed evidence class. Receipt <code>${esc(j.receiptHash?.slice(0,16))}…</code></div>`:`<div class="badText"><b>Blocked.</b> Unsupported claim IDs: ${esc((j.gate?.unsupportedClaimIds||[]).join(', ')||'none')}</div>`;
    $('resultJson').textContent=JSON.stringify(j,null,2);
    $('persistBtn').disabled=false;
    setNotice(j.gate?.passed?'Hosted evidence evaluation passed. Persistence is the next independent gate.':'Hosted evaluation failed closed as designed.',j.gate?.passed?'good':'warn');
  }catch(e){setNotice(`Evaluation failed: ${e.message}`,'bad')}finally{$('evaluateBtn').disabled=false}
});
$('persistBtn').addEventListener('click',async()=>{
  const b=STATE.lastBundle;if(!b)return;
  if(STATE.storage){
    try{const r=await fetch('/api/briefs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({brief:b.brief,sources:b.sources,claims:b.claims})}),j=await r.json();if(!r.ok)throw new Error(j.message||j.error||`HTTP ${r.status}`);setNotice(`Durably persisted brief ${b.brief.id}.`,'good');$('persistBtn').textContent='Persisted ✓'}catch(e){setNotice(`Server persistence failed: ${e.message}`,'bad')}
  }else{
    const arr=JSON.parse(localStorage.getItem('creator-cleanroom-briefs')||'[]').filter(x=>x.brief?.id!==b.brief.id);arr.unshift(b);localStorage.setItem('creator-cleanroom-briefs',JSON.stringify(arr.slice(0,50)));setNotice('Saved only in this browser. This does NOT satisfy the durable-storage roadmap gate.','warn');$('persistBtn').textContent='Saved browser-only';
  }
});
load();
