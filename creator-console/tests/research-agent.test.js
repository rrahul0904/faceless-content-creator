'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {extractLinks,parseFeed,dateFromText,detailMetadata,meaningfulDescription,score,dedupe}=require('../lib/research-agent');

test('official crawler keeps relevant same-host links only',()=>{
  const source={id:'openai',vendor:'OpenAI',url:'https://openai.com/news/',patterns:['/index/','/news/']};
  const html=`<a href="/index/introducing-agents-api/">Introducing the Agents API for production AI systems</a><a href="https://evil.example/news/ai">OpenAI model leak</a><a href="/careers">Careers</a>`;
  const out=extractLinks(html,source);
  assert.equal(out.length,1);
  assert.equal(out[0].url,'https://openai.com/index/introducing-agents-api/');
});

test('RSS fallback parses official relevant items',()=>{
  const source={vendor:'OpenAI',url:'https://openai.com/news/'};
  const xml=`<rss><channel><item><title>Introducing a new agent model</title><link>https://openai.com/index/new-agent-model/</link><pubDate>Fri, 02 Oct 2026 10:00:00 GMT</pubDate></item></channel></rss>`;
  const out=parseFeed(xml,source);
  assert.equal(out.length,1);
  assert.equal(out[0].publishedAt,'2026-10-02');
});

test('abbreviated official dates normalize',()=>{assert.equal(dateFromText('Sep 18, 2026 Announcements'),'2026-09-18')});

test('primary source metadata extracts description and publish date',()=>{
  const md=detailMetadata('<meta property="og:description" content="A concrete architecture update that explains the new agent evaluation workflow, its operational trade-offs, and the deployment impact for enterprise teams."><meta property="article:published_time" content="2026-10-01T12:00:00Z">');
  assert.equal(md.publishedAt,'2026-10-01');
  assert.equal(meaningfulDescription(md.description),true);
});

test('thin metadata cannot qualify as generation-ready evidence',()=>{
  assert.equal(meaningfulDescription('With'),false);
  assert.equal(meaningfulDescription('Agents that interact'),false);
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
