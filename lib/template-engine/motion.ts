import type { TemplateElement, TemplatePage } from './schema';

export type MotionTiming = {
  elementId: string;
  start: number;
  end?: number;
  enterDuration: number;
  exitDuration: number;
  dependency?: string;
};

export type MotionCompileResult = {
  timings: Record<string, MotionTiming>;
  order: string[];
  warnings: string[];
};

function durationForElement(element: TemplateElement) {
  const transition = element.transitions;
  const motion = element.motion;
  return Math.max(
    transition?.enterDuration ?? 0,
    motion?.reveal?.duration ?? 0,
    motion?.typewriter?.duration ?? 0,
    motion?.count?.duration ?? 0,
    motion?.wake?.duration ?? 0,
    0.01,
  );
}

function directStart(element: TemplateElement) {
  const transitionStart = element.transitions?.showAt ?? 0;
  const wakeOffset = element.motion?.wake?.offset ?? 0;
  const typeOffset = element.motion?.typewriter?.delay ?? 0;
  return Math.max(transitionStart, wakeOffset, typeOffset);
}

export function compileMotion(page: TemplatePage): MotionCompileResult {
  const byId = new Map(page.elements.map((element) => [element.id, element]));
  const timings: Record<string, MotionTiming> = {};
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const order: string[] = [];
  const warnings: string[] = [];

  function visit(id: string): MotionTiming {
    if (timings[id]) return timings[id];
    const element = byId.get(id);
    if (!element) {
      warnings.push(`Motion dependency references missing element '${id}'`);
      return { elementId: id, start: 0, enterDuration: 0, exitDuration: 0 };
    }
    if (visiting.has(id)) {
      throw new Error(`Motion dependency cycle detected at element '${id}'`);
    }
    visiting.add(id);

    let start = directStart(element);
    let dependency: string | undefined;
    const after = element.motion?.after;
    if (after?.element) {
      dependency = after.element;
      const predecessor = visit(after.element);
      start = Math.max(start, predecessor.start + predecessor.enterDuration + after.offset);
    }

    const hideAt = element.transitions?.hideAt;
    const timing: MotionTiming = {
      elementId: id,
      start,
      end: hideAt,
      enterDuration: durationForElement(element),
      exitDuration: element.transitions?.exitDuration ?? 0,
      dependency,
    };
    timings[id] = timing;
    visiting.delete(id);
    visited.add(id);
    order.push(id);
    return timing;
  }

  for (const element of page.elements) {
    if (!visited.has(element.id)) visit(element.id);
  }

  for (const [id, timing] of Object.entries(timings)) {
    if (timing.end !== undefined && timing.end < timing.start) {
      warnings.push(`Element '${id}' hides before its compiled start time`);
    }
  }

  return { timings, order, warnings };
}

export function validateTemplateMotion(pages: TemplatePage[]) {
  return pages.map((page) => ({ pageId: page.id, ...compileMotion(page) }));
}
