'use strict';

/**
 * Clean-room, offline campaign planning contract.
 * Does not fetch URLs, copy external creative, render media, store credentials,
 * schedule or publish. Provider writes require a separate signed approval flow.
 */
const {createHash}=require('node:crypto');

const PLATFORMS=Object.freeze({
  tiktok: {asset:'photo-slides-or-video',aspect:'9:16'},
  instagram: {asset:'reel-or-carousel',aspect:'9:16'},
  facebook: {asset:'vertical-video',aspect:'9:16'},
  youtube: {asset:'short-video',aspect:'9:16'}
});
const PATTERNS=new Set(['question','contrast','how-to','myth-vs-fact']);

function reject(code,message) {
  throw Object.assign(new Error(message),{code});
}
function requiredText(value,field,max=240) {
  if(typeof value!=='string'||!value.trim()||value.length>max)reject('INVALID_TEXT',field+' must be nonempty text up to '+max+' characters');
  return value.trim().replace(/\s+/g,' ');
}
function publicHttpsUrl(value,field) {
  let u;
  try {u=new URL(requiredText(value,field,1800));} catch {reject('INVALID_PUBLIC_URL',field+' must be a valid HTTPS URL');}
  const h=u.hostname.toLowerCase();
  if(u.protocol!=='https:'||u.username||u.password||u.port||
     h==='localhost'||h.endsWith('.localhost')||h.endsWith('.local')||
     h.endsWith('.internal')||h.endsWith('.test')||!h.includes('.')||
     /^\d+(\.\d+)*$/.test(h)||h.includes(':')) {
    reject('INVALID_PUBLIC_URL',field+' must use a public HTTPS hostname without credentials or a port');
  }
  u.hash='';
  return u.toString();
}
function boundedInt(value,field,min,max) {
  if(!Number.isInteger(value)||value<min||value>max)reject('INVALID_LIMIT',field+' must be an integer from '+min+' to '+max);
  return value;
}
function startDay(value) {
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))reject('INVALID_START_DATE','startDate must be YYYY-MM-DD');
  const d=new Date(value+'T00:00:00Z');
  if(!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==value)reject('INVALID_START_DATE','Invalid calendar day');
  return d;
}
function digest(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
function uniqueById(items,label) {
  const seen=new Set();
  for(const item of items) {
    if(seen.has(item.id))reject('DUPLICATE_ID',label+' contains duplicate id '+item.id);
    seen.add(item.id);
  }
}
function normalize(input) {
  if(!input||typeof input!=='object')reject('INVALID_INPUT','Campaign input must be an object');
  const workspaceId=requiredText(input.workspaceId,'workspaceId',64);
  if(!/^[a-z0-9][a-z0-9_-]*$/i.test(workspaceId))reject('INVALID_WORKSPACE','Use a stable opaque workspace ID');
  const product=input.product||{}, audience=input.audience||{}, window=input.window||{};
  const evidence=(Array.isArray(input.evidence)?input.evidence:[]).map((e,i)=>({
    id:requiredText(e?.id,'evidence['+i+'].id',64),
    url:publicHttpsUrl(e?.url,'evidence['+i+'].url'),
    kind:e?.kind==='owner-supplied'?'owner-supplied':e?.kind==='first-party-page'?'first-party-page':reject('INVALID_EVIDENCE_KIND','Product evidence must be first-party or owner-supplied')
  }));
  uniqueById(evidence,'evidence');
  if(!evidence.length||evidence.length>30)reject('INVALID_EVIDENCE','1-30 provenance records required');
  const evidenceMap=new Map(evidence.map(e=>[e.id,e]));
  const claims=(Array.isArray(product.claims)?product.claims:[]).map((c,i)=>{
    const claim={id:requiredText(c?.id,'claims['+i+'].id',64),
      text:requiredText(c?.text,'claims['+i+'].text',300),
      evidenceId:requiredText(c?.evidenceId,'claims['+i+'].evidenceId',64)};
    if(!evidenceMap.has(claim.evidenceId))reject('UNSUPPORTED_CLAIM','A product claim lacks referenced owner/first-party evidence: '+claim.id);
    return claim;
  });
  uniqueById(claims,'claims');
  if(!claims.length||claims.length>20)reject('INVALID_CLAIMS','1-20 evidence-referenced product claims required');
  const pains=(Array.isArray(audience.pains)?audience.pains:[]).map((p,i)=>({
    id:requiredText(p?.id,'pains['+i+'].id',64),
    summary:requiredText(p?.summary,'pains['+i+'].summary',220),
    state:'research-hypothesis'
  }));
  uniqueById(pains,'pains');
  if(!pains.length||pains.length>20)reject('INVALID_PAINS','1-20 audience hypotheses required');
  const platforms=Array.isArray(input.platforms)?[...new Set(input.platforms)]:[];
  if(!platforms.length||platforms.some(p=>typeof p!=='string'||!PLATFORMS[p]))reject('INVALID_PLATFORM','Only known channel adapters are allowed');
  platforms.sort();
  const pattern=input.pattern||'question';
  if(!PATTERNS.has(pattern))reject('INVALID_PATTERN','Use a built-in owned narrative structure; third-party text/templates are not accepted');
  return {
    schema:'creator-campaign-input/v1',workspaceId,
    product:{url:publicHttpsUrl(product.url,'product.url'),name:requiredText(product.name,'product.name',120),
      positioning:requiredText(product.positioning,'product.positioning',240),claims},
    audience:{persona:requiredText(audience.persona,'audience.persona',120),pains},
    evidence,platforms,pattern,
    window:{startDate:window.startDate,postCount:boundedInt(window.postCount,'postCount',1,28),
      intervalDays:boundedInt(window.intervalDays,'intervalDays',1,14)}
  };
}
function proposeCampaign(input) {
  const spec=normalize(input);
  const start=startDay(spec.window.startDate);
  const identity=digest(spec);
  const posts=[];
  for(let i=0;i<spec.window.postCount;i++) {
    const pain=spec.audience.pains[i%spec.audience.pains.length];
    const claim=spec.product.claims[i%spec.product.claims.length];
    const scheduledDay=new Date(start.getTime()+i*spec.window.intervalDays*86400000).toISOString().slice(0,10);
    const slides=[
      {role:'hook',instruction:'Write an original '+spec.pattern+' hook for the audience hypothesis',topic:pain.summary,evidenceIds:[],assertion:'hypothesis'},
      {role:'context',instruction:'Explain the problem without claiming unverified prevalence',topic:pain.summary,evidenceIds:[],assertion:'hypothesis'},
      {role:'proof',instruction:'Use only the supported product claim, and preserve its supporting source',topic:claim.text,evidenceIds:[claim.evidenceId],assertion:'owner-provided-claim'},
      {role:'application',instruction:'Show a concrete illustrative workflow; mark unmeasured outcomes as examples',topic:spec.product.positioning,evidenceIds:[],assertion:'illustrative'},
      {role:'cta',instruction:'Invite the reader to the product; do not invent user testimonials or results',topic:spec.product.url,evidenceIds:[],assertion:'call-to-action'}
    ];
    const postId='ugc_'+digest([identity,i]).slice(0,20);
    posts.push({
      id:postId,proposedDay:scheduledDay,status:'DRAFT_PROPOSAL',approvalRequired:true,
      audienceHypothesisId:pain.id,claimIds:[claim.id],platforms:spec.platforms,
      channelVariants:spec.platforms.map(platform=>({platform,...PLATFORMS[platform],status:'NOT_RENDERED'})),
      storyboard:{schema:'creator-storyboard-brief/v1',width:1080,height:1920,
        slides,video:{kind:'slideshow-reel',status:'NOT_RENDERED',audioRights:'LICENSE_REQUIRED'}},
      safety:{originalityReview:'REQUIRED',claimVerification:'REQUIRED',humanEditorialReview:'REQUIRED'}
    });
  }
  const receipt={schema:'creator-campaign-receipt/v1',specDigest:identity,
    campaignId:'cmp_'+identity.slice(0,20),workspaceId:spec.workspaceId,
    proposedPosts:posts.length,sourceEvidenceIds:spec.evidence.map(e=>e.id),
    outputDigest:digest(posts),mode:'OFFLINE_DRAFT_ONLY',
    providerOperations:0,renderedAssets:0,publishAuthority:'NONE'};
  return {schema:'creator-campaign-plan/v1',spec,posts,receipt,
    status:'NEEDS_REVIEW',canSchedule:false,canPublish:false};
}
module.exports={proposeCampaign,normalize,digest,publicHttpsUrl};
