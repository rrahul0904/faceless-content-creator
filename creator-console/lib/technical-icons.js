'use strict';

const registry = require('./technical-icons.json');

const byKey = new Map(registry.icons.map((icon) => [icon.key, icon]));
const aliases = new Map();
for (const icon of registry.icons) {
  const candidates = [icon.key, icon.product, ...(icon.aliases || [])];
  for (const value of candidates) aliases.set(normalize(value), icon.key);
}

function normalize(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9:/+.-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function publicIcon(icon) {
  const source = registry.sources[icon.provider] || null;
  return {
    key: icon.key,
    provider: icon.provider,
    providerName: source?.provider || icon.provider,
    product: icon.product,
    kind: icon.kind,
    aliases: icon.aliases || [],
    fallbackLabel: icon.fallbackLabel,
    assetInstalled: Boolean(icon.assetPath),
    assetMode: icon.assetPath ? 'official' : 'fallback',
    officialSource: source?.officialUrl || null,
    assetPolicy: source?.assetPolicy || 'owned',
    usageClass: source?.usageClass || icon.kind,
  };
}

function getTechnicalIcon(key) {
  const icon = byKey.get(String(key || '').trim());
  return icon ? publicIcon(icon) : null;
}

function resolveTechnicalIcon(value) {
  const key = aliases.get(normalize(value));
  return key ? getTechnicalIcon(key) : null;
}

function searchTechnicalIcons(query = '', provider = '') {
  const normalizedQuery = normalize(query);
  const normalizedProvider = normalize(provider);
  return registry.icons
    .filter((icon) => !normalizedProvider || normalize(icon.provider) === normalizedProvider)
    .map(publicIcon)
    .filter((icon) => {
      if (!normalizedQuery) return true;
      const haystack = normalize([icon.key, icon.product, icon.providerName, ...icon.aliases].join(' '));
      return haystack.includes(normalizedQuery);
    });
}

function validateTechnicalIconKey(key) {
  if (!key) return { valid: true, icon: null };
  const icon = getTechnicalIcon(key);
  return icon ? { valid: true, icon } : { valid: false, icon: null };
}

module.exports = {
  registryVersion: registry.version,
  verifiedAt: registry.verifiedAt,
  sources: registry.sources,
  getTechnicalIcon,
  resolveTechnicalIcon,
  searchTechnicalIcons,
  validateTechnicalIconKey,
};
