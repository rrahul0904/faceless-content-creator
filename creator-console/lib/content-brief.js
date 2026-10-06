'use strict';
const crypto=require('crypto');

const EVIDENCE_CLASSES=new Set(['official-doc','official-source','first-party-public','observed-ui','community','reference-pattern','inference','author-owned']);
const EVIDENCE_CAPABLE=new Set(['official-doc','official-source','first-party-public','observed-ui','author-owned']);
const CLAIM_TYPES=new Set(['fact','inference','creator-opinion','author-experience']);
const CLAIM_STATUS=new Set(['supported','disputed','unresolved','unsupported']);
const BRIEF_STATES=new Set(['captured','researching','evidence-ready','perspective-ready','planned','drafting','review','approval-required','approved','scheduled','published','exported','learning','blocked-evidence','blocked-perspective','blocked-verification','blocked-publisher']);
const ALLOWED={
  captured:new Set(['researching','blocked-evidence']),
  researching:new Set(['evidence-ready','blocked-evidence','blocked-verification']),
  'blocked-evidence':new Set(['researching']),
  'blocked-verification':new Set(['researching']),
  'evidence-ready':new Set(['perspective-ready','planned','blocked-perspective']),
  'blocked-perspective':new Set(['perspective-ready','evidence-ready']),
  'perspective-ready':new Set(['planned']),
  planned:new Set(['drafting','blocked-verification']),
  drafting:new Set(['review','blocked-evidence','blocked-verification']),
  review:new Set(['drafting','approval-required','blocked-evidence','blocked-verification']),
  'approval-required':new Set(['review','approved']),
  approved:new Set(['scheduled','published','exported','blocked-publisher']),
  'blocked-publisher':new Set(['approved']),
  scheduled:new Set(['published','blocked-publisher']),
  published:new Set(['learning']),
  exported:new Set(['learning']),
  learning:new Set([])
};
function id(prefix,input){return `${prefix}_${crypto.createHash('sha256').update(String(input)).digest('hex').slice(0,16)}`}
function now(input){return input||new Date().toISOString()}
function sourceRecord(input={}){
  const url=String(input.url||'').trim();
  const evidenceClass=String(input.evidenceClass||'').trim();
  if(!url)throw new Error('SOURCE_URL_REQUIRED');
  if(!EVIDENCE_CLASSES.has(evidenceClass))throw new Error('INVALID_EVIDENCE_CLASS');
  const resolutionStatus=String(input.resolutionStatus||'resolved');
  return Object.freeze({
    schema:'creator-source-record/v1',
    id:String(input.id||id('src',`${url}|${evidenceClass}`)),
    url,
    canonicalUrl:String(input.canonicalUrl||url),
    evidenceClass,
    title:String(input.title||'').slice(0,500),
    publisher:String(input.publisher||input.creator||'').slice(0,300),
    publishedAt:input.publishedAt||null,
    capturedAt:now(input.capturedAt),
    snapshotHash:input.snapshotHash||null,
    userNote:String(input.userNote||'').slice(0,4000),
    resolutionStatus,
    supportsFacts:resolutionStatus==='resolved'&&EVIDENCE_CAPABLE.has(evidenceClass)
  });
}
function claim(input={}){
  const claimType=String(input.claimType||'fact');
  if(!CLAIM_TYPES.has(claimType))throw new Error('INVALID_CLAIM_TYPE');
  const text=String(input.text||'').trim();
  if(!text)throw new Error('CLAIM_TEXT_REQUIRED');
  const status=String(input.status||'unresolved');
  if(!CLAIM_STATUS.has(status))throw new Error('INVALID_CLAIM_STATUS');
  return Object.freeze({
    schema:'creator-claim/v1',
    id:String(input.id||id('clm',`${input.briefId||''}|${claimType}|${text}`)),
    briefId:String(input.briefId||''),
    text,
    claimType,
    supportingSourceIds:[...new Set((input.supportingSourceIds||[]).map(String).filter(Boolean))].sort(),
    confidence:String(input.confidence||'unknown'),
    status,
    caveat:String(input.caveat||'').slice(0,3000)
  });
}
function createBrief(input={}){
  const topic=String(input.topic||'').trim();
  if(!topic)throw new Error('BRIEF_TOPIC_REQUIRED');
  const createdAt=now(input.createdAt),briefId=String(input.id||id('brief',`${topic}|${createdAt}`));
  return {
    schema:'creator-content-brief/v1',id:briefId,topic,status:'captured',createdAt,updatedAt:createdAt,
    trigger:String(input.trigger||'').slice(0,4000),audience:String(input.audience||'').slice(0,1000),teachingOutcome:String(input.teachingOutcome||'').slice(0,2000),creatorTake:String(input.creatorTake||'').slice(0,6000),
    mode:String(input.mode||'factual-explainer'),sourceIds:[],claimIds:[],referencePatternIds:[],platforms:[...new Set((input.platforms||['linkedin','medium']).map(String))].sort(),artifactPlan:null,warnings:[]
  };
}
function transition(brief,to,at){
  if(!brief||!BRIEF_STATES.has(brief.status))throw new Error('INVALID_BRIEF_STATE');
  if(!BRIEF_STATES.has(to))throw new Error('INVALID_TARGET_STATE');
  if(!ALLOWED[brief.status]?.has(to))throw new Error(`INVALID_TRANSITION:${brief.status}->${to}`);
  return {...brief,status:to,updatedAt:now(at)};
}
function attachSource(brief,source){
  const ids=new Set(brief.sourceIds||[]);ids.add(source.id);
  const refs=new Set(brief.referencePatternIds||[]);if(source.evidenceClass==='reference-pattern')refs.add(source.id);
  return {...brief,sourceIds:[...ids].sort(),referencePatternIds:[...refs].sort(),updatedAt:now()};
}
function attachClaim(brief,c){const ids=new Set(brief.claimIds||[]);ids.add(c.id);return {...brief,claimIds:[...ids].sort(),updatedAt:now()};}
function evaluateClaim(c,sourcesById){
  const sources=(c.supportingSourceIds||[]).map(x=>sourcesById.get(x)).filter(Boolean);
  if(c.claimType==='creator-opinion')return {...c,status:'supported',confidence:c.confidence==='unknown'?'author':c.confidence};
  if(c.claimType==='author-experience'){
    const ok=sources.some(s=>s.evidenceClass==='author-owned'&&s.resolutionStatus==='resolved');
    return {...c,status:ok?'supported':'unsupported',confidence:ok?'high':'none',caveat:ok?c.caveat:'Author-experience claims require explicit author-owned evidence/input.'};
  }
  if(c.claimType==='fact'){
    const ok=sources.some(s=>s.supportsFacts);
    return {...c,status:ok?'supported':'unsupported',confidence:ok?(c.confidence==='unknown'?'high':c.confidence):'none',caveat:ok?c.caveat:'Factual claims require at least one resolved evidence-capable source.'};
  }
  if(c.claimType==='inference'){
    const ok=sources.some(s=>s.supportsFacts);
    return {...c,status:ok?'supported':'unsupported',confidence:ok?(c.confidence==='unknown'?'medium':c.confidence):'none',caveat:ok?(c.caveat||'Inference derived from cited evidence; not a direct source claim.'):'Inference requires evidence-capable supporting sources.'};
  }
  return c;
}
function evidenceGate({brief,sources=[],claims=[]}){
  const sourcesById=new Map(sources.map(s=>[s.id,s]));
  const evaluated=claims.filter(c=>(brief.claimIds||[]).includes(c.id)).map(c=>evaluateClaim(c,sourcesById));
  const required=evaluated.filter(c=>c.claimType!=='creator-opinion');
  const unsupported=evaluated.filter(c=>['unsupported','unresolved','disputed'].includes(c.status));
  const experienceRequired=brief.mode==='experience';
  const experienceOk=!experienceRequired||evaluated.some(c=>c.claimType==='author-experience'&&c.status==='supported');
  const hasClaims=evaluated.length>0;
  const passed=hasClaims&&unsupported.length===0&&experienceOk;
  return {schema:'creator-brief-evidence-gate/v1',passed,briefId:brief.id,claimCount:evaluated.length,requiredClaimCount:required.length,unsupportedClaimIds:unsupported.map(c=>c.id).sort(),experienceRequired,experienceOk,evaluatedClaims:evaluated};
}
function canDraft(input){return evidenceGate(input).passed;}
function stable(value){if(Array.isArray(value))return value.map(stable);if(value&&typeof value==='object'){return Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])]))}return value;}
function deterministicSerialize(value){return JSON.stringify(stable(value));}
function receiptHash(value){return crypto.createHash('sha256').update(deterministicSerialize(value)).digest('hex');}
module.exports={EVIDENCE_CLASSES,EVIDENCE_CAPABLE,CLAIM_TYPES,BRIEF_STATES,sourceRecord,claim,createBrief,transition,attachSource,attachClaim,evaluateClaim,evidenceGate,canDraft,deterministicSerialize,receiptHash};
