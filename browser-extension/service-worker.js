const STATE_KEY = 're375CaptureState';
const DEFAULT_ENDPOINT = 'http://127.0.0.1:3000';

function safeUrl(raw) {
  try {
    const url = new URL(raw);
    return `${url.origin}${url.pathname}`;
  } catch {
    return 'about:unknown';
  }
}

function captureId() {
  return `capture-${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}`;
}

async function readState() {
  const stored = await chrome.storage.local.get(STATE_KEY);
  return stored[STATE_KEY] ?? {
    recording: false,
    tabId: null,
    workflowId: 'browser-workflow',
    captureId: null,
    startedAt: null,
    stoppedAt: null,
    events: [],
    endpoint: DEFAULT_ENDPOINT,
  };
}

async function writeState(state) {
  await chrome.storage.local.set({ [STATE_KEY]: state });
  return state;
}

function normalizeEvent(state, event) {
  const atMs = Math.max(0, Date.now() - state.startedAt);
  return {
    id: `event-${state.events.length + 1}-${atMs}`,
    kind: event.kind,
    atMs,
    label: String(event.label || 'Workflow action').slice(0, 180),
    target: event.target ? String(event.target).slice(0, 240) : undefined,
  };
}

async function inject(tabId) {
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ['content-script.js'] });
  } catch (error) {
    console.warn('RE-375 capture injection failed', error);
  }
}

async function addNavigation(state, url) {
  const clean = safeUrl(url);
  const atMs = Math.max(0, Date.now() - state.startedAt);
  const next = {
    ...state,
    events: [
      ...state.events,
      {
        id: `event-${state.events.length + 1}-${atMs}`,
        kind: 'navigation',
        atMs,
        label: `Navigate to ${new URL(clean).pathname || '/'}`,
        target: clean,
      },
    ],
  };
  return writeState(next);
}

async function startSession({ workflowId, endpoint }) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url) throw new Error('No active browser tab is available');

  const granted = await chrome.permissions.request({ origins: ['<all_urls>'] });
  if (!granted) throw new Error('Site access permission was not granted');

  const state = {
    recording: true,
    tabId: tab.id,
    workflowId: String(workflowId || 'browser-workflow').slice(0, 100),
    captureId: captureId(),
    startedAt: Date.now(),
    stoppedAt: null,
    events: [],
    endpoint: String(endpoint || DEFAULT_ENDPOINT).replace(/\/$/, ''),
  };
  await writeState(state);
  const withNavigation = await addNavigation(state, tab.url);
  await inject(tab.id);
  return withNavigation;
}

async function stopSession() {
  const state = await readState();
  if (!state.recording) return state;
  return writeState({ ...state, recording: false, stoppedAt: Date.now() });
}

function asCapture(state) {
  if (!state.captureId || !state.startedAt) throw new Error('No capture session exists');
  const end = state.stoppedAt ?? Date.now();
  const maxEvent = state.events.reduce((max, event) => Math.max(max, event.atMs), 0);
  return {
    workflowId: state.workflowId,
    captureId: state.captureId,
    durationMs: Math.max(2000, end - state.startedAt, maxEvent + 1200),
    events: state.events,
  };
}

async function sendCapture(mode) {
  const state = await stopSession();
  const capture = asCapture(state);
  const endpoint = state.endpoint || DEFAULT_ENDPOINT;
  const path = mode === 'render' ? '/api/v1/workflows/render' : '/api/v1/workflows/compile';
  const response = await fetch(`${endpoint}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(capture),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.ok) throw new Error(body.error || `Workflow ${mode} failed (${response.status})`);
  return body;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    if (message?.type === 'RE375_START') return startSession(message);
    if (message?.type === 'RE375_STOP') return stopSession();
    if (message?.type === 'RE375_STATE') return readState();
    if (message?.type === 'RE375_COMPILE') return sendCapture('compile');
    if (message?.type === 'RE375_RENDER') return sendCapture('render');
    if (message?.type === 'RE375_RESET') return writeState({
      recording: false,
      tabId: null,
      workflowId: 'browser-workflow',
      captureId: null,
      startedAt: null,
      stoppedAt: null,
      events: [],
      endpoint: DEFAULT_ENDPOINT,
    });
    if (message?.type === 'RE375_CAPTURE_EVENT') {
      const state = await readState();
      if (!state.recording || sender.tab?.id !== state.tabId) return state;
      const event = normalizeEvent(state, message.event ?? {});
      return writeState({ ...state, events: [...state.events, event] });
    }
    throw new Error('Unknown RE-375 extension message');
  })().then(
    (data) => sendResponse({ ok: true, data }),
    (error) => sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) }),
  );
  return true;
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete' || !tab.url) return;
  const state = await readState();
  if (!state.recording || state.tabId !== tabId) return;
  const next = await addNavigation(state, tab.url);
  await inject(next.tabId);
});
