'use strict';
const {executeHarness}=require('../lib/harness');
const {buildPrompt}=require('../lib/prompt');

function outputText(data){
  if(typeof data?.output_text==='string'&&data.output_text.trim())return data.output_text.trim();
  const out=[];
  for(const item of data?.output||[])for(const part of item?.content||[]){
    if(typeof part?.text==='string')out.push(part.text);
    else if(typeof part?.text?.value==='string')out.push(part.text.value);
  }
  return out.join('\n').trim();
}
async function callModel({key,model,instructions,input}){
  const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({model,instructions,input,store:false,reasoning:{effort:process.env.OPENAI_REASONING_EFFORT||'medium'}})});
  const data=await r.json();
  if(!r.ok)throw Object.assign(new Error(data?.error?.message||'Model request failed'),{status:r.status,code:'MODEL_REQUEST_FAILED'});
  const text=outputText(data);
  if(!text)throw Object.assign(new Error('Model returned empty output'),{code:'EMPTY_MODEL_OUTPUT'});
  return text;
}
function evidenceList(evidence){return evidence.map((x,i)=>`${i+1}. ${x.claim||x.id}\n${x.sourceUrl}`).join('\n');}

module.exports=async function(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'METHOD_NOT_ALLOWED'});
  try{
    const body=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{});
    const key=process.env.OPENAI_API_KEY, model=process.env.OPENAI_MODEL||'gpt-5.6-sol';
    const adapters=key?{
      model,
      write:async({packet,evidence})=>{
        const prompt=buildPrompt(packet);
        return callModel({key,model,instructions:`${prompt.instructions}\n\nHARNESS RULE: Use only the evidence/source URLs in the packet. The result must pass the platform word-count and source-link gates.`,input:`${prompt.input}\n\nALLOWED EVIDENCE SOURCES:\n${evidenceList(evidence)}`});
      },
      revise:async({platform,contract,evidence,draft,issues})=>callModel({
        key,model,
        instructions:'You are the revision worker in Creator Agent Harness. Fix every listed quality-gate failure without introducing new facts, personal experience, metrics, or source URLs. Return only the revised finished draft.',
        input:`PLATFORM: ${platform}\nTOPIC: ${contract.topic}\nTARGET: ${platform==='linkedin'?'280-500':'500-800'} words\nISSUES:\n${issues.map(x=>`- ${x.code}: ${x.message}`).join('\n')}\n\nALLOWED SOURCES:\n${evidenceList(evidence)}\n\nDRAFT TO REVISE:\n${draft}`
      })
    }:{};
    const result=await executeHarness(body,adapters);
    res.setHeader('Cache-Control','no-store');
    return res.status(200).json({...result,capabilities:{writer:Boolean(key),deterministicCritic:true,revisionLoop:Boolean(key),publisher:false}});
  }catch(e){
    return res.status(e.status&&Number.isInteger(e.status)?e.status:400).json({error:e.code||'HARNESS_RUN_FAILED',message:e.message});
  }
};
