import type { GuideDocument, StepGraph } from './schema';

function escapeInline(value: string): string {
  return value.replaceAll('\r', ' ').replaceAll('\n', ' ').trim();
}

export function guideToMarkdown(graph: StepGraph, guide: GuideDocument): string {
  if (graph.revision.id !== guide.sourceRevisionId) {
    throw new Error('guide revision does not match step graph revision');
  }

  const stepById = new Map(graph.steps.map((step) => [step.id, step]));
  const lines: string[] = [
    `# Workflow ${escapeInline(graph.revision.workflowId)}`,
    '',
    `> Source revision: \`${graph.revision.id}\``,
    `> Capture: \`${graph.revision.captureId}\``,
    `> Review state: **${guide.reviewState}**`,
    '',
  ];

  guide.sections.forEach((section, index) => {
    const step = stepById.get(section.sourceStepId);
    if (!step) {
      throw new Error(`guide references missing step: ${section.sourceStepId}`);
    }

    lines.push(`## ${index + 1}. ${escapeInline(section.title)}`, '');
    lines.push(section.body.trim(), '');
    lines.push(
      `- Source step: \`${section.sourceStepId}\``,
      `- Source event: \`${step.sourceEventId}\``,
      `- Time range: ${step.atMs}–${step.endMs} ms`,
      `- Review state: **${section.reviewState}**`,
    );
    if (section.evidenceRefs.length > 0) {
      lines.push(`- Evidence: ${section.evidenceRefs.map((ref) => `\`${ref}\``).join(', ')}`);
    }
    lines.push('');
  });

  return `${lines.join('\n').trim()}\n`;
}
