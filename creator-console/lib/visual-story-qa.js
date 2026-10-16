'use strict';

function rgb(hex){const v=String(hex||'').replace('#','');return [0,2,4].map(i=>Number.parseInt(v.slice(i,i+2),16));}
function luminance(hex){const channels=rgb(hex).map(c=>{const n=c/255;return n<=0.03928?n/12.92:((n+0.055)/1.055)**2.4;});return 0.2126*channels[0]+0.7152*channels[1]+0.0722*channels[2];}
function contrast(a,b){const x=luminance(a),y=luminance(b);return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05);}
function occupancy(spec){const header=Math.min(320,130+Math.ceil(String(spec.title||'').length/32)*58+(spec.subtitle?52:0));const footer=90;const content=Math.max(0,spec.height-header-footer);const rows=(spec.format==='comparison'||spec.format==='stats')?Math.ceil(spec.items.length/2):spec.items.length;const card=Math.min(170,Math.max(110,content/Math.max(rows,1)-24));return Math.min(spec.height,header+footer+rows*card+Math.max(0,rows-1)*24)/spec.height;}
function certifyVisualStory(spec){
  const ratio=contrast(spec.brand.foreground,spec.brand.background),used=occupancy(spec),label=Math.max(...spec.items.map(x=>String(x.label||'').length)),detail=Math.max(...spec.items.map(x=>String(x.detail||'').length));
  const checks=[
    {id:'source-provenance',pass:spec.provenance?.claimsPolicy==='source-only'&&String(spec.sourcePrompt||'').trim().length>0,message:'Source prompt and source-only claims policy are retained.'},
    {id:'item-density',pass:spec.items.length>=1&&spec.items.length<=8,value:spec.items.length,threshold:'1-8',message:'Story stays within the feed-scale density budget.'},
    {id:'contrast',pass:ratio>=4.5,value:Number(ratio.toFixed(2)),threshold:4.5,message:'Foreground/background contrast meets the quality floor.'},
    {id:'occupancy',pass:used>=0.72&&used<=0.96,value:Number(used.toFixed(3)),threshold:'0.72-0.96',message:'Estimated vertical occupancy avoids dead zones and overcrowding.'},
    {id:'label-length',pass:label<=96,value:label,threshold:96,message:'Card labels remain readable at feed scale.'},
    {id:'detail-length',pass:detail<=220,value:detail,threshold:220,message:'Supporting detail stays inside the copy budget.'},
    {id:'semantic-motion',pass:['flow','build','pulse'].includes(spec.motion),value:spec.motion,message:'Motion uses a supported semantic pattern.'},
  ];
  const passed=checks.filter(x=>x.pass).length;
  return {version:'1.0',status:passed===checks.length?'PASS':'FAIL',score:Math.round(passed/checks.length*100),checks,certifiedAt:new Date().toISOString()};
}
module.exports={certifyVisualStory};
