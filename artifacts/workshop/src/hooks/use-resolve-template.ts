import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { getNotes, getGetNotesQueryKey } from "@workspace/api-client-react";
import { useLiveValues } from "./use-live-values";

// Matches {{sectionId:fieldKey}} — sectionId has no colon/whitespace/braces,
// fieldKey is anything up to the closing braces.
const PLACEHOLDER_RE = /\{\{\s*([^:{}\s]+)\s*:\s*([^{}]*?)\s*\}\}/g;

function extractSectionIds(text: string): string[] {
  const ids = new Set<string>();
  for (const m of text.matchAll(PLACEHOLDER_RE)) ids.add(m[1]);
  return [...ids];
}

/**
 * Resolves {{sectionId:fieldKey}} placeholders in admin-authored block text
 * to the current participant's own saved answers (notes) in the referenced
 * section/field. Unresolved or unsaved references become an empty string, so
 * raw {{...}} never reaches the screen. Uses the same GET /notes/:sectionId
 * read (and react-query cache) that fields already use for their own section.
 */
export function useResolveTemplate(text: string): string {
  const live = useLiveValues();
  const sectionIds = useMemo(() => extractSectionIds(text), [text]);

  const results = useQueries({
    queries: sectionIds.map((sectionId) => ({
      queryKey: getGetNotesQueryKey(sectionId),
      queryFn: () => getNotes(sectionId),
      staleTime: 0,
    })),
  });

  if (sectionIds.length === 0) return text;

  // The substitution is cheap; recompute on every render rather than
  // memoizing over a variable-length dependency list.
  const valueBySection = new Map<string, Map<string, string>>();
  sectionIds.forEach((id, i) => {
    const notes = results[i]?.data?.notes ?? [];
    valueBySection.set(
      id,
      new Map(notes.map((n) => [n.fieldKey, n.content ?? ""])),
    );
  });
  return text.replace(
    PLACEHOLDER_RE,
    (_all, sectionId: string, fieldKey: string) => {
      // Prefer the participant's currently-typed value for a field in the
      // active section so the preview updates on every keystroke; fall back to
      // the saved answer (this section, or another referenced section).
      const liveVal = live?.values[fieldKey];
      if (liveVal !== undefined) return liveVal;
      return valueBySection.get(sectionId)?.get(fieldKey) ?? "";
    },
  );
}
