'use strict';
const crypto=require('crypto');

const FACTUAL_SOURCE_CLASSES=new Set(['official-doc','official-source','first-party-public','observed-ui']);
const NON_FACTUAL_SOURCE_CLASSES=new Set(['structural-reference','community-feedback','inference']);

function id(prefix,value){return `${prefix}-${crypto.createHash('sha256').update(String(value||'')).digest('hex').slice(0,12)}`}
function list(v){return Array.isArray(v)?v:[]}
function clean(v,max=4000){return String(v||'').replace(/\s+/g,' ').trim().slice(0,max)}
function uniq(v){return [...new Set(list(v).filter(Boolean).map(String))]}

function normalizeSource(input={}){
  const sourceClass=String(input.sourceClass||'inference');
  const source={
    id:String(input.id||id('src',input.url||input.title||JSON.stringify(input))),
    url:String(input.url||''),
    title:clean(input.title,500),
    sourceClass,
    publisher:clean(input.publisher,240),
    publishedAt:input.publishedAt?String(input.publishedAt):null,
    content:clean(input.content||input.summary||'',12000),
    observations:list(input.observations).map(x=>clean(x,2400)).filter(Boolean),
    semanticLimitations:uniq(input.semanticLimitations),
    resolved:input.resolved!==false,
    metadataOnly:Boolean(input.metadataOnly)
  };
  return source;
}

function sourceCanSupportFact(source){
  if(!source||!source.resolved||source.metadataOnly)return false;
  if(NON_FACTUAL_SOURCE_CLASSES.has(source.sourceClass))return false;
  return FACTUAL_SOURCE_CLASSES.has(source.sourceClass);
}

function understandingReceipt(sources){
  const normalized=list(sources).map(normalizeSource);
  const unresolved=normalized.filter(x=>!x.resolved);
  const metadataOnly=normalized.filter(x=>x.metadataOnly);
  const readable=normalized.filter(x=>x.resolved&&!x.metadataOnly&&(x.content||x.observations.length));
  return{
    schema:'creator-understanding-receipt/v1',
    state:readable.length?'UNDERSTANDING':'CAPTURED',
    sources:normalized,
    readableSourceIds:readable.map(x=>x.id),
    unresolvedSourceIds:unresolved.map(x=>x.id),
    metadataOnlySourceIds:metadataOnly.map(x=>x.id),
    warnings:[
      ...unresolved.map(x=>`Source ${x.id} is unresolved; no title, sentiment, workflow or technical conclusion may be inferred from it.`),
      ...metadataOnly.map(x=>`Source ${x.id} is metadata-only and cannot independently qualify a factual claim.`)
    ]
  };
}

function normalizeClaim(input={},index=0){
  return{
    id:String(input.id||`claim-${index+1}`),
    text:clean(input.text||input.claim,3000),
    factual:input.factual!==false,
    evidenceSourceIds:uniq(input.evidenceSourceIds||input.sourceIds),
    benchmark:Boolean(input.benchmark),
    benchmarkConditions:clean(input.benchmarkConditions,2000)
  };
}

function evaluateEvidence(claims,sources){
  const byId=new Map(sources.map(x=>[x.id,x]));
  const evaluated=list(claims).map(normalizeClaim).map(claim=>{
    const bound=claim.evidenceSourceIds.map(x=>byId.get(x)).filter(Boolean);
    const factualSupport=bound.filter(sourceCanSupportFact);
    const benchmarkConditionsPassed=!claim.benchmark||Boolean(claim.benchmarkConditions);
    const passed=!claim.factual||(factualSupport.length>0&&benchmarkConditionsPassed);
    const issues=[];
    if(claim.factual&&!factualSupport.length)issues.push('FACTUAL_CLAIM_WITHOUT_QUALIFYING_EVIDENCE');
    if(claim.benchmark&&!claim.benchmarkConditions)issues.push('BENCHMARK_CONDITIONS_REQUIRED');
    return{...claim,passed,qualifyingEvidenceSourceIds:factualSupport.map(x=>x.id),issues};
  });
  const semanticWarnings=[];
  for(const source of sources){
    for(const limitation of source.semanticLimitations){
      semanticWarnings.push({sourceId:source.id,limitation});
    }
  }
  return{
    schema:'creator-evidence-gate/v2',
    passed:evaluated.every(x=>x.passed),
    claims:evaluated,
    semanticWarnings
  };
}

function normalizeAssertion(input={},index=0){
  return{
    id:String(input.id||`author-${index+1}`),
    text:clean(input.text||input.assertion,3000),
    kind:String(input.kind||'judgment'),
    owner:String(input.owner||'creator'),
    verified:Boolean(input.verified!==false)
  };
}

function evaluateAuthorship({requiresJudgment=false,authorAssertions=[]}={}){
  const assertions=list(authorAssertions).map(normalizeAssertion).filter(x=>x.owner==='creator'&&x.verified&&x.text);
  const passed=!requiresJudgment||assertions.length>0;
  return{
    schema:'creator-authorship-gate/v1',
    passed,
    requiresJudgment:Boolean(requiresJudgment),
    assertionIds:assertions.map(x=>x.id),
    assertions,
    questions:passed?[]:[
      'What is your actual position on this topic?',
      'Which architecture or trade-off would you choose, and why?',
      'Where could this fail in a real production system?'
    ],
    blockedReason:passed?null:'BLOCKED_AUTHORSHIP_INSUFFICIENT'
  };
}

function topoLessons(clusters){
  const items=list(clusters).map((x,i)=>typeof x==='string'?{id:`lesson-${i+1}`,title:x,prerequisiteIds:i? [`lesson-${i}`]:[]}:{
    id:String(x.id||`lesson-${i+1}`),
    title:clean(x.title||x.label||`Lesson ${i+1}`,300),
    prerequisiteIds:uniq(x.prerequisiteIds||x.dependsOn||(i?[`lesson-${i}`]:[])),
    milestone:clean(x.milestone,500)||null
  });
  const ids=new Set(items.map(x=>x.id));
  for(const item of items)item.prerequisiteIds=item.prerequisiteIds.filter(x=>ids.has(x)&&x!==item.id);
  const indegree=new Map(items.map(x=>[x.id,0])),children=new Map(items.map(x=>[x.id,[]]));
  for(const item of items)for(const p of item.prerequisiteIds){indegree.set(item.id,(indegree.get(item.id)||0)+1);children.get(p)?.push(item.id)}
  const queue=items.filter(x=>indegree.get(x.id)===0).map(x=>x.id),order=[];
  while(queue.length){const n=queue.shift();order.push(n);for(const c of children.get(n)||[]){indegree.set(c,indegree.get(c)-1);if(indegree.get(c)===0)queue.push(c)}}
  return{lessons:items,acyclic:order.length===items.length,order};
}

function chooseContentPlan({topic='',clusters=[],questions=[],projectSpine=null,requestedType=null,semanticWarnings=[]}={}){
  const clusterList=list(clusters),questionList=list(questions);
  let type=requestedType;
  const reasons=[];
  if(!type){
    if(projectSpine&&clusterList.length>=3){type='project-backed-series';reasons.push('Broad multi-stage domain plus a cumulative project spine.');}
    else if(clusterList.length>=3){type='series';reasons.push('Topic contains multiple dependency clusters and should not be compressed automatically into one post.');}
    else if(questionList.length>=5){type='question-map';reasons.push('Topic is naturally decomposed into a substantial question set.');}
    else{type='single';reasons.push('Topic is bounded enough for one focused lesson.');}
  }else reasons.push('Content type was explicitly requested.');
  const graph=(type==='series'||type==='project-backed-series')?topoLessons(clusterList):{lessons:[],acyclic:true,order:[]};
  const artifactRequirements=[];
  const lower=`${topic} ${clusterList.map(x=>typeof x==='string'?x:x.title||'').join(' ')}`.toLowerCase();
  if(/architecture|system design|pipeline|rag|mcp|platform/.test(lower))artifactRequirements.push('architecture-or-data-flow-diagram');
  if(/benchmark|latency|cost|performance|evaluation/.test(lower))artifactRequirements.push('benchmark-or-evaluation-table');
  if(/sql|python|spark|airflow|dbt|kafka|code|implementation/.test(lower))artifactRequirements.push('code-or-implementation-example');
  const productionWarnings=list(semanticWarnings).filter(x=>/reference|tutorial|not.production|production-ready/i.test(String(x.limitation||'')));
  return{
    schema:'creator-content-plan/v1',
    id:id('plan',`${topic}:${type}:${JSON.stringify(clusterList)}`),
    topic:clean(topic,1000),
    type,
    reason:reasons.join(' '),
    lessons:graph.lessons,
    lessonOrder:graph.order,
    acyclic:graph.acyclic,
    questions:questionList.map(x=>clean(x,500)).filter(Boolean),
    projectSpine:projectSpine?{title:clean(projectSpine.title||projectSpine,500),cumulativeArtifact:clean(projectSpine.cumulativeArtifact||'',1000)||null}:null,
    artifactRequirements:uniq(artifactRequirements),
    productionWarnings
  };
}

function runReconstruction(input={}){
  const understanding=understandingReceipt(input.sources);
  const evidence=evaluateEvidence(input.claims,understanding.sources);
  const states=['CAPTURED'];
  if(understanding.state==='UNDERSTANDING')states.push('UNDERSTANDING');
  if(!evidence.passed){
    return{schema:'creator-reconstruction/v1',status:'BLOCKED_EVIDENCE_INSUFFICIENT',states,understanding,evidence,authorship:null,contentPlan:null};
  }
  states.push('EVIDENCE_READY');
  const authorship=evaluateAuthorship({requiresJudgment:Boolean(input.requiresJudgment),authorAssertions:input.authorAssertions});
  if(!authorship.passed){
    return{schema:'creator-reconstruction/v1',status:'BLOCKED_AUTHORSHIP_INSUFFICIENT',states,understanding,evidence,authorship,contentPlan:null};
  }
  states.push('AUTHORSHIP_READY');
  const contentPlan=chooseContentPlan({topic:input.topic,clusters:input.clusters,questions:input.questions,projectSpine:input.projectSpine,requestedType:input.requestedType,semanticWarnings:evidence.semanticWarnings});
  if(!contentPlan.acyclic){
    return{schema:'creator-reconstruction/v1',status:'BLOCKED_INVALID_CONTENT_PLAN',states,understanding,evidence,authorship,contentPlan};
  }
  states.push('CONTENT_PLAN');
  return{
    schema:'creator-reconstruction/v1',
    status:'CONTENT_PLAN_READY',
    states,
    understanding,
    evidence,
    authorship,
    contentPlan,
    receipt:{
      sourceIds:understanding.sources.map(x=>x.id),
      claimIds:evidence.claims.map(x=>x.id),
      authorAssertionIds:authorship.assertionIds,
      contentPlanId:contentPlan.id
    }
  };
}

module.exports={
  FACTUAL_SOURCE_CLASSES,NON_FACTUAL_SOURCE_CLASSES,
  normalizeSource,sourceCanSupportFact,understandingReceipt,evaluateEvidence,evaluateAuthorship,topoLessons,chooseContentPlan,runReconstruction
};
