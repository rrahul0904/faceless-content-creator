'use strict';
const store=require('../lib/store');
module.exports=async function(req,res){const c=store.config();res.setHeader('Cache-Control','no-store');return res.status(200).json({ok:true,configured:c.configured,provider:'supabase-postgrest',mode:c.configured?'durable-server-storage':'browser-fallback',tables:['creator_profiles','creator_research_items','creator_drafts','creator_publications']});};
