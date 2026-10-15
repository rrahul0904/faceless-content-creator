'use strict';
const { randomUUID } = require('node:crypto');

const FORMATS = new Set(['process','roadmap','comparison','stats','architecture','listicle']);
const MOTIONS = new Set(['flow','build','pulse']);
const SIZES = { portrait:[1080,1350], square:[1080,1080], landscape:[1200,675] };
const HEX = /^#[0-9a-fA-F]{6}$/;

function clean(value, max){return String(value||'').replace(/\s+/g,' ').trim().slice(0,max);}
function color(value,fallback){const v=String(value||'');return HEX.test(v)?v:fallback;}
function inferFormat(prompt){
  const p=prompt.toLowerCase();
  if(/\b(vs\.?|versus|compare|comparison|before\s+and\s+after)\b/.test(p))return 'comparison';
  if(/\b(roadmap|timeline|milestone|quarter|phase)\b/.test(p))return 'roadmap';
  if(/\b(architecture|system|pipeline|service|database|api|queue|kafka|warehouse|lakehouse|rag)\b/.test(p))return 'architecture';
  if(/\b(stat|metric|kpi|percent|percentage)\b/.test(p)||/\b\d+(?:\.\d+)?%\b/.test(p))return 'stats';
  if(/\b(top\s+\d+|list|checklist|tips|ways|rules|lessons)\b/.test(p))return 'listicle';
  return 'process';
}
function extractValue(text){const m=text.match(/(?:^|\s)([$€£]?\d[\d,.]*\s?(?:%|x|k|m|b|ms|s|sec|min|hrs?)?)(?:\s|$)/i);return m&&m[1]?m[1].trim():undefined;}
function splitItems(prompt){
  const colon=prompt.indexOf(':');
  const body=colon>=0?prompt.slice(colon+1):prompt;
  let parts=body.split(/\s*(?:→|->|=>|\|>|;|\r?\n)\s*/).map(x=>clean(x.replace(/^[-*•\d.)\s]+/,''),300)).filter(Boolean);
  if(parts.length<2){const comma=body.split(/\s*,\s*/).map(x=>clean(x,300)).filter(Boolean);if(comma.length>=3)parts=comma;}
  if(parts.length<2&&/\b(?:vs\.?|versus)\b/i.test(body)){parts=body.split(/\b(?:vs\.?|versus)\b/i).map(x=>clean(x,300)).filter(Boolean);}
  if(!parts.length)parts=[clean(prompt,300)];
  return parts.slice(0,8).map((text,i)=>{const value=extractValue(text);const label=clean(value?text.replace(value,'').replace(/^[:\-\s]+|[:\-\s]+$/g,''):text,110)||clean(text,110);return {id:`item-${i+1}`,label,detail:'',...(value?{value}:{})};});
}
function titleFrom(prompt){const first=String(prompt).split(/\r?\n/)[0].trim();const colon=first.indexOf(':');return clean(colon>5?first.slice(0,colon):first,150)||'Visual story';}
function planVisualStory(body){
  const prompt=clean(body&&body.prompt,4000);if(!prompt){const e=new Error('PROMPT_REQUIRED');e.status=400;throw e;}
  const format=FORMATS.has(body&&body.format)?body.format:inferFormat(prompt);
  const motion=MOTIONS.has(body&&body.motion)?body.motion:'flow';
  const size=Object.prototype.hasOwnProperty.call(SIZES,body&&body.size)?body.size:'portrait';
  const dims=SIZES[size];
  const items=splitItems(prompt);
  const b=body&&body.brand||{};
  return {
    version:'1.0',id:randomUUID(),title:titleFrom(prompt),subtitle:items.length>1?`${items.length} connected ideas`:'Source-grounded visual story',format,motion,size,width:dims[0],height:dims[1],
    brand:{name:clean(b.name,80)||'Creator Studio',handle:clean(b.handle,80)||'@creator',primary:color(b.primary,'#6D5EF9'),secondary:color(b.secondary,'#20C7A8'),background:color(b.background,'#0B1020'),foreground:color(b.foreground,'#F7F8FC')},
    items,sourcePrompt:prompt,provenance:{mode:'deterministic',claimsPolicy:'source-only',generatedAt:new Date().toISOString()}
  };
}
module.exports={planVisualStory,inferFormat,splitItems};
