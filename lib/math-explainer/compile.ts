import type { ExplainerScene, MathClaim, MathExplainerDraft } from './schema';

export type MathExplainerCompileErrorCode =
  | 'UNKNOWN_CLAIM'
  | 'UNKNOWN_SCENE'
  | 'CHAPTER_MISMATCH'
  | 'UNCOVERED_CLAIM'
  | 'CRITICAL_CLAIM_UNVERIFIED'
  | 'EXPLAIN_NOT_ASSERT'
  | 'CONTRAST_REQUIRED'
  | 'DURATION_BUDGET_EXCEEDED'
  | 'EDITABILITY_REQUIRED';

export class MathExplainerCompileError extends Error {
  readonly code: MathExplainerCompileErrorCode;
  readonly subjectId?: string;

  constructor(code: MathExplainerCompileErrorCode, message: string, subjectId?: string) {
    super(message);
    this.name = 'MathExplainerCompileError';
    this.code = code;
    this.subjectId = subjectId;
  }
}

const SUPPORT_ROLES = new Set<ExplainerScene['role']>(['derive', 'demonstrate', 'contrast']);

function fail(code: MathExplainerCompileErrorCode, message: string, subjectId?: string): never {
  throw new MathExplainerCompileError(code, message, subjectId);
}

function supportBeforeConclusion(claim: MathClaim, scenes: ExplainerScene[]) {
  const references = scenes
    .map((scene, index) => ({ scene, index }))
    .filter(({ scene }) => scene.claimIds.includes(claim.id));

  const conclusion = references.find(({ scene }) => scene.role === 'conclude');
  if (!conclusion) {
    fail('EXPLAIN_NOT_ASSERT', `Critical claim '${claim.id}' has no conclusion scene`, claim.id);
  }

  const support = references.filter(({ scene, index }) => SUPPORT_ROLES.has(scene.role) && index < conclusion.index);
  if (!support.length) {
    fail(
      'EXPLAIN_NOT_ASSERT',
      `Critical claim '${claim.id}' is concluded before any derivation, demonstration, or contrast scene`,
      claim.id,
    );
  }

  if (claim.requiresContrast && !support.some(({ scene }) => scene.role === 'contrast')) {
    fail('CONTRAST_REQUIRED', `Claim '${claim.id}' requires a contrast/misconception scene`, claim.id);
  }

  return { conclusion, support };
}

export function compileMathExplainer(draft: MathExplainerDraft) {
  const claimById = new Map(draft.claims.map((claim) => [claim.id, claim]));
  const sceneById = new Map(draft.scenes.map((scene) => [scene.id, scene]));
  const chapterById = new Map(draft.chapters.map((chapter) => [chapter.id, chapter]));

  for (const scene of draft.scenes) {
    if (!scene.editable) {
      fail('EDITABILITY_REQUIRED', `Scene '${scene.id}' must remain editable in the Phase A contract`, scene.id);
    }
    if (!chapterById.has(scene.chapterId)) {
      fail('CHAPTER_MISMATCH', `Scene '${scene.id}' references unknown chapter '${scene.chapterId}'`, scene.id);
    }
    for (const claimId of scene.claimIds) {
      if (!claimById.has(claimId)) fail('UNKNOWN_CLAIM', `Scene '${scene.id}' references unknown claim '${claimId}'`, claimId);
    }
  }

  for (const chapter of draft.chapters) {
    for (const sceneId of chapter.sceneIds) {
      const scene = sceneById.get(sceneId);
      if (!scene) fail('UNKNOWN_SCENE', `Chapter '${chapter.id}' references unknown scene '${sceneId}'`, sceneId);
      if (scene.chapterId !== chapter.id) {
        fail('CHAPTER_MISMATCH', `Scene '${scene.id}' is listed in chapter '${chapter.id}' but belongs to '${scene.chapterId}'`, scene.id);
      }
    }
  }

  const referencedClaims = new Set(draft.scenes.flatMap((scene) => scene.claimIds));
  for (const claim of draft.claims) {
    if (!referencedClaims.has(claim.id)) {
      fail('UNCOVERED_CLAIM', `Claim '${claim.id}' is not taught by any scene`, claim.id);
    }
    if (claim.critical && !claim.verification) {
      fail('CRITICAL_CLAIM_UNVERIFIED', `Critical claim '${claim.id}' has no verification receipt`, claim.id);
    }
    if (claim.critical) supportBeforeConclusion(claim, draft.scenes);
  }

  const totalDurationSeconds = draft.scenes.reduce((sum, scene) => sum + scene.durationSeconds, 0);
  const toleranceSeconds = Math.max(10, Math.min(30, draft.targetDurationSeconds * 0.1));
  if (totalDurationSeconds > draft.targetDurationSeconds + toleranceSeconds) {
    fail(
      'DURATION_BUDGET_EXCEEDED',
      `Draft duration ${totalDurationSeconds}s exceeds target ${draft.targetDurationSeconds}s plus ${toleranceSeconds}s tolerance`,
    );
  }

  let cursor = 0;
  const sceneManifest = draft.scenes.map((scene, index) => {
    const start = cursor;
    const end = start + scene.durationSeconds;
    cursor = end;
    return {
      index,
      id: scene.id,
      chapterId: scene.chapterId,
      title: scene.title,
      role: scene.role,
      start,
      end,
      durationSeconds: scene.durationSeconds,
      claimIds: scene.claimIds,
      narration: scene.narration,
      visualIntents: scene.visualIntents,
      editable: true,
      renderUnit: scene.id,
      renderer: draft.renderer,
      revisionKey: `math-explainer/v1/${index}/${scene.id}`,
    };
  });

  const chapterMarkers = draft.chapters.map((chapter) => {
    const chapterScenes = chapter.sceneIds.map((id) => sceneManifest.find((scene) => scene.id === id)).filter(Boolean);
    return {
      id: chapter.id,
      title: chapter.title,
      start: chapterScenes.length ? Math.min(...chapterScenes.map((scene) => scene!.start)) : 0,
      end: chapterScenes.length ? Math.max(...chapterScenes.map((scene) => scene!.end)) : 0,
      sceneIds: chapter.sceneIds,
    };
  });

  const criticalClaims = draft.claims.filter((claim) => claim.critical);
  const contrastClaims = criticalClaims.filter((claim) => claim.requiresContrast);

  return {
    schemaVersion: 1 as const,
    renderer: draft.renderer,
    output: draft.output,
    question: draft.question,
    audience: draft.audience,
    targetDurationSeconds: draft.targetDurationSeconds,
    totalDurationSeconds,
    editable: true,
    sceneManifest,
    chapterMarkers,
    claimCoverage: {
      total: draft.claims.length,
      covered: referencedClaims.size,
      critical: criticalClaims.length,
      criticalVerified: criticalClaims.filter((claim) => Boolean(claim.verification)).length,
      contrastRequired: contrastClaims.length,
      contrastSatisfied: contrastClaims.filter((claim) =>
        draft.scenes.some((scene) => scene.role === 'contrast' && scene.claimIds.includes(claim.id)),
      ).length,
    },
    qualityGates: [
      { id: 'claim-coverage', passed: referencedClaims.size === draft.claims.length },
      { id: 'critical-verification', passed: criticalClaims.every((claim) => Boolean(claim.verification)) },
      { id: 'explain-not-assert', passed: true },
      { id: 'misconception-contrast', passed: contrastClaims.every((claim) =>
        draft.scenes.some((scene) => scene.role === 'contrast' && scene.claimIds.includes(claim.id))) },
      { id: 'duration-budget', passed: true },
      { id: 'scene-editability', passed: draft.scenes.every((scene) => scene.editable) },
    ],
    invalidationPolicy: {
      unit: 'scene',
      rerenderScope: 'changed-scenes-and-dependent-package',
      retainedEvidence: true,
      invalidatesOn: ['narration', 'visualIntents', 'claimIds', 'durationSeconds', 'role'],
    },
  };
}
