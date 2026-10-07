'use strict';
const references=require('../data/references.json');
const referenceInbox=require('../data/reference-inbox.json');
const focus=require('../data/research-focus.json');
const store=require('../lib/store');
module.exports=async function(req,res){
  const modelConfigured=Boolean(process.env.OPENAI_API_KEY),approvalConfigured=Boolean(process.env.CREATOR_APPROVAL_SECRET),linkedinConfigured=Boolean(process.env.LINKEDIN_ACCESS_TOKEN&&process.env.LINKEDIN_AUTHOR_URN),storage=await store.health(),sc=storage.capabilities||{};
  res.setHeader('Cache-Control','no-store');
  return res.status(200).json({
    ok:true,service:'creator-console',contextSchema:'creator-context-packet/v2',referenceCorpus:references.length+referenceInbox.length,referenceInbox:referenceInbox.length,
    research:{mode:'official-source-discovery',sources:['OpenAI','Anthropic','Snowflake','Databricks'],scheduledRefresh:'0 11 * * *',scheduledRefreshUtc:'11:00 UTC daily',liveOnDemand:true,primarySourceEnrichment:true,verifiedSeedFallback:true},
    researchTopics:focus.topics.map(x=>x.label),discoveryLane:focus.discoveryLane.label,formats:focus.formats,
    modelConfigured,model:modelConfigured?(process.env.OPENAI_MODEL||'gpt-5.6-sol'):null,
    storage:{configured:storage.configured,connected:storage.connected,provider:storage.provider,browserFallback:!storage.connected,capabilities:sc},
    approvals:{configured:approvalConfigured,signed:true,contentBound:true},
    publishers:{linkedin:linkedinConfigured?'connected':'not-connected',linkedinMode:'direct-official-posts-api',medium:'export-ready',mediumMode:'html-markdown-export'},
    capabilities:{discover:true,enrichPrimarySources:true,context:true,harness:true,writer:modelConfigured,critic:true,revision:modelConfigured,approval:approvalConfigured,durableBriefs:Boolean(storage.connected&&sc.briefs),durableMemory:Boolean(storage.connected&&sc.profile),durableDrafts:Boolean(storage.connected&&sc.drafts),durableResearch:Boolean(storage.connected&&sc.research),linkedinPublish:linkedinConfigured,mediumExport:true,analytics:Boolean(storage.connected&&sc.analytics&&linkedinConfigured)}
  });
};
