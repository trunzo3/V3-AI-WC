import { useState, useEffect, useRef, useCallback } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useUpsertNote, useGetNotes, getGetNotesQueryKey } from "@workspace/api-client-react";

const PREFIX = (import.meta as any).env?.BASE_URL?.replace(/\/$/, "") ?? "";

// Module-level cache: survives component unmount/remount during tab switches.
const pendingNotes = new Map<string, Map<string, string>>();

function setCached(sectionId: string, fieldKey: string, content: string) {
  if (!pendingNotes.has(sectionId)) pendingNotes.set(sectionId, new Map());
  pendingNotes.get(sectionId)!.set(fieldKey, content);
}

function getCached(sectionId: string, fieldKey: string): string | undefined {
  return pendingNotes.get(sectionId)?.get(fieldKey);
}

function clearCached(sectionId: string, fieldKey: string) {
  pendingNotes.get(sectionId)?.delete(fieldKey);
}

// Notes queries are keyed by the request path, which may be a numeric section
// id (/api/notes/generic_17) or a module slug (/api/notes/prompt-2) that maps
// to the same section server-side. A save can't know which aliases are in
// use, so invalidate every notes query — this keeps {{slug:fieldKey}}
// placeholder resolution (prompt blocks, prefills) live as the participant
// types in the same section.
function invalidateAllNotesQueries(queryClient: QueryClient) {
  void queryClient.invalidateQueries({
    predicate: (q) =>
      typeof q.queryKey[0] === "string" &&
      q.queryKey[0].startsWith("/api/notes/"),
  });
}

// keepalive: true ensures the request completes even if the page navigates
// away immediately. Resolves to whether the save actually succeeded so
// callers can skip cache invalidation after a failed save (invalidating then
// would refetch server state and could clobber unsaved local text).
function saveNoteDirectly(
  sectionId: string,
  fieldKey: string,
  content: string,
): Promise<boolean> {
  return fetch(`${PREFIX}/api/notes/${sectionId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    keepalive: true,
    body: JSON.stringify({ fieldKey, content }),
  })
    .then((res) => res.ok)
    .catch(() => false);
}

export function useAutoSave(sectionId: string, fieldKey: string, defaultValue: string = "") {
  const [value, setValue] = useState<string>(() => {
    return getCached(sectionId, fieldKey) ?? defaultValue;
  });

  const { mutate: saveNote } = useUpsertNote();
  const queryClient = useQueryClient();
  const queryClientRef = useRef(queryClient);
  useEffect(() => {
    queryClientRef.current = queryClient;
  }, [queryClient]);

  const lastSavedRef = useRef<string>("");
  const currentValueRef = useRef<string>(value);
  const initialized = useRef(false);
  const pendingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sectionIdRef = useRef(sectionId);
  const fieldKeyRef = useRef(fieldKey);
  useEffect(() => {
    sectionIdRef.current = sectionId;
    fieldKeyRef.current = fieldKey;
  }, [sectionId, fieldKey]);

  const { data: notesResp, isSuccess } = useGetNotes(sectionId, {
    query: {
      enabled: !!sectionId,
      queryKey: getGetNotesQueryKey(sectionId),
      refetchOnMount: true,
      staleTime: 0,
    },
  });

  useEffect(() => {
    if (!isSuccess) return;
    const notes = notesResp?.notes ?? [];
    const serverNote = notes.find((n) => n.fieldKey === fieldKey);
    const serverContent = serverNote ? serverNote.content : defaultValue;

    if (!initialized.current) {
      const localContent = getCached(sectionId, fieldKey);
      const initial = localContent ?? serverContent;
      setValue(initial);
      currentValueRef.current = initial;
      lastSavedRef.current = initial;
      initialized.current = true;
      if (localContent !== undefined && localContent === serverContent) {
        clearCached(sectionId, fieldKey);
      }
    } else {
      if (currentValueRef.current === lastSavedRef.current) {
        setValue(serverContent);
        currentValueRef.current = serverContent;
        lastSavedRef.current = serverContent;
        clearCached(sectionId, fieldKey);
      }
    }
  }, [isSuccess, notesResp, fieldKey, sectionId, defaultValue]);

  useEffect(() => {
    currentValueRef.current = value;
  }, [value]);

  // (a) Debounce: save 1.5s after last keystroke
  useEffect(() => {
    if (!initialized.current) return;
    if (value === lastSavedRef.current) return;
    if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
    pendingTimerRef.current = setTimeout(() => {
      saveNote(
        { sectionId, data: { fieldKey, content: value } },
        { onSuccess: () => invalidateAllNotesQueries(queryClientRef.current) },
      );
      lastSavedRef.current = value;
      clearCached(sectionId, fieldKey);
      pendingTimerRef.current = null;
    }, 1500);
    return () => {
      if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
    };
  }, [value, sectionId, fieldKey, saveNote]);

  // (c) Unmount: flush unsaved data via cache + keepalive fetch.
  useEffect(() => {
    return () => {
      if (!initialized.current) return;
      const curr = currentValueRef.current;
      if (curr === lastSavedRef.current) return;
      if (pendingTimerRef.current) {
        clearTimeout(pendingTimerRef.current);
        pendingTimerRef.current = null;
      }
      setCached(sectionIdRef.current, fieldKeyRef.current, curr);
      void saveNoteDirectly(sectionIdRef.current, fieldKeyRef.current, curr).then(
        (ok) => {
          if (ok) invalidateAllNotesQueries(queryClientRef.current);
        },
      );
      lastSavedRef.current = curr;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // (b) Blur: immediate save via keepalive fetch + update local cache
  const flushSave = useCallback(() => {
    if (!initialized.current) return;
    const curr = currentValueRef.current;
    if (curr === lastSavedRef.current) return;
    if (pendingTimerRef.current) {
      clearTimeout(pendingTimerRef.current);
      pendingTimerRef.current = null;
    }
    setCached(sectionIdRef.current, fieldKeyRef.current, curr);
    void saveNoteDirectly(sectionIdRef.current, fieldKeyRef.current, curr).then(
      (ok) => {
        if (ok) invalidateAllNotesQueries(queryClientRef.current);
      },
    );
    lastSavedRef.current = curr;
  }, []);

  return [value, setValue, flushSave] as const;
}
