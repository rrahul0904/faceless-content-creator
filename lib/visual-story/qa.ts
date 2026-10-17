import { getTechnicalIcon } from './icons';
import type { VisualStorySpec } from './schema';

type QaCheck = {
  id: string;
  pass: boolean;
  value?: number | string;
  threshold?: number | string;
  message: string;
};

export type VisualStoryQaProfile = 'standard' | 'carousel-focus';

export type VisualStoryQaReceipt = {
  version: '1.0';
  profile: VisualStoryQaProfile;
  status: 'PASS' | 'FAIL';
  score: number;
  checks: QaCheck[];
  certifiedAt: string;
};

function rgb(hex: string) {
  const value = hex.replace('#', '');
  return [0, 2, 4].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16));
}

function luminance(hex: string) {
  const channels = rgb(hex).map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(foreground: string, background: string) {
  const a = luminance(foreground);
  const b = luminance(background);
  const light = Math.max(a, b);
  const dark = Math.min(a, b);
  return (light + 0.05) / (dark + 0.05);
}

function estimatedOccupancy(spec: VisualStorySpec) {
  const header = Math.min(320, 130 + Math.ceil(spec.title.length / 32) * 58 + (spec.subtitle ? 52 : 0));
  const footer = 90;
  const contentHeight = Math.max(0, spec.height - header - footer);
  const rowCount = spec.format === 'comparison' || spec.format === 'stats'
    ? Math.ceil(spec.items.length / 2)
    : spec.items.length;
  const estimatedCardHeight = Math.min(170, Math.max(110, contentHeight / Math.max(rowCount, 1) - 24));
  const used = Math.min(spec.height, header + footer + rowCount * estimatedCardHeight + Math.max(0, rowCount - 1) * 24);
  return used / spec.height;
}

export function certifyVisualStory(
  spec: VisualStorySpec,
  options: { profile?: VisualStoryQaProfile } = {},
): VisualStoryQaReceipt {
  const profile = options.profile ?? 'standard';
  const contrast = contrastRatio(spec.brand.foreground, spec.brand.background);
  const occupancy = estimatedOccupancy(spec);
  const occupancyFloor = profile === 'carousel-focus' ? 0.38 : 0.72;
  const occupancyCeiling = profile === 'carousel-focus' ? 0.92 : 0.96;
  const longestLabel = Math.max(...spec.items.map((item) => item.label.length));
  const longestDetail = Math.max(...spec.items.map((item) => item.detail.length));
  const iconItems = spec.items.filter((item) => item.iconKey);
  const resolvedIcons = iconItems.map((item) => getTechnicalIcon(item.iconKey));
  const unknownIcons = iconItems.filter((_, index) => !resolvedIcons[index]);
  const officialAssets = resolvedIcons.filter((icon) => icon?.assetInstalled).length;
  const fallbackAssets = resolvedIcons.filter((icon) => icon && !icon.assetInstalled).length;
  const checks: QaCheck[] = [
    {
      id: 'source-provenance',
      pass: spec.provenance.claimsPolicy === 'source-only' && spec.sourcePrompt.trim().length > 0,
      message: 'The visual retains the source prompt and source-only claims policy.',
    },
    {
      id: 'item-density',
      pass: spec.items.length >= 1 && spec.items.length <= 8,
      value: spec.items.length,
      threshold: '1-8',
      message: 'The story stays within the feed-scale density budget.',
    },
    {
      id: 'contrast',
      pass: contrast >= 4.5,
      value: Number(contrast.toFixed(2)),
      threshold: 4.5,
      message: 'Foreground/background contrast meets the normal-text quality floor.',
    },
    {
      id: 'occupancy',
      pass: occupancy >= occupancyFloor && occupancy <= occupancyCeiling,
      value: Number(occupancy.toFixed(3)),
      threshold: `${occupancyFloor}-${occupancyCeiling}`,
      message: profile === 'carousel-focus'
        ? 'Carousel focus composition permits intentional whitespace while rejecting an effectively empty artboard.'
        : 'Estimated vertical occupancy avoids both dead zones and overcrowding.',
    },
    {
      id: 'label-length',
      pass: longestLabel <= 96,
      value: longestLabel,
      threshold: 96,
      message: 'Card labels remain readable at feed scale.',
    },
    {
      id: 'detail-length',
      pass: longestDetail <= 220,
      value: longestDetail,
      threshold: 220,
      message: 'Supporting detail stays inside the visual copy budget.',
    },
    {
      id: 'semantic-motion',
      pass: ['flow', 'build', 'pulse'].includes(spec.motion),
      value: spec.motion,
      message: 'Motion is tied to a supported semantic pattern.',
    },
    {
      id: 'technical-icon-registry',
      pass: unknownIcons.length === 0,
      value: iconItems.length ? `${resolvedIcons.length - unknownIcons.length}/${iconItems.length} known · ${officialAssets} official · ${fallbackAssets} fallback` : 'none',
      threshold: 'all iconKey values registered',
      message: unknownIcons.length
        ? `Unknown technical icon keys: ${unknownIcons.map((item) => item.iconKey).join(', ')}`
        : 'Technical icon references resolve through the governed registry; fallback mode is explicit when an official asset is not installed.',
    },
  ];

  const passed = checks.filter((check) => check.pass).length;
  return {
    version: '1.0',
    profile,
    status: passed === checks.length ? 'PASS' : 'FAIL',
    score: Math.round((passed / checks.length) * 100),
    checks,
    certifiedAt: new Date().toISOString(),
  };
}
