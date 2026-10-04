'use strict';
const references=require('../data/references.json');
const focus=require('../data/research-focus.json');
const store=require('../lib/store');
module.exports=async function(req,res){
  const modelConfigured=Boolean(process.env.OPENAI_API_KEY),storageConfigured=store.config().configured,approvalConfigured=Boolean(process.env.CREATOR_APPROVAL_SECRET),linkedinConfigured=Boolean(process.env.LINKEDIN_ACCESS_TOKEN&&process.env.LINKEDIN_AUTHOR_URN);
  res.setHeader('Cache-Control','no-store');
  return res.status(200).json({
    ok:true,service:'creator-console',contextSchema:'creator-context-packet/v2',referenceCorpus:references.length,
    research:{mode:'official-source-discovery',sources:['OpenAI','Anthropic','Snowflake','Databricks'],scheduledRefresh:'0 */6 * * *',primarySourceEnrichment:true,verifiedSeedFallback:true},
    researchTopics:focus.topics.map(x=>x.label),discoveryLane:focus.discoveryLane.label,formats:focus.formats,
    modelConfigured,model:modelConfigured?(process.env.OPENAI_MODEL||'gpt-5.6-sol'):null,
    storage:{configured:storageConfigured,provider:'supabase-postgrest',browserFallback:true},
    approvals:{configured:approvalConfigured,signed:true,contentBound:true},
    publishers:{linkedin:linkedinConfigured?'connected':'not-connected',linkedinMode:'direct-official-posts-api',medium:'export-ready',mediumMode:'html-markdown-export'},
    capabilities:{discover:true,enrichPrimarySources:true,context:true,harness:true,writer:modelConfigured,critic:true,revision:modelConfigured,approval:approvalConfigured,durableMemory:storageConfigured,durableDrafts:storageConfigured,linkedinPublish:linkedinConfigured,mediumExport:true,analytics:storageConfigured&&linkedinConfigured}
  });
};
