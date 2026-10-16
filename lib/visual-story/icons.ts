import registry from '@/creator-console/lib/technical-icons.json';

export type TechnicalIconKind = 'architecture-icon' | 'brand-mark' | 'owned-generic';

export type TechnicalIcon = {
  key: string;
  provider: string;
  providerName: string;
  product: string;
  kind: TechnicalIconKind;
  aliases: string[];
  fallbackLabel: string;
  assetPath: string | null;
  assetInstalled: boolean;
  assetMode: 'official' | 'fallback';
  officialSource: string | null;
  assetPolicy: string;
  usageClass: string;
};

function normalize(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9:/+.-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const sourceMap = registry.sources as Record<string, {
  provider: string;
  officialUrl: string | null;
  usageClass: string;
  assetPolicy: string;
}>;

const rawIcons = registry.icons as Array<{
  key: string;
  provider: string;
  product: string;
  kind: TechnicalIconKind;
  aliases: string[];
  fallbackLabel: string;
  assetPath: string | null;
}>;

const byKey = new Map(rawIcons.map((icon) => [icon.key, icon]));
const aliasMap = new Map<string, string>();
for (const icon of rawIcons) {
  for (const candidate of [icon.key, icon.product, ...(icon.aliases ?? [])]) {
    aliasMap.set(normalize(candidate), icon.key);
  }
}

function publicIcon(icon: (typeof rawIcons)[number]): TechnicalIcon {
  const source = sourceMap[icon.provider];
  return {
    ...icon,
    providerName: source?.provider ?? icon.provider,
    aliases: icon.aliases ?? [],
    assetInstalled: Boolean(icon.assetPath),
    assetMode: icon.assetPath ? 'official' : 'fallback',
    officialSource: source?.officialUrl ?? null,
    assetPolicy: source?.assetPolicy ?? 'owned',
    usageClass: source?.usageClass ?? icon.kind,
  };
}

export function getTechnicalIcon(key: string | null | undefined): TechnicalIcon | null {
  const icon = byKey.get(String(key ?? '').trim());
  return icon ? publicIcon(icon) : null;
}

export function resolveTechnicalIcon(value: string | null | undefined): TechnicalIcon | null {
  const key = aliasMap.get(normalize(String(value ?? '')));
  return key ? getTechnicalIcon(key) : null;
}

export function searchTechnicalIcons(query = '', provider = ''): TechnicalIcon[] {
  const normalizedQuery = normalize(query);
  const normalizedProvider = normalize(provider);
  return rawIcons
    .filter((icon) => !normalizedProvider || normalize(icon.provider) === normalizedProvider)
    .map(publicIcon)
    .filter((icon) => {
      if (!normalizedQuery) return true;
      const haystack = normalize([icon.key, icon.product, icon.providerName, ...icon.aliases].join(' '));
      return haystack.includes(normalizedQuery);
    });
}

export function technicalIconRegistryInfo() {
  return {
    version: registry.version,
    verifiedAt: registry.verifiedAt,
    sources: Object.fromEntries(Object.entries(sourceMap).map(([key, source]) => [key, {
      provider: source.provider,
      officialUrl: source.officialUrl,
      usageClass: source.usageClass,
      assetPolicy: source.assetPolicy,
    }])),
  };
}
