import type {
  AdminPollResultsResponse,
  GenericPollQuestion,
  PollAnswers,
} from "@workspace/api-client-react";
import { cn } from "@/lib/utils";

// Counts per choice with a bar for each question. Shared by the admin
// Responses tab (compact) and the projector Board (large). Never renders
// names or comments.
export function PollCounts({
  results,
  size = "sm",
  testIdPrefix = "poll-counts",
}: {
  results: Pick<AdminPollResultsResponse, "total" | "questions">;
  size?: "sm" | "lg";
  testIdPrefix?: string;
}) {
  const total = results.total;
  const lg = size === "lg";
  return (
    <div className={cn("space-y-6", lg && "space-y-10")} data-testid={testIdPrefix}>
      {results.questions.map((q, qi) => (
        <div key={q.questionKey} className="space-y-2" data-testid={`${testIdPrefix}-question-${qi}`}>
          <div className={cn("font-semibold", lg ? "font-serif text-2xl md:text-3xl" : "text-sm")}>
            {q.text}
          </div>
          <div className={cn("space-y-1.5", lg && "space-y-3")}>
            {q.counts.map((c, ci) => {
              const pct = total > 0 ? Math.round((c.count / total) * 100) : 0;
              return (
                <div key={ci} className="space-y-1">
                  <div className={cn("flex items-baseline justify-between gap-3", lg ? "text-xl" : "text-sm")}>
                    <span className="min-w-0 truncate">{c.choice}</span>
                    <span
                      className={cn("tabular-nums font-semibold shrink-0", lg ? "text-2xl" : "text-sm")}
                      data-testid={`${testIdPrefix}-count-${qi}-${ci}`}
                    >
                      {c.count}
                      <span className={cn("text-muted-foreground font-normal ml-1", lg ? "text-base" : "text-xs")}>
                        {pct}%
                      </span>
                    </span>
                  </div>
                  <div className={cn("rounded bg-muted overflow-hidden", lg ? "h-4" : "h-2")}>
                    <div className="h-full bg-accent transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Plain-text rendering of one participant's answers (for Copy all). */
export function pollAnswersToText(questions: GenericPollQuestion[], answers: PollAnswers): string {
  return questions
    .map((q) => {
      const a = answers[q.questionKey];
      const choices = a?.choices?.length ? a.choices.join(", ") : "No answer";
      const comment = a?.comment?.trim();
      return `${q.text}: ${choices}${comment ? `\n  ${q.commentLabel?.trim() || "Comment"}: ${comment}` : ""}`;
    })
    .join("\n");
}
