import { z } from "zod";
import { mistakeReportSchema, type MistakePattern } from "@/lib/mistake-patterns";

export const resolutionKey = (label: string) => label.normalize("NFKC").toLocaleLowerCase("de").replace(/[\p{P}\p{Z}\s]+/gu, " ").trim();
export const resolutionPatternSchema = mistakeReportSchema.shape.patterns.element.extend({ label: z.string().trim().min(3).max(100) });
export const resolutionSchema = z.object({
  key: z.string().min(1).max(100), pattern: resolutionPatternSchema,
  resolved: z.boolean(), updatedAt: z.string().datetime(),
});
export const resolutionsSchema = z.array(resolutionSchema).max(1000);
export type MistakeResolution = z.infer<typeof resolutionSchema>;

export function findResolution(pattern: MistakePattern, resolutions: MistakeResolution[]) {
  return resolutions.find((entry) => entry.key === (pattern.resolutionKey || resolutionKey(pattern.label)));
}

export function openMistakePatterns(patterns: MistakePattern[], resolutions: MistakeResolution[]) {
  return patterns.filter((pattern) => !findResolution(pattern, resolutions)?.resolved);
}

export function visibleMistakePatterns(patterns: MistakePattern[], resolutions: MistakeResolution[], includeReopened = true) {
  const open = openMistakePatterns(patterns, resolutions);
  if (!includeReopened) return open;
  // Preserve manually reopened problems even if the newest report no longer contains them.
  return [...open, ...resolutions.filter((entry) => !entry.resolved && !patterns.some((pattern) => findResolution(pattern, [entry])))
    .map((entry) => entry.pattern)];
}
