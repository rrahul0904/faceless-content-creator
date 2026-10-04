'use strict';
const today=require('../data/today.json');
const research=require('../data/product-research.json');
module.exports=async function(req,res){
  const checks={
    feedHasPrimarySources:today.length>=4&&today.every(x=>/^https:\/\//.test(x.sourceUrl||'')&&/^2026-/.test(x.publishedAt||'')),
    feedHasTeachingAngles:today.every(x=>Array.isArray(x.angleSuggestions)&&x.angleSuggestions.length>=2),
    feedHasTransparentScores:today.every(x=>x.signals&&['fit','novelty','evidence','teachability'].every(k=>Number.isFinite(Number(x.signals[k])))),
    redditResearchRecorded:research.schema==='creator-product-research/v1'&&research.principles.length>=5,
    decisionsAreExplicit:research.principles.every(x=>x.insight&&x.productDecision&&Array.isArray(x.sources)&&x.sources.length>0)
  };
  res.setHeader('Cache-Control','no-store');
  return res.status(200).json({ok:Object.values(checks).every(Boolean),schema:'creator-product-selftest/v1',checks,feedCount:today.length,researchPrinciples:research.principles.length});
};
