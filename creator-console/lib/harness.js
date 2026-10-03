'use strict';
const crypto = require('crypto');

const TARGETS = {
  linkedin: {minWords: 280, maxWords: 500, maxHashtags: 3},
  medium: {minWords: 500, maxWords: 800, maxHashtags: 0}
};
const STATES = Object.freeze({
  ACCEPTED:'CONTRACT_ACCEPTED',
  EVIDENCE_READY:'EVIDENCE_READY',
  CONTEXT_READY:'CONTEXT_ASSEMBLED',
  WRITING:'WRITING',
  CRITIQUING:'CRITIQUING',
  REVISING:'REVISING',
  PASSED:'QUALITY_PASSED',
  FAILED:'QUALITY_FAILED',
  BLOCKED_EVIDENCE:'BLOCKED_EVIDENCE_INSUFFICIENT',
  BLOCKED_MODEL:'BLOCKED_MODEL_NOT_CONFIGURED',
  APPROVAL:'APPROVAL_REQUIRED'
});

function now(){return new Date().toISOString();}
function hash(value){return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');}
function words(text){return String(text||'').trim().split(/\s+/).filter(Boolean);}
function wordCount(text){return words(text).length;}
function urls(text){return String(text||'').match(/https?:\/\/[^\s)\]}>,]+/g)||[];}
function hashtagCount(text){return (String(text||'').match(/(^|\s)#[A-Za-z0-9_]+/g)||[]).length;}
function normalizeText(text){return String(text||'').toLowerCase().replace(/https?:\/\/\S+/g,' ').replace(/[^a-z0-9 ]+/g,' ').replace(/\s+/g,' ').trim();}
function ngrams(text,n=7){const w=normalizeText(text).split(' ').filter(Boolean), out=new Set();for(let i=0;i<=w.length-n;i++)out.add(w.slice(i,i+n).join(' '));return out;}
function overlapRatio(a,b){const A=ngrams(a),B=ngrams(b);if(!A.size||!B.size)return 0;let hits=0;for(const x of A)if(B.has(x))hits++;return hits/Math.max(1,Math.min(A.size,B.size));}

function normalizeContract(input={}){
  const platforms = Array.isArray(input.platforms) ? input.platforms : (input.platform==='both'?['linkedin','medium']:[input.platform||'linkedin']);
  const cleanPlatforms=[...new Set(platforms.map(x=>String(x).toLowerCase()).filter(x=>TARGETS[x]))];
  return {
    schema:'creator-task/v1',
    goal:'create_educational_post',
    topic:String(input.topic||'').trim().slice(0,1000),
    objective:String(input.objective||'Teach one useful technical idea with evidence.').trim().slice(0,1600),
    platforms:cleanPlatforms.length?cleanPlatforms:['linkedin'],
    readMinutes:'2-3',
    freshness:['current','evergreen'].includes(input.freshness)?input.freshness:'current',
    lane:input.lane==='new-development'?'new-development':'education',
    requirePrimarySources:input.requirePrimarySources!==false,
    minSources:Math.max(1,Math.min(5,Number(input.minSources||2))),
    maxRevisionLoops:Math.max(0,Math.min(2,Number(input.maxRevisionLoops??1))),
    publish:false
  };
}

function normalizeEvidence(list=[]){
  const allowedTypes=new Set(['official-docs','official-blog','release-notes','paper','github','news','practitioner','author-owned']);
  return (Array.isArray(list)?list:[]).slice(0,40).map((x,i)=>({
    id:String(x.id||`ev-${i+1}`).slice(0,120),
    claim:String(x.claim||x.title||'').trim().slice(0,1400),
    excerpt:String(x.excerpt||x.content||'').trim().slice(0,4000),
    sourceUrl:String(x.sourceUrl||x.url||'').trim().slice(0,1600),
    sourceType:allowedTypes.has(x.sourceType)?x.sourceType:'practitioner',
    publishedAt:x.publishedAt?String(x.publishedAt):null,
    ownership:x.ownership==='author'?'author':'external',
    confidence:['high','medium','low'].includes(x.confidence)?x.confidence:'medium'
  })).filter(x=>x.claim||x.excerpt||x.sourceUrl);
}

function evidenceGate(contract,evidence){
  const uniqueSources=[...new Set(evidence.map(x=>x.sourceUrl).filter(Boolean))];
  const primary=evidence.filter(x=>['official-docs','official-blog','release-notes','paper','github'].includes(x.sourceType)&&x.sourceUrl);
  const issues=[];
  if(uniqueSources.length<contract.minSources)issues.push({code:'MIN_SOURCES',message:`Need ${contract.minSources} distinct sources; found ${uniqueSources.length}.`});
  if(contract.requirePrimarySources&&!primary.length)issues.push({code:'PRIMARY_SOURCE_REQUIRED',message:'At least one primary/official source is required.'});
  if(contract.lane==='new-development'){
    const cutoff=Date.now()-45*86400000;
    const fresh=evidence.some(x=>{const t=Date.parse(x.publishedAt||'');return Number.isFinite(t)&&t>=cutoff;});
    if(!fresh)issues.push({code:'FRESH_SOURCE_REQUIRED',message:'New-development runs require evidence published within the last 45 days.'});
  }
  return {passed:issues.length===0,issues,sourceCount:uniqueSources.length,primaryCount:primary.length};
}

function fakeExperienceIssues(draft, hasAuthorEvidence){
  if(hasAuthorEvidence)return [];
  const rx=/\bI\s+(built|tested|deployed|measured|implemented|ran|migrated|used|observed|saw|found|benchmarked|shipped)\b/ig;
  const hits=[...String(draft||'').matchAll(rx)].map(m=>m[0]);
  return hits.length?[{code:'UNSUPPORTED_FIRST_PERSON',message:`Unsupported first-person experience claim(s): ${[...new Set(hits)].join(', ')}`}]:[];
}

function evaluateDraft(platform,draft,{contract,evidence,packet}){
  const cfg=TARGETS[platform], wc=wordCount(draft), issues=[];
  if(wc<cfg.minWords||wc>cfg.maxWords)issues.push({code:'READ_LENGTH',message:`${platform} target is ${cfg.minWords}-${cfg.maxWords} words; got ${wc}.`});
  if(platform==='linkedin'&&hashtagCount(draft)>cfg.maxHashtags)issues.push({code:'HASHTAG_LIMIT',message:`LinkedIn allows at most ${cfg.maxHashtags} restrained hashtags.`});
  if(!urls(draft).length)issues.push({code:'SOURCE_LINK_MISSING',message:'Draft must include at least one supporting source URL.'});
  const hasAuthorEvidence=evidence.some(x=>x.ownership==='author'||x.sourceType==='author-owned');
  issues.push(...fakeExperienceIssues(draft,hasAuthorEvidence));
  const refs=(packet?.selected||[]).filter(x=>x.type==='reference-pattern'&&x.text);
  const maxSimilarity=refs.reduce((m,r)=>Math.max(m,overlapRatio(draft,r.text)),0);
  if(maxSimilarity>0.18)issues.push({code:'REFERENCE_SIMILARITY',message:`Reference-pattern overlap ${maxSimilarity.toFixed(3)} exceeds 0.18.`});
  if(/\b(revolutionary|game[- ]?changer|mind[- ]?blowing|you won't believe|secret hack)\b/i.test(draft))issues.push({code:'HYPE_LANGUAGE',message:'Draft contains hype/clickbait language.'});
  const sources=urls(draft);
  const allowed=new Set(evidence.map(x=>x.sourceUrl).filter(Boolean));
  const unknown=sources.filter(x=>!allowed.has(x));
  if(unknown.length)issues.push({code:'UNTRACEABLE_SOURCE',message:'Draft contains source URLs not present in the evidence packet.',details:unknown.slice(0,5)});
  return {platform,passed:issues.length===0,wordCount:wc,sourceLinks:sources.length,maxReferenceSimilarity:Number(maxSimilarity.toFixed(3)),issues};
}

function buildReceipt({runId,contract,evidence,packets,quality,states,model,status,revisionCount}){
  const selected=[...new Set(Object.values(packets||{}).flatMap(p=>(p?.selected||[]).map(x=>x.id)))];
  return {
    schema:'creator-run-receipt/v1',runId,status,createdAt:now(),taskHash:hash({contract,evidence:evidence.map(x=>({id:x.id,claim:x.claim,sourceUrl:x.sourceUrl,publishedAt:x.publishedAt}))}),
    topic:contract.topic,platforms:contract.platforms,readMinutes:contract.readMinutes,model:model||null,revisionCount,
    evidence:{count:evidence.length,ids:evidence.map(x=>x.id),sources:[...new Set(evidence.map(x=>x.sourceUrl).filter(Boolean))]},
    context:{selectedIds:selected},quality,states:states.map(x=>x.state)
  };
}

async function executeHarness(input={},adapters={},deps={}){
  const contract=normalizeContract(input), evidence=normalizeEvidence(input.evidence), states=[];
  const step=(state,details={})=>states.push({state,at:now(),details});
  if(!contract.topic)throw Object.assign(new Error('topic is required'),{code:'TOPIC_REQUIRED'});
  const runId=`run_${hash({topic:contract.topic,at:now(),rnd:Math.random()}).slice(0,16)}`;
  step(STATES.ACCEPTED,{contract});
  const eg=evidenceGate(contract,evidence);
  if(!eg.passed){step(STATES.BLOCKED_EVIDENCE,eg);const receipt=buildReceipt({runId,contract,evidence,packets:{},quality:{evidence:eg},states,status:'blocked-evidence',revisionCount:0});return{runId,status:'blocked-evidence',contract,evidenceGate:eg,states,receipt,drafts:{}};}
  step(STATES.EVIDENCE_READY,eg);
  const build=deps.buildContextPacket||require('./context').buildContextPacket;
  const baseContext={...(input.context||{}),knowledge:[...((input.context||{}).knowledge||[]),...evidence.map(x=>({id:x.id,title:x.claim,content:x.excerpt||x.claim,sourceUrl:x.sourceUrl,createdAt:x.publishedAt,tags:[x.sourceType,x.confidence]}))]};
  const packets={};
  for(const p of contract.platforms)packets[p]=build({topic:contract.topic,objective:contract.objective,platform:p,context:baseContext,topK:Number(input.topK||12)});
  step(STATES.CONTEXT_READY,{platforms:contract.platforms,selected:Object.fromEntries(contract.platforms.map(p=>[p,packets[p].retrieval?.selectedCount||0]))});

  const injected=input.drafts&&typeof input.drafts==='object'?input.drafts:null;
  if(!injected&&!adapters.write){step(STATES.BLOCKED_MODEL,{reason:'No writer adapter configured.'});const receipt=buildReceipt({runId,contract,evidence,packets,quality:{evidence:eg},states,status:'blocked-model',revisionCount:0});return{runId,status:'blocked-model',contract,evidenceGate:eg,packets,states,receipt,drafts:{}};}

  step(STATES.WRITING,{mode:injected?'injected-drafts':'writer-adapter'});
  let drafts={};
  if(injected){for(const p of contract.platforms)drafts[p]=String(injected[p]||'');}
  else {for(const p of contract.platforms)drafts[p]=await adapters.write({platform:p,contract,packet:packets[p],evidence});}
  let revisionCount=0, quality={};
  while(true){
    step(STATES.CRITIQUING,{revision:revisionCount});
    quality=Object.fromEntries(contract.platforms.map(p=>[p,evaluateDraft(p,drafts[p],{contract,evidence,packet:packets[p]})]));
    const failed=contract.platforms.filter(p=>!quality[p].passed);
    if(!failed.length){step(STATES.PASSED,{revisionCount});step(STATES.APPROVAL,{publish:false});const receipt=buildReceipt({runId,contract,evidence,packets,quality,states,model:adapters.model,status:'approval-required',revisionCount});return{runId,status:'approval-required',contract,evidenceGate:eg,packets,states,drafts,quality,receipt};}
    if(!adapters.revise||revisionCount>=contract.maxRevisionLoops||injected){step(STATES.FAILED,{failed,revisionCount});const receipt=buildReceipt({runId,contract,evidence,packets,quality,states,model:adapters.model,status:'quality-failed',revisionCount});return{runId,status:'quality-failed',contract,evidenceGate:eg,packets,states,drafts,quality,receipt};}
    revisionCount++;
    step(STATES.REVISING,{failed,revisionCount});
    for(const p of failed)drafts[p]=await adapters.revise({platform:p,contract,packet:packets[p],evidence,draft:drafts[p],issues:quality[p].issues,revisionCount});
  }
}

module.exports={TARGETS,STATES,normalizeContract,normalizeEvidence,evidenceGate,evaluateDraft,buildReceipt,executeHarness,wordCount,overlapRatio};
