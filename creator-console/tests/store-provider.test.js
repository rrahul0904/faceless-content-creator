'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const store=require('../lib/store');

const KEYS=['CREATOR_DATA_URL','CREATOR_DATA_TOKEN','SUPABASE_URL','SUPABASE_SECRET_KEY','SUPABASE_SERVICE_ROLE_KEY','CREATOR_SUPABASE_URL','CREATOR_SUPABASE_SECRET_KEY'];
function isolated(t){const prior=Object.fromEntries(KEYS.map(k=>[k,process.env[k]]));for(const k of KEYS)delete process.env[k];t.after(()=>{for(const k of KEYS){if(prior[k]===undefined)delete process.env[k];else process.env[k]=prior[k]}})}

test('unconfigured storage fails closed and names the owned provider target',t=>{isolated(t);const c=store.config();assert.equal(c.configured,false);assert.equal(c.provider,'creator-data-service');assert.equal(c.capabilities.briefs,false);assert.equal(c.capabilities.drafts,false)});

test('Creator Data Service wins provider precedence and exposes full current persistence surface',t=>{isolated(t);process.env.CREATOR_DATA_URL='https://creator-data.example.test';process.env.CREATOR_DATA_TOKEN='test-token';process.env.SUPABASE_URL='https://legacy.example.test';process.env.SUPABASE_SECRET_KEY='legacy-key';const c=store.config();assert.equal(c.configured,true);assert.equal(c.provider,'creator-data-service');assert.deepEqual(c.capabilities,{briefs:true,drafts:true,research:true,profile:true,publications:true});assert.equal(store.capability('briefs'),true);assert.equal(store.capability('publications'),true)});

test('Supabase is legacy fallback only when the owned service is absent',t=>{isolated(t);process.env.SUPABASE_URL='https://legacy.example.test';process.env.SUPABASE_SECRET_KEY='legacy-key';const c=store.config();assert.equal(c.configured,true);assert.equal(c.provider,'supabase-postgrest');assert.equal(c.capabilities.research,true)});

test('partial Creator Data Service configuration does not count as durable storage',t=>{isolated(t);process.env.CREATOR_DATA_URL='https://creator-data.example.test';const c=store.config();assert.equal(c.configured,false);assert.equal(c.provider,'creator-data-service')});
