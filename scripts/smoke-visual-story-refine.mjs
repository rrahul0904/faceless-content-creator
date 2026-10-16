const baseUrl=process.env.SMOKE_BASE_URL??'http://127.0.0.1:3000';
const apiKey=process.env.SMOKE_API_KEY??'';
if(!apiKey.startsWith('fcc_'))throw new Error('SMOKE_API_KEY is required');
const headers={'content-type':'application/json',authorization:`Bearer ${apiKey}`};
async function call(path,init={}){const response=await fetch(baseUrl+path,{...init,headers:{...headers,...(init.headers||{})}});const body=await response.json().catch(()=>({}));if(!response.ok)throw new Error(`${init.method||'GET'} ${path} failed ${response.status}: ${JSON.stringify(body)}`);return body;}

const sourcePrompt='Research -> Evidence -> VisualStorySpec -> QA -> Durable artifact';
const originalTitle='Governed visual story pipeline';
const spec={
  version:'1.0',id:'refine-smoke',title:originalTitle,subtitle:'A source-grounded creative pipeline.',format:'process',motion:'flow',size:'portrait',width:1080,height:1350,
  brand:{name:'Creator Studio',handle:'@creator',primary:'#6D5EF9',secondary:'#20C7A8',background:'#0B1020',foreground:'#F7F8FC'},
  items:[
    {id:'item-1',label:'Research evidence',detail:'Capture public evidence and provenance.'},
    {id:'item-2',label:'Compile owned spec',detail:'Translate evidence into a provider-neutral visual contract.'},
    {id:'item-3',label:'Certify and render',detail:'Run QA before creating the durable artifact.'}
  ],
  sourcePrompt,
  provenance:{mode:'deterministic',claimsPolicy:'source-only',generatedAt:new Date().toISOString()}
};

const created=await call('/api/v1/visual-stories',{method:'POST',body:JSON.stringify({name:'Refine smoke',spec})});
const storyId=created.data?.id;
if(!storyId||created.data?.currentVersion!==1)throw new Error(`Unexpected create response: ${JSON.stringify(created)}`);

const instruction='make this more concise; format to roadmap; motion to pulse; title: Governed Visual Delivery';
const refined=await call(`/api/v1/visual-stories/${encodeURIComponent(storyId)}/refine`,{method:'POST',body:JSON.stringify({instruction})});
const data=refined.data;
if(data?.currentVersion!==2)throw new Error(`Refinement did not append v2: ${JSON.stringify(refined)}`);
if(data?.spec?.title!=='Governed Visual Delivery'||data?.spec?.format!=='roadmap'||data?.spec?.motion!=='pulse')throw new Error(`Requested refinement was not applied: ${JSON.stringify(refined)}`);
if(data?.spec?.sourcePrompt!==sourcePrompt)throw new Error('Refinement mutated the source prompt');
const history=data?.spec?.provenance?.refinements;
if(!Array.isArray(history)||history.length!==1||history[0]?.instruction!==instruction||history[0]?.mode!=='deterministic')throw new Error(`Refinement provenance missing: ${JSON.stringify(history)}`);
if(!Array.isArray(data?.refinement?.changes)||!data.refinement.changes.includes('format:roadmap')||!data.refinement.changes.includes('motion:pulse')||!data.refinement.changes.includes('title'))throw new Error(`Refinement receipt incomplete: ${JSON.stringify(data?.refinement)}`);
if(!data?.qa?.status)throw new Error(`Refinement did not regenerate QA: ${JSON.stringify(data?.qa)}`);

const versionOne=await call(`/api/v1/visual-stories/${encodeURIComponent(storyId)}/versions/1`);
if(versionOne.data?.spec?.title!==originalTitle||versionOne.data?.spec?.format!=='process'||versionOne.data?.spec?.motion!=='flow'||versionOne.data?.spec?.sourcePrompt!==sourcePrompt)throw new Error(`Version 1 was mutated by refinement: ${JSON.stringify(versionOne)}`);
if((versionOne.data?.spec?.provenance?.refinements||[]).length!==0)throw new Error('Version 1 unexpectedly contains refinement provenance');

console.log(JSON.stringify({ok:true,storyId,parentVersion:data.refinement.parentVersion,version:data.currentVersion,changes:data.refinement.changes,qa:data.qa.status,sourcePromptPreserved:true}));
