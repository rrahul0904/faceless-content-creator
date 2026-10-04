'use strict';
function esc(s){return String(s||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function toHtml(text){return String(text||'').split(/\n{2,}/).map(block=>{const t=block.trim();if(!t)return'';if(/^#{1,3}\s+/.test(t)){const level=Math.min(3,(t.match(/^#+/)||['#'])[0].length);return`<h${level}>${esc(t.replace(/^#{1,3}\s+/,''))}</h${level}>`}return`<p>${esc(t).replace(/\n/g,'<br>')}</p>`}).join('\n')}
module.exports=async function(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'METHOD_NOT_ALLOWED'});
  try{
    const body=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{}),draft=String(body.draft||'').trim();
    if(!draft)return res.status(400).json({error:'DRAFT_REQUIRED'});
    const title=String(body.title||'Creator Console article').trim().slice(0,220),subtitle=String(body.subtitle||'').trim().slice(0,300);
    const html=`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title></head><body><article><h1>${esc(title)}</h1>${subtitle?`<p><em>${esc(subtitle)}</em></p>`:''}${toHtml(draft)}</article></body></html>`;
    res.setHeader('Cache-Control','no-store');
    return res.status(200).json({ok:true,schema:'creator-medium-export/v1',title,subtitle,html,markdown:draft,workflow:'manual-import-or-paste',note:'Medium does not issue new API integration tokens; existing-token integrations can be added separately when available.'});
  }catch(e){return res.status(400).json({error:'MEDIUM_EXPORT_FAILED',message:String(e.message||e)});}
};
