'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const store=require('../lib/store-api');

function withEnv(values,fn){const old={};for(const [k,v] of Object.entries(values)){old[k]=process.env[k];if(v===null)delete process.env[k];else process.env[k]=v}return Promise.resolve().then(fn).finally(()=>{for(const [k,v] of Object.entries(old)){if(v===undefined)delete process.env[k];else process.env[k]=v}})}

test('storage capability is explicit when data service is absent',async()=>withEnv({CREATOR_DATA_API_URL:null,CREATOR_DATA_API_TOKEN:null,CREATOR_DATA_TOKEN:null},async()=>{const c=store.config();assert.equal(c.configured,false);assert.equal(c.capabilities.briefs,false);assert.equal(c.capabilities.drafts,false)}));

test('brief bundle uses creator data api atomically',async()=>withEnv({CREATOR_DATA_API_URL:'https://data.example.test/',CREATOR_DATA_API_TOKEN:'secret'},async()=>{const original=global.fetch;let seen;global.fetch=async(url,init)=>{seen={url:String(url),init};return new Response(JSON.stringify({ok:true,data:{schema:'creator-content-bundle/v1',brief:{id:'b1',topic:'T'},sources:[],claims:[]}}),{status:200,headers:{'content-type':'application/json'}})};try{const result=await store.saveBriefBundle({brief:{id:'b1',topic:'T'},sources:[],claims:[]});assert.equal(seen.url,'https://data.example.test/v1/briefs/b1');assert.equal(seen.init.method,'PUT');assert.equal(seen.init.headers.Authorization,'Bearer secret');assert.equal(result.brief.id,'b1')}finally{global.fetch=original}}));
