const baseUrl=process.env.SMOKE_BASE_URL??'http://127.0.0.1:3000';
const apiKey=process.env.SMOKE_API_KEY??'';
if(!apiKey.startsWith('fcc_'))throw new Error('SMOKE_API_KEY is required');
const headers={authorization:`Bearer ${apiKey}`};
async function call(path,init={}){const response=await fetch(baseUrl+path,{...init,headers:{...headers,...(init.headers||{})}});const body=await response.json().catch(()=>({}));return{response,body};}
async function json(path,init={}){const out=await call(path,init);if(!out.response.ok)throw new Error(`${init.method||'GET'} ${path} failed ${out.response.status}: ${JSON.stringify(out.body)}`);return out.body;}

const s3=await json('/api/v1/visual-story-icons?q=s3');
const s3Icon=s3.data?.find((item)=>item.key==='aws:s3');
if(!s3Icon||s3Icon.kind!=='architecture-icon'||s3Icon.assetMode!=='fallback'||s3Icon.assetInstalled!==false||!String(s3Icon.officialSource||'').includes('aws.amazon.com/architecture/icons')){
  throw new Error(`AWS icon registry result is invalid: ${JSON.stringify(s3Icon)}`);
}
if(!s3.registry?.version||!s3.registry?.verifiedAt)throw new Error(`Registry receipt missing: ${JSON.stringify(s3.registry)}`);

const snowflake=await json('/api/v1/visual-story-icons?q=snowflake');
const snowflakeIcon=snowflake.data?.find((item)=>item.key==='snowflake:snowflake');
if(!snowflakeIcon||snowflakeIcon.kind!=='brand-mark'||snowflakeIcon.assetPolicy!=='official-brand-asset-only'||snowflakeIcon.assetMode!=='fallback'){
  throw new Error(`Snowflake brand-mark policy is invalid: ${JSON.stringify(snowflakeIcon)}`);
}

const alias=await json('/api/v1/visual-story-icons?q=bigquery');
if(!alias.data?.some((item)=>item.key==='gcp:bigquery'))throw new Error(`BigQuery alias lookup failed: ${JSON.stringify(alias.data)}`);

const spec={
  version:'1.0',id:'icon-registry-smoke',title:'Governed technical icon registry',subtitle:'Official-source provenance with explicit fallback rendering.',format:'architecture',motion:'flow',size:'portrait',width:1080,height:1350,
  brand:{name:'Creator Studio',handle:'@creator',primary:'#6D5EF9',secondary:'#20C7A8',background:'#0B1020',foreground:'#F7F8FC'},
  items:[
    {id:'item-1',label:'Object storage',detail:'Registered AWS architecture identity.',iconKey:'aws:s3'},
    {id:'item-2',label:'Warehouse',detail:'Registered Google Cloud architecture identity.',iconKey:'gcp:bigquery'},
    {id:'item-3',label:'Lakehouse',detail:'Protected vendor brand mark uses explicit fallback until an official asset is installed.',iconKey:'databricks:databricks'},
    {id:'item-4',label:'Governed layer',detail:'Owned neutral glyph remains provider independent.',iconKey:'generic:governance'}
  ],
  sourcePrompt:'Show governed provider identities for a technical architecture.',
  provenance:{mode:'deterministic',claimsPolicy:'source-only',generatedAt:new Date().toISOString()}
};

const created=await json('/api/v1/visual-stories',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:'Icon registry smoke',spec})});
const iconCheck=created.data?.qa?.checks?.find((check)=>check.id==='technical-icon-registry');
if(created.data?.qa?.status!=='PASS'||!iconCheck?.pass||!String(iconCheck.value||'').includes('fallback')){
  throw new Error(`Known icon keys did not certify: ${JSON.stringify(created.data?.qa)}`);
}

const invalidSpec=structuredClone(spec);
invalidSpec.id='invalid-icon-smoke';
invalidSpec.items[0].iconKey='vendor:invented-logo';
const invalid=await call('/api/v1/visual-stories/render',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({spec:invalidSpec,output:'gif'})});
if(invalid.response.status!==422||invalid.body?.error!=='VISUAL_STORY_QA_FAILED')throw new Error(`Unknown icon did not fail QA before render: ${invalid.response.status} ${JSON.stringify(invalid.body)}`);
const invalidCheck=invalid.body?.qa?.checks?.find((check)=>check.id==='technical-icon-registry');
if(invalidCheck?.pass!==false||!String(invalidCheck?.message||'').includes('vendor:invented-logo'))throw new Error(`Unknown icon failure receipt is incomplete: ${JSON.stringify(invalidCheck)}`);

const refined=await json(`/api/v1/visual-stories/${encodeURIComponent(created.data.id)}/refine`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({instruction:'icon item 2: Azure Data Factory'})});
if(refined.data?.spec?.items?.[1]?.iconKey!=='azure:data-factory'||refined.data?.currentVersion!==2||!refined.data?.refinement?.changes?.includes('icon:2:azure:data-factory')){
  throw new Error(`Icon refinement did not resolve alias/version provenance: ${JSON.stringify(refined.data)}`);
}

const unknownRefine=await call(`/api/v1/visual-stories/${encodeURIComponent(created.data.id)}/refine`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({instruction:'icon item 1: Definitely Not A Real Provider Icon'})});
if(unknownRefine.response.status!==422||unknownRefine.body?.error!=='REFINEMENT_UNKNOWN_TECHNICAL_ICON'){
  throw new Error(`Unknown icon refinement did not fail semantically: ${unknownRefine.response.status} ${JSON.stringify(unknownRefine.body)}`);
}

console.log(JSON.stringify({ok:true,registryVersion:s3.registry.version,verifiedAt:s3.registry.verifiedAt,knownIcons:['aws:s3','gcp:bigquery','databricks:databricks','generic:governance'],fallbackCertified:true,unknownBlocked:true,refinedIcon:'azure:data-factory'}));
