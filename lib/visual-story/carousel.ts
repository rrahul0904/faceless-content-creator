import { certifyVisualStory } from './qa';
import { VisualStorySpecSchema, type VisualStorySpec } from './schema';

export type VisualStoryCarouselSlide = {
  index: number;
  role: 'cover' | 'content';
  itemStart: number;
  itemEnd: number;
  spec: VisualStorySpec;
  qa: ReturnType<typeof certifyVisualStory>;
};

export type VisualStoryCarousel = {
  version: '1.0';
  sourceStoryId: string;
  sourceVersion?: number;
  slideCount: number;
  itemsPerSlide: number;
  slides: VisualStoryCarouselSlide[];
};

function clampItemsPerSlide(value: number | undefined) {
  if (!Number.isFinite(value)) return 2;
  return Math.max(1, Math.min(4, Math.trunc(value as number)));
}

function slideTitle(spec: VisualStorySpec, index: number, total: number) {
  if (index === 0) return spec.title;
  return `${spec.title} · ${index + 1}/${total}`.slice(0, 160);
}

export function compileVisualStoryCarousel(
  input: VisualStorySpec,
  options: { itemsPerSlide?: number; sourceVersion?: number } = {},
): VisualStoryCarousel {
  const source = VisualStorySpecSchema.parse(input);
  const itemsPerSlide = clampItemsPerSlide(options.itemsPerSlide);
  const groups: VisualStorySpec['items'][] = [];
  for (let offset = 0; offset < source.items.length; offset += itemsPerSlide) {
    groups.push(source.items.slice(offset, offset + itemsPerSlide));
  }

  const total = groups.length;
  const slides = groups.map((items, index) => {
    const itemStart = index * itemsPerSlide + 1;
    const itemEnd = itemStart + items.length - 1;
    const spec = VisualStorySpecSchema.parse({
      ...source,
      id: `${source.id}-slide-${index + 1}`.slice(0, 128),
      title: slideTitle(source, index, total),
      subtitle: index === 0 ? source.subtitle : `Items ${itemStart}-${itemEnd} of ${source.items.length}`,
      size: 'portrait',
      width: 1080,
      height: 1350,
      items,
    });
    return {
      index: index + 1,
      role: index === 0 ? 'cover' as const : 'content' as const,
      itemStart,
      itemEnd,
      spec,
      qa: certifyVisualStory(spec, { profile: 'carousel-focus' }),
    };
  });

  return {
    version: '1.0',
    sourceStoryId: source.id,
    ...(options.sourceVersion ? { sourceVersion: options.sourceVersion } : {}),
    slideCount: slides.length,
    itemsPerSlide,
    slides,
  };
}
