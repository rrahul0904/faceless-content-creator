(() => {
  if (globalThis.__re375CaptureInstalled) return;
  globalThis.__re375CaptureInstalled = true;

  const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
  const LONG_TOKEN = /\b[A-Za-z0-9_-]{24,}\b/g;
  const CARDISH = /\b(?:\d[ -]*?){13,19}\b/g;

  function sanitizeText(value, fallback = 'Workflow action') {
    const text = String(value ?? '')
      .replace(EMAIL, '[email]')
      .replace(CARDISH, '[number]')
      .replace(LONG_TOKEN, '[token]')
      .replace(/\s+/g, ' ')
      .trim();
    return (text || fallback).slice(0, 180);
  }

  function selectorFor(element) {
    const tag = element.tagName.toLowerCase();
    const testId = element.getAttribute('data-testid');
    if (testId) return `${tag}[data-testid="${sanitizeText(testId, 'test-id')}"]`;
    const name = element.getAttribute('name');
    if (name) return `${tag}[name="${sanitizeText(name, 'field')}"]`;
    const role = element.getAttribute('role');
    if (role) return `${tag}[role="${sanitizeText(role, 'control')}"]`;
    if (element.id && !LONG_TOKEN.test(element.id)) return `#${sanitizeText(element.id, 'control')}`;
    return tag;
  }

  function labelFor(element, fallback) {
    return sanitizeText(
      element.getAttribute('data-workflow-label') ||
      element.getAttribute('aria-label') ||
      element.getAttribute('title') ||
      element.innerText ||
      element.textContent,
      fallback,
    );
  }

  function emit(kind, element, fallback) {
    chrome.runtime.sendMessage({
      type: 'RE375_CAPTURE_EVENT',
      event: {
        kind,
        label: labelFor(element, fallback),
        target: selectorFor(element),
      },
    }).catch(() => {});
  }

  document.addEventListener('click', (event) => {
    const target = event.target instanceof Element
      ? event.target.closest('button,a,[role="button"],input[type="button"],input[type="submit"],[data-testid]')
      : null;
    if (target instanceof HTMLElement) emit('click', target, 'Click control');
  }, true);

  document.addEventListener('change', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    // Deliberately capture only that a field changed. Never read or transmit
    // input.value, selected option values, clipboard contents, or keystrokes.
    emit('input', target, 'Update field');
  }, true);

  document.addEventListener('submit', (event) => {
    const form = event.target;
    if (form instanceof HTMLElement) emit('submit', form, 'Submit form');
  }, true);
})();
