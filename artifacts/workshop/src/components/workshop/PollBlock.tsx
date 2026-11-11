import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useSubmitPollResponse,
  useListMyPollSubmissions,
  getListMyPollSubmissionsQueryKey,
  useGetPollResults,
  getGetPollResultsQueryKey,
  type GenericPollQuestion,
  type PollAnswers,
  type MyPollSubmissionsResponse,
} from "@workspace/api-client-react";
import { Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// Participant view of a poll block: radios / checkboxes per question, an
// optional comment box, one Submit for the whole block with the same states
// as form submits. Last submitted answers come from GET /poll-responses/mine
// so they're pre-selected after a reload. With showResults on, per-choice
// counts and bars appear after the participant has submitted — counts only,
// never other participants' names or comments.

const formatSubmittedAt = (iso: string | null | undefined) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
};

type Draft = Record<string, { choices: string[]; comment: string }>;

function draftFromAnswers(questions: GenericPollQuestion[], answers?: PollAnswers): Draft {
  const out: Draft = {};
  for (const q of questions) {
    const a = answers?.[q.questionKey];
    out[q.questionKey] = {
      choices: (a?.choices ?? []).filter((c) => q.choices.includes(c)),
      comment: a?.comment ?? "",
    };
  }
  return out;
}

export function PollBlock({
  sectionId,
  blockIndex,
  pollName,
  questions,
  buttonLabel,
  responsesOpen,
  showResults,
}: {
  sectionId: string;
  blockIndex: number;
  pollName?: string;
  questions: GenericPollQuestion[];
  buttonLabel: string;
  responsesOpen: boolean;
  showResults: boolean;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const submit = useSubmitPollResponse();
  const mineKey = getListMyPollSubmissionsQueryKey();
  const { data: mine } = useListMyPollSubmissions({
    query: { queryKey: mineKey, staleTime: 60_000 },
  });
  const existing = mine?.submissions.find(
    (r) => r.sectionId === sectionId && r.blockIndex === blockIndex,
  );
  const hasSubmitted = Boolean(existing);

  const [draft, setDraft] = useState<Draft>(() => draftFromAnswers(questions));
  const [missingKey, setMissingKey] = useState<string | null>(null);
  // Pre-select the last submitted answers once they arrive (and only then,
  // so in-progress edits aren't clobbered by the 2s poll of other queries).
  const existingSig = existing ? JSON.stringify(existing.answers) : "";
  useEffect(() => {
    if (existing) setDraft(draftFromAnswers(questions, existing.answers));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingSig]);

  const resultsParams = { sectionId, blockIndex };
  const resultsKey = getGetPollResultsQueryKey(resultsParams);
  const resultsQ = useGetPollResults(resultsParams, {
    query: {
      queryKey: resultsKey,
      enabled: showResults && hasSubmitted,
      refetchInterval: showResults && hasSubmitted ? 5000 : false,
    },
  });

  const toggle = (q: GenericPollQuestion, choice: string) => {
    setMissingKey(null);
    setDraft((d) => {
      const cur = d[q.questionKey] ?? { choices: [], comment: "" };
      let choices: string[];
      if (q.choiceType === "single") {
        choices = [choice];
      } else {
        choices = cur.choices.includes(choice)
          ? cur.choices.filter((c) => c !== choice)
          : [...cur.choices, choice];
      }
      return { ...d, [q.questionKey]: { ...cur, choices } };
    });
  };

  const handleSubmit = () => {
    if (!responsesOpen || submit.isPending) return;
    const unanswered = questions.find((q) => (draft[q.questionKey]?.choices.length ?? 0) === 0);
    if (unanswered) {
      setMissingKey(unanswered.questionKey);
      toast({
        title: "Please answer every question",
        description: `Missing: ${unanswered.text.trim() || `Question ${questions.indexOf(unanswered) + 1}`}`,
        variant: "destructive",
      });
      return;
    }
    const answers: PollAnswers = {};
    for (const q of questions) {
      const d = draft[q.questionKey]!;
      const comment = q.allowComment ? d.comment.trim() : "";
      answers[q.questionKey] = comment ? { choices: d.choices, comment } : { choices: d.choices };
    }
    submit.mutate(
      { data: { sectionId, blockIndex, answers } },
      {
        onSuccess: (res) => {
          const saved = res.response;
          queryClient.setQueryData(mineKey, (prev: MyPollSubmissionsResponse | undefined) => {
            const rest = (prev?.submissions ?? []).filter(
              (r) => !(r.sectionId === sectionId && r.blockIndex === blockIndex),
            );
            return {
              submissions: [
                ...rest,
                { sectionId, blockIndex, answers: saved.answers, updatedAt: saved.updatedAt },
              ],
            };
          });
          if (showResults) void queryClient.invalidateQueries({ queryKey: resultsKey });
        },
        onError: (err) => {
          const msg =
            (err as { data?: { error?: string } })?.data?.error ??
            "Could not submit. Please try again.";
          toast({ title: "Submit failed", description: msg, variant: "destructive" });
        },
      },
    );
  };

  const label = !responsesOpen
    ? "Submissions closed"
    : submit.isPending
      ? "Submitting…"
      : hasSubmitted
        ? "Update submission"
        : buttonLabel.trim() || "Submit";
  const time = formatSubmittedAt(existing?.updatedAt);

  const countsByKey = useMemo(() => {
    const m = new Map<string, { counts: Array<{ choice: string; count: number }> }>();
    for (const q of resultsQ.data?.questions ?? []) m.set(q.questionKey, q);
    return m;
  }, [resultsQ.data]);
  const total = resultsQ.data?.total ?? 0;
  const resultsVisible = showResults && hasSubmitted && resultsQ.data != null;

  return (
    <div
      className="my-6 border rounded-lg p-5 bg-card space-y-5"
      data-testid={`poll-${sectionId}-${blockIndex}`}
    >
      {pollName?.trim() && (
        <div className="text-[10px] font-bold uppercase tracking-widest text-primary/70">
          {pollName}
        </div>
      )}
      {questions.map((q, qi) => {
        const d = draft[q.questionKey] ?? { choices: [], comment: "" };
        const missing = missingKey === q.questionKey;
        const result = countsByKey.get(q.questionKey);
        const inputName = `poll-${sectionId}-${blockIndex}-${q.questionKey}`;
        return (
          <fieldset
            key={q.questionKey}
            className={cn("space-y-2", missing && "rounded-md ring-2 ring-destructive/60 p-2 -m-2")}
            data-testid={`poll-question-${sectionId}-${blockIndex}-${qi}`}
          >
            <legend className="font-semibold text-sm text-foreground">
              {q.text}
              {q.choiceType === "multiple" && (
                <span className="ml-2 text-xs font-normal text-muted-foreground">(pick all that apply)</span>
              )}
            </legend>
            {missing && (
              <p className="text-xs text-destructive" data-testid={`poll-missing-${sectionId}-${blockIndex}-${qi}`}>
                Please answer this question.
              </p>
            )}
            <div className="space-y-1.5">
              {q.choices.map((choice, ci) => {
                const checked = d.choices.includes(choice);
                const count = result?.counts.find((c) => c.choice === choice)?.count ?? 0;
                const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                return (
                  <div key={ci} className="space-y-1">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type={q.choiceType === "single" ? "radio" : "checkbox"}
                        name={inputName}
                        checked={checked}
                        onChange={() => toggle(q, choice)}
                        className="accent-primary w-4 h-4"
                        data-testid={`poll-choice-${sectionId}-${blockIndex}-${qi}-${ci}`}
                      />
                      <span className="flex-1">{choice}</span>
                      {resultsVisible && (
                        <span
                          className="text-xs text-muted-foreground tabular-nums"
                          data-testid={`poll-count-${sectionId}-${blockIndex}-${qi}-${ci}`}
                        >
                          {count}
                        </span>
                      )}
                    </label>
                    {resultsVisible && (
                      <div className="ml-6 h-1.5 rounded bg-muted overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {q.allowComment && (
              <div className="pt-1">
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  {q.commentLabel?.trim() || "Comment (optional)"}
                </label>
                <textarea
                  value={d.comment}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      [q.questionKey]: { ...(prev[q.questionKey] ?? { choices: [] }), comment: e.target.value },
                    }))
                  }
                  rows={2}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  data-testid={`poll-comment-${sectionId}-${blockIndex}-${qi}`}
                />
              </div>
            )}
          </fieldset>
        );
      })}

      <div className="flex flex-wrap items-center gap-3">
        {hasSubmitted && (
          <span
            className="inline-flex items-center gap-1 text-xs font-semibold text-green-700"
            data-testid={`poll-submitted-status-${sectionId}-${blockIndex}`}
          >
            <Check className="w-3.5 h-3.5" />
            Submitted{time ? ` ${time}` : ""}
          </span>
        )}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!responsesOpen || submit.isPending}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded text-xs font-bold transition-colors bg-primary text-white hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          data-testid={`poll-submit-${sectionId}-${blockIndex}`}
        >
          {label}
        </button>
        {resultsVisible && (
          <span className="text-xs text-muted-foreground" data-testid={`poll-total-${sectionId}-${blockIndex}`}>
            {total} response{total === 1 ? "" : "s"}
          </span>
        )}
      </div>
    </div>
  );
}
