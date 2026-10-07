'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const store=require('../lib/store');

const KEYS=['CREATOR_DATA_URL','CREATOR_DATA_API_URL','CREATOR_DATA_TOKEN','CREATOR_DATA_API_TOKEN','SUPABASE_URL','SUPABASE_SECRET_KEY'];
function isolated(t){const prior=Object.fromEntries(KEYS.map(k=>[k,process.env[k]]));for(const k of KEYS)delete process.env[k];t.after(()=>{for(const k of KEYS){if(prior[k]===undefined)delete process.env[k];else process.env[k]=prior[k]}})}

test('unconfigured storage fails closed and names the owned provider target',t=>{isolated(t);const c=store.config();assert.equal(c.configured,false);assert.equal(c.provider,'creator-data-service');assert.deepEqual(c.capabilities,{briefs:false,drafts:false,research:false,profile:false,publications:false})});
test('Creator Data Service exposes the complete current persistence surface',t=>{isolated(t);process.env.CREATOR_DATA_URL='https://creator-data.example.test';process.env.CREATOR_DATA_TOKEN='test-token';const c=store.config();assert.equal(c.configured,true);assert.equal(c.provider,'creator-data-service');assert.deepEqual(c.capabilities,{briefs:true,drafts:true,research:true,profile:true,publications:true});assert.equal(store.capability('briefs'),true);assert.equal(store.capability('publications'),true)});
test('Supabase variables alone no longer configure reset-branch storage',t=>{isolated(t);process.env.SUPABASE_URL='https://legacy.example.test';process.env.SUPABASE_SECRET_KEY='legacy-key';const c=store.config();assert.equal(c.configured,false);assert.equal(c.provider,'creator-data-service')});
test('API URL/token aliases are accepted during migration',t=>{isolated(t);process.env.CREATOR_DATA_API_URL='https://creator-data.example.test';process.env.CREATOR_DATA_API_TOKEN='test-token';const c=store.config();assert.equal(c.configured,true);assert.equal(c.provider,'creator-data-service')});
test('partial Creator Data Service configuration does not count as durable storage',t=>{isolated(t);process.env.CREATOR_DATA_URL='https://creator-data.example.test';const c=store.config();assert.equal(c.configured,false);assert.equal(c.provider,'creator-data-service')});
