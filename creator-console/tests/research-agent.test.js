'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {extractLinks,score,dedupe}=require('../lib/research-agent');

test('official crawler keeps relevant same-host links only',()=>{
  const source={id:'openai',vendor:'OpenAI',url:'https://openai.com/news/',patterns:['/index/','/news/']};
  const html=`<a href="/index/introducing-agents-api/">Introducing the Agents API for production AI systems</a><a href="https://evil.example/news/ai">OpenAI model leak</a><a href="/careers">Careers</a>`;
  const out=extractLinks(html,source);
  assert.equal(out.length,1);
  assert.equal(out[0].url,'https://openai.com/index/introducing-agents-api/');
});

test('research score rewards teachable architecture topics',()=>{
  const s=score({title:'New agent architecture improves latency cost and governance',url:'https://example.com/blog/agent'});
  assert.equal(s.fit,5);
  assert.equal(s.teachability,5);
  assert.ok(s.potential>=90);
});

test('dedupe collapses tracking variants and trailing slash variants',()=>{
  const out=dedupe([{sourceUrl:'https://example.com/post/?utm_source=x',topic:'A'},{sourceUrl:'https://example.com/post',topic:'A duplicate'},{sourceUrl:'https://example.com/other',topic:'B'}]);
  assert.equal(out.length,2);
});
