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

/** A piece of resolved template text: literal text, a filled-in linked
 * answer, or a linked answer that is still empty. */
export type TemplatePart =
  | { kind: "text"; text: string }
  | { kind: "answer"; text: string }
  // `raw` is the (blank) stored value, kept so prefill output is unchanged.
  | { kind: "empty"; sectionRef: string; fieldKey: string; raw: string };

/**
 * Splits admin-authored text into parts, resolving each
 * {{sectionId:fieldKey}} placeholder to the current participant's own saved
 * answer (notes) in the referenced section/field. Uses the same
 * GET /notes/:sectionId read (and react-query cache) that fields already use
 * for their own section.
 */
export function useResolveTemplateParts(text: string): TemplatePart[] {
  const live = useLiveValues();
  const sectionIds = useMemo(() => extractSectionIds(text), [text]);

  const results = useQueries({
    queries: sectionIds.map((sectionId) => ({
      queryKey: getGetNotesQueryKey(sectionId),
      queryFn: () => getNotes(sectionId),
      staleTime: 0,
    })),
  });

  if (sectionIds.length === 0) return text ? [{ kind: "text", text }] : [];

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

  const parts: TemplatePart[] = [];
  let last = 0;
  for (const m of text.matchAll(PLACEHOLDER_RE)) {
    const start = m.index ?? 0;
    if (start > last) parts.push({ kind: "text", text: text.slice(last, start) });
    last = start + m[0].length;
    const sectionId = m[1];
    const fieldKey = m[2];
    // Prefer the participant's currently-typed value for a field in the
    // active section so the preview updates on every keystroke; fall back to
    // the saved answer (this section, or another referenced section).
    const liveVal = live?.values[fieldKey];
    const value =
      liveVal !== undefined
        ? liveVal
        : (valueBySection.get(sectionId)?.get(fieldKey) ?? "");
    if (value.trim() === "") {
      parts.push({ kind: "empty", sectionRef: sectionId, fieldKey, raw: value });
    } else {
      parts.push({ kind: "answer", text: value });
    }
  }
  if (last < text.length) parts.push({ kind: "text", text: text.slice(last) });
  return parts;
}

/**
 * String form used for pre-filling form fields: unsaved references become an
 * empty string, so raw {{...}} never reaches the screen and no placeholder
 * text can ever be saved as a participant's answer.
 */
export function useResolveTemplate(text: string): string {
  const parts = useResolveTemplateParts(text);
  if (!text) return text;
  return parts.map((p) => (p.kind === "empty" ? p.raw : p.text)).join("");
}
