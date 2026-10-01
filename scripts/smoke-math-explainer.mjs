const baseUrl = process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:3000';
const smokeApiKey = process.env.SMOKE_API_KEY ?? '';

function headers() {
  return {
    'Content-Type': 'application/json',
    ...(smokeApiKey ? { Authorization: `Bearer ${smokeApiKey}` } : {}),
  };
}

async function post(body) {
  const response = await fetch(`${baseUrl}/api/v1/math-explainer/compile`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

const montyHall = {
  schemaVersion: 1,
  question: 'In the Monty Hall problem, why does switching give a 2/3 chance of winning?',
  audience: 'curious high-school learner comfortable with simple probability',
  targetDurationSeconds: 110,
  renderer: 'manim',
  output: { resolution: '1080p', fps: 30, captions: 'srt' },
  claims: [
    {
      id: 'initial-choice',
      statement: 'The initial chosen door contains the prize with probability 1/3.',
      kind: 'fact',
      critical: false,
      verification: { method: 'enumerative', evidence: 'Enumerate the three equally likely prize-door positions.' },
    },
    {
      id: 'switch-result',
      statement: 'A switch wins in two of the three equally likely initial prize-door cases, so its success probability is 2/3.',
      kind: 'result',
      critical: true,
      requiresContrast: true,
      verification: { method: 'enumerative', evidence: 'Enumerate prize behind chosen door versus each of the two unchosen doors.' },
    },
  ],
  chapters: [
    { id: 'setup', title: 'Set up the game', sceneIds: ['frame', 'enumerate', 'contrast', 'conclusion'] },
  ],
  scenes: [
    {
      id: 'frame',
      chapterId: 'setup',
      title: 'Three equally likely prize positions',
      role: 'orient',
      durationSeconds: 20,
      narration: 'Before any door opens, the prize is equally likely to be behind any one of the three doors.',
      claimIds: ['initial-choice'],
      visualIntents: ['Show three doors and distribute one-third probability to each.'],
      editable: true,
    },
    {
      id: 'enumerate',
      chapterId: 'setup',
      title: 'Enumerate all cases',
      role: 'derive',
      durationSeconds: 35,
      narration: 'Hold the first choice fixed and enumerate where the prize can be. Switching loses only when the first choice was already right.',
      claimIds: ['switch-result'],
      visualIntents: ['Use a three-row case table; highlight the two rows where switching wins.'],
      editable: true,
    },
    {
      id: 'contrast',
      chapterId: 'setup',
      title: 'Why the remaining doors are not fifty-fifty',
      role: 'contrast',
      durationSeconds: 30,
      narration: 'The host is constrained to reveal a goat, so opening a door does not reset the original one-third probability on the chosen door.',
      claimIds: ['switch-result'],
      visualIntents: ['Freeze the original one-third label and transfer the unchosen two-thirds mass to the only unopened alternative.'],
      editable: true,
    },
    {
      id: 'conclusion',
      chapterId: 'setup',
      title: 'Switching wins two cases out of three',
      role: 'conclude',
      durationSeconds: 20,
      narration: 'Because two of the three equally likely cases win by switching, switching succeeds with probability two-thirds.',
      claimIds: ['switch-result'],
      visualIntents: ['Return to the case table and count two switch wins out of three rows.'],
      editable: true,
    },
  ],
};

const good = await post(montyHall);
if (!good.response.ok || good.payload?.data?.qualityGates?.some((gate) => gate.passed !== true)) {
  throw new Error(`Monty Hall explanatory fixture failed: ${good.response.status} ${JSON.stringify(good.payload)}`);
}
if (good.payload?.data?.claimCoverage?.contrastSatisfied !== 1 || good.payload?.data?.editable !== true) {
  throw new Error(`Compiled receipt missed contrast/editability evidence: ${JSON.stringify(good.payload?.data)}`);
}

const assertionOnly = {
  ...montyHall,
  chapters: [{ id: 'setup', title: 'Assertion only', sceneIds: ['frame', 'conclusion'] }],
  scenes: [montyHall.scenes[0], montyHall.scenes[3]],
};

const bad = await post(assertionOnly);
if (bad.response.status !== 422 || bad.payload?.code !== 'EXPLAIN_NOT_ASSERT') {
  throw new Error(`Assertion-only draft did not fail closed: ${bad.response.status} ${JSON.stringify(bad.payload)}`);
}

console.log(JSON.stringify({
  ok: true,
  positive: {
    totalDurationSeconds: good.payload.data.totalDurationSeconds,
    criticalVerified: good.payload.data.claimCoverage.criticalVerified,
    contrastSatisfied: good.payload.data.claimCoverage.contrastSatisfied,
    editable: good.payload.data.editable,
  },
  negative: { status: bad.response.status, code: bad.payload.code },
}));
