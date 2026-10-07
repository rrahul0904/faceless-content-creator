import type {
  CostEstimate,
  CostEstimateRequest,
  CostLineItem,
  CostRateCard,
} from "./schema";

function finiteNonNegative(value: number | undefined, field: string): number | null {
  if (value === undefined) {
    return null;
  }
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${field} must be a finite non-negative number`);
  }
  return value;
}

function lineItem(
  operation: CostLineItem["operation"],
  units: number,
  unitLabel: CostLineItem["unitLabel"],
  rate: number | null,
): CostLineItem {
  return {
    operation,
    units,
    unitLabel,
    rate,
    estimatedCost: rate === null ? null : Number((units * rate).toFixed(6)),
  };
}

export function estimateWorkflowCost(request: CostEstimateRequest): CostEstimate {
  if (!Number.isFinite(request.durationMs) || request.durationMs < 0) {
    throw new Error("durationMs must be a finite non-negative number");
  }

  const rates: CostRateCard = request.rates ?? {};
  const durationMinutes = Number((request.durationMs / 60_000).toFixed(6));
  const languages = [...new Set(request.languages ?? [])]
    .map((language) => language.trim())
    .filter(Boolean)
    .sort();

  const lineItems: CostLineItem[] = [];
  if (request.includeVideo) {
    lineItems.push(
      lineItem(
        "ai-video",
        durationMinutes,
        "minute",
        finiteNonNegative(rates.aiVideoPerMinute, "rates.aiVideoPerMinute"),
      ),
    );
  }

  if (request.includeGuide) {
    lineItems.push(
      lineItem(
        "ai-document",
        1,
        "document",
        finiteNonNegative(rates.aiDocumentFlat, "rates.aiDocumentFlat"),
      ),
    );
  }

  if (languages.length > 0) {
    lineItems.push(
      lineItem(
        "translation",
        durationMinutes * languages.length,
        "minute",
        finiteNonNegative(rates.translationPerMinute, "rates.translationPerMinute"),
      ),
    );
  }

  if (request.includeAvatar) {
    lineItems.push(
      lineItem(
        "avatar",
        durationMinutes,
        "minute",
        finiteNonNegative(rates.avatarPerMinute, "rates.avatarPerMinute"),
      ),
    );
  }

  const hasUnknownRates = lineItems.some((item) => item.rate === null);
  const estimatedTotal = hasUnknownRates
    ? null
    : Number(
        lineItems
          .reduce((total, item) => total + (item.estimatedCost ?? 0), 0)
          .toFixed(6),
      );

  return {
    durationMinutes,
    languages,
    lineItems,
    estimatedTotal,
    hasUnknownRates,
  };
}
