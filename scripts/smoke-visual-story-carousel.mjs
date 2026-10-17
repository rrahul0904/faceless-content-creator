const baseUrl=process.env.SMOKE_BASE_URL??'http://127.0.0.1:3000';
const apiKey=process.env.SMOKE_API_KEY??'';
if(!apiKey.startsWith('fcc_'))throw new Error('SMOKE_API_KEY is required');
const headers={'content-type':'application/json',authorization:`Bearer ${apiKey}`};
async function call(path,init={}){const response=await fetch(baseUrl+path,{...init,headers:{...headers,...(init.headers||{})}});const body=await response.json().catch(()=>({}));if(!response.ok)throw new Error(`${init.method||'GET'} ${path} failed ${response.status}: ${JSON.stringify(body)}`);return body;}
const spec={version:'1.0',id:'carousel-smoke',title:'A governed data platform from source to insight',subtitle:'One source-grounded visual story compiled into multiple LinkedIn artboards.',format:'architecture',motion:'flow',size:'landscape',width:1200,height:675,brand:{name:'Creator Studio',handle:'@creator',primary:'#6D5EF9',secondary:'#20C7A8',background:'#0B1020',foreground:'#F7F8FC'},items:[{id:'item-1',label:'Sources',detail:'Operational systems and event streams.'},{id:'item-2',label:'Ingest',detail:'Batch and streaming ingestion.'},{id:'item-3',label:'Transform',detail:'Governed transformations and tests.'},{id:'item-4',label:'Semantic layer',detail:'Shared business meaning.'},{id:'item-5',label:'Analytics',detail:'BI and agent consumption.'}],sourcePrompt:'Sources -> ingest -> transform -> semantic layer -> analytics',provenance:{mode:'deterministic',claimsPolicy:'source-only',generatedAt:new Date().toISOString(),refinements:[]}};
const adhoc=await call('/api/v1/visual-stories/carousel',{method:'POST',body:JSON.stringify({spec,itemsPerSlide:2})});
if(adhoc.data?.slideCount!==3||adhoc.data?.itemsPerSlide!==2)throw new Error(`Unexpected ad-hoc carousel: ${JSON.stringify(adhoc)}`);
if(adhoc.data.slides.some(slide=>slide.qa?.status!=='PASS'||slide.qa?.profile!=='carousel-focus'||slide.spec?.size!=='portrait'||slide.spec?.width!==1080||slide.spec?.height!==1350))throw new Error(`Carousel slide QA/canvas failed: ${JSON.stringify(adhoc)}`);
const flattened=adhoc.data.slides.flatMap(slide=>slide.spec.items.map(item=>item.id));
if(flattened.join(',')!==spec.items.map(item=>item.id).join(','))throw new Error(`Carousel changed item order/content: ${flattened.join(',')}`);
const created=await call('/api/v1/visual-stories',{method:'POST',body:JSON.stringify({name:'Carousel smoke',spec})});
const storyId=created.data?.id;if(!storyId)throw new Error(`Visual story create failed: ${JSON.stringify(created)}`);
const persisted=await call(`/api/v1/visual-stories/${encodeURIComponent(storyId)}/carousel`,{method:'POST',body:JSON.stringify({itemsPerSlide:2})});
if(persisted.source?.visualStoryId!==storyId||persisted.source?.version!==1||persisted.data?.sourceVersion!==1)throw new Error(`Persisted carousel provenance failed: ${JSON.stringify(persisted)}`);
if(persisted.data?.slideCount!==3||persisted.data.slides.some(slide=>slide.qa?.profile!=='carousel-focus'))throw new Error(`Persisted carousel profile/count failed: ${JSON.stringify(persisted)}`);
console.log(JSON.stringify({ok:true,storyId,sourceVersion:persisted.source.version,slideCount:persisted.data.slideCount,qa:persisted.data.slides.map(slide=>({status:slide.qa.status,profile:slide.qa.profile,score:slide.qa.score}))}));
