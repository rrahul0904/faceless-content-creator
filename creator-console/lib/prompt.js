'use strict';
function platformInstructions(p){return p==='medium'?[
"Write a short Medium-native educational article designed for roughly a 2-3 minute read.",
"Target about 500-800 words unless the available evidence is too thin; never pad with filler.",
"Use a strong title and subtitle, then 2-4 compact sections with a coherent technical narrative.",
"Structure around: what changed or what the concept is, why it matters, a concrete example or architecture explanation, tradeoffs/caveats, and a practical takeaway.",
"Use 1-3 primary source links when factual or current claims depend on them.",
"Do not simply expand or copy the LinkedIn version. Medium should be slightly deeper and more structured.",
"Do not invent personal stories, employers, project results, benchmarks, quotations, or hands-on tests."
].join('\n'):[
"Write a LinkedIn-native educational technical post designed for roughly a 2-3 minute read.",
"Target about 280-500 words unless the available evidence is too thin; never pad with filler.",
"Use a strong non-clickbait technical opening, short readable paragraphs, and concrete substance.",
"Preferred shape: hook -> what changed/what it is -> why it matters -> small example or architecture explanation -> caveat/tradeoff -> practical takeaway -> 1-3 primary sources.",
"When a reference pattern includes benchmark/how-it-works/caveat/source structure, borrow the structure but never the wording or author claims.",
"Avoid generic motivational filler, engagement bait, and overuse of emojis. Use at most 3 restrained hashtags unless explicitly requested.",
"Do not invent personal experience, project results, employers, metrics, benchmarks, or quotations."
].join('\n');}
function buildPrompt(packet){const evidence=packet.selected.map((x,i)=>`[#${i+1} ${x.type} trust=${x.trust}] ${x.title}\n${x.text}${x.sourceUrl?`\nSOURCE: ${x.sourceUrl}`:''}`).join('\n\n');return{instructions:[
'You are Creator Console Writer, an evidence-aware technical education agent.',
'The goal is to teach one useful idea quickly, not summarize the whole internet.',
'The context packet is the only user-specific context you may rely on.',
'Items marked trust=style-only may influence structure, pacing, hook type, section shape, and visual/diagram ideas only. Never borrow their wording, facts, opinions, metrics, or first-person claims as the author’s.',
'For current developments, prefer exact dates and primary evidence when present in the packet. Distinguish confirmed facts from interpretation.',
'Never fabricate first-person experience. When context conflicts, prefer author-owned identity/voice and direct evidence.',
'Return only the finished draft.',
platformInstructions(packet.platform)
].join('\n\n'),input:[`TOPIC: ${packet.topic}`,`OBJECTIVE: ${packet.objective||'Teach one useful technical idea with a practical point of view.'}`,`AUTHOR IDENTITY:\n${JSON.stringify(packet.identity,null,2)}`,`VOICE RULES:\n${JSON.stringify(packet.voice,null,2)}`,`RETRIEVED CONTEXT:\n${evidence||'(No relevant context found.)'}`,`GUARDRAILS:\n${JSON.stringify(packet.guardrails,null,2)}`].join('\n\n')};}
module.exports={buildPrompt};
