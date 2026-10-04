'use strict';
const items=require('../data/today.json');
function score(s={}){const vals=['fit','novelty','evidence','teachability'].map(k=>Math.max(0,Math.min(5,Number(s[k]||0))));return Math.round(vals.reduce((a,b)=>a+b,0)/20*100);}
module.exports=async function(req,res){res.setHeader('Cache-Control','no-store');const now=Date.now();const out=items.map(x=>({...x,educationalPotential:score(x.signals),ageDays:Math.max(0,Math.floor((now-Date.parse(x.publishedAt+'T00:00:00Z'))/86400000)),status:'ready-to-research'})).sort((a,b)=>b.educationalPotential-a.educationalPotential||Date.parse(b.publishedAt)-Date.parse(a.publishedAt));return res.status(200).json({ok:true,schema:'creator-today-feed/v1',generatedAt:new Date().toISOString(),sourcePolicy:'verified-primary-source-seed',items:out});};
