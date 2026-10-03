export type VisualBeat = {
  id: string;
  sentence: string;
  query: string;
  provider: 'wikimedia' | 'search';
  imageUrl?: string;
  sourceUrl: string;
  attribution?: string;
};

const STOP_WORDS = new Set([
  'about','after','again','also','and','are','because','been','before','being','but','can','could','does','for','from','have','here','into','just','more','most','not','now','only','our','out','over','really','should','than','that','the','their','them','then','there','these','they','this','those','through','today','too','use','very','what','when','where','which','while','who','why','with','would','your','you',
]);

function sentences(script: string) {
  const compact = script.replace(/\s+/g, ' ').trim();
  if (!compact) return [];
  const parts = compact.match(/[^.!?]+[.!?]?/g) ?? [compact];
  return parts.map((part) => part.trim()).filter(Boolean).slice(0, 5);
}

function queryFor(sentence: string) {
  const words = sentence
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word));
  const unique = [...new Set(words)];
  return (unique.slice(0, 6).join(' ') || 'technology abstract').slice(0, 120);
}

async function commonsCandidate(query: string): Promise<Omit<VisualBeat, 'id' | 'sentence' | 'query'> | null> {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    origin: '*',
    generator: 'search',
    gsrsearch: query,
    gsrnamespace: '6',
    gsrlimit: '1',
    prop: 'imageinfo',
    iiprop: 'url|mime|extmetadata',
    iiurlwidth: '900',
  });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2500);
  try {
    const response = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`, {
      signal: controller.signal,
      headers: { 'User-Agent': 'FacelessStudio/1.0 (+https://github.com/rrahul0904/faceless-content-creator)' },
      cache: 'no-store',
    });
    if (!response.ok) return null;
    const data = await response.json() as {
      query?: { pages?: Record<string, { pageid?: number; title?: string; imageinfo?: Array<{ thumburl?: string; url?: string; mime?: string; extmetadata?: Record<string, { value?: string }> }> }> };
    };
    const page = Object.values(data.query?.pages ?? {})[0];
    const image = page?.imageinfo?.[0];
    const imageUrl = image?.thumburl ?? image?.url;
    if (!page || !imageUrl || !image?.mime?.startsWith('image/')) return null;
    const attribution = image.extmetadata?.Artist?.value?.replace(/<[^>]+>/g, '').trim();
    return {
      provider: 'wikimedia',
      imageUrl,
      sourceUrl: `https://commons.wikimedia.org/?curid=${page.pageid ?? ''}`,
      attribution: attribution || page.title,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function discoverVisuals(script: string): Promise<VisualBeat[]> {
  const beats = sentences(script);
  return Promise.all(beats.map(async (sentence, index) => {
    const query = queryFor(sentence);
    const found = await commonsCandidate(query);
    return {
      id: `beat-${index + 1}`,
      sentence,
      query,
      ...(found ?? {
        provider: 'search' as const,
        sourceUrl: `https://commons.wikimedia.org/w/index.php?search=${encodeURIComponent(query)}&title=Special:MediaSearch&type=image`,
      }),
    };
  }));
}
