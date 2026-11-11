import type { GenericContentBlock, GenericPollQuestion } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, ArrowUp, ArrowDown, X } from "lucide-react";

// Admin editor for one poll block inside the generic section dialog.
// `hasResponses` is true when any participant (in any cohort) already
// answered this block; choice edits then show a warning but stay allowed.

export const POLL_CHOICES_WARNING =
  "Changing choices after people answer can make counts misleading.";

export function newPollQuestion(n: number): GenericPollQuestion {
  return {
    questionKey: `q${n}`,
    text: "",
    choiceType: "single",
    choices: ["", ""],
    allowComment: false,
    commentLabel: "",
  };
}

function move<T>(list: T[], from: number, dir: -1 | 1): T[] {
  const to = from + dir;
  if (to < 0 || to >= list.length) return list;
  const next = list.slice();
  [next[from], next[to]] = [next[to]!, next[from]!];
  return next;
}

export function PollBlockEditor({
  idx,
  block,
  hasResponses,
  onChange,
}: {
  idx: number;
  block: GenericContentBlock;
  hasResponses: boolean;
  onChange: (patch: Partial<GenericContentBlock>) => void;
}) {
  const questions: GenericPollQuestion[] = block.questions ?? [];
  const setQuestions = (qs: GenericPollQuestion[]) => onChange({ questions: qs });
  const updateQ = (qi: number, patch: Partial<GenericPollQuestion>) =>
    setQuestions(questions.map((q, i) => (i === qi ? { ...q, ...patch } : q)));

  return (
    <div className="space-y-3" data-testid={`poll-editor-${idx}`}>
      <div>
        <Label className="text-xs">Poll name (shown in Responses tab and on the Board)</Label>
        <Input
          value={block.pollName ?? ""}
          onChange={(e) => onChange({ pollName: e.target.value })}
          placeholder="e.g. Readiness check"
          data-testid={`input-poll-name-${idx}`}
        />
      </div>

      {hasResponses && (
        <div
          className="text-xs rounded-md border border-amber-300 bg-amber-50 text-amber-900 px-3 py-2"
          data-testid={`poll-responses-warning-${idx}`}
        >
          This poll already has responses. {POLL_CHOICES_WARNING}
        </div>
      )}

      <div className="space-y-2">
        {questions.map((q, qi) => (
          <div
            key={qi}
            className="border rounded-md p-2 space-y-2 bg-background"
            data-testid={`poll-question-${idx}-${qi}`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Question {qi + 1}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  disabled={qi === 0}
                  onClick={() => setQuestions(move(questions, qi, -1))}
                  data-testid={`button-poll-question-up-${idx}-${qi}`}
                >
                  <ArrowUp className="w-3 h-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  disabled={qi === questions.length - 1}
                  onClick={() => setQuestions(move(questions, qi, 1))}
                  data-testid={`button-poll-question-down-${idx}-${qi}`}
                >
                  <ArrowDown className="w-3 h-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  disabled={questions.length <= 1}
                  onClick={() => setQuestions(questions.filter((_, i) => i !== qi))}
                  data-testid={`button-poll-question-remove-${idx}-${qi}`}
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-[1fr_auto] gap-2">
              <div>
                <Label className="text-xs">Question text</Label>
                <Input
                  value={q.text}
                  onChange={(e) => updateQ(qi, { text: e.target.value })}
                  placeholder="How ready do you feel?"
                  data-testid={`input-poll-question-text-${idx}-${qi}`}
                />
              </div>
              <div>
                <Label className="text-xs">Answers</Label>
                <Select
                  value={q.choiceType}
                  onValueChange={(v) => updateQ(qi, { choiceType: v as "single" | "multiple" })}
                >
                  <SelectTrigger
                    className="w-[150px]"
                    data-testid={`select-poll-choice-type-${idx}-${qi}`}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single">Pick one</SelectItem>
                    <SelectItem value="multiple">Pick many</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs">Key (stable id for stored answers)</Label>
              <Input
                value={q.questionKey}
                onChange={(e) => updateQ(qi, { questionKey: e.target.value })}
                className="font-mono text-xs"
                data-testid={`input-poll-question-key-${idx}-${qi}`}
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Choices (at least 2)</Label>
              {q.choices.map((c, ci) => (
                <div key={ci} className="flex items-center gap-1">
                  <Input
                    value={c}
                    onChange={(e) =>
                      updateQ(qi, {
                        choices: q.choices.map((x, i) => (i === ci ? e.target.value : x)),
                      })
                    }
                    placeholder={`Choice ${ci + 1}`}
                    data-testid={`input-poll-choice-${idx}-${qi}-${ci}`}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    disabled={ci === 0}
                    onClick={() => updateQ(qi, { choices: move(q.choices, ci, -1) })}
                    data-testid={`button-poll-choice-up-${idx}-${qi}-${ci}`}
                  >
                    <ArrowUp className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    disabled={ci === q.choices.length - 1}
                    onClick={() => updateQ(qi, { choices: move(q.choices, ci, 1) })}
                    data-testid={`button-poll-choice-down-${idx}-${qi}-${ci}`}
                  >
                    <ArrowDown className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    disabled={q.choices.length <= 2}
                    onClick={() => updateQ(qi, { choices: q.choices.filter((_, i) => i !== ci) })}
                    data-testid={`button-poll-choice-remove-${idx}-${qi}-${ci}`}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() => updateQ(qi, { choices: [...q.choices, ""] })}
                data-testid={`button-poll-choice-add-${idx}-${qi}`}
              >
                <Plus className="w-3 h-3 mr-1" /> Add choice
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Switch
                  checked={q.allowComment ?? false}
                  onCheckedChange={(v) => updateQ(qi, { allowComment: v })}
                  data-testid={`switch-poll-comment-${idx}-${qi}`}
                />
                <Label className="text-xs">Comment box</Label>
              </div>
              {(q.allowComment ?? false) && (
                <Input
                  value={q.commentLabel ?? ""}
                  onChange={(e) => updateQ(qi, { commentLabel: e.target.value })}
                  placeholder="Comment label, e.g. What's blocking you?"
                  className="flex-1 min-w-[200px]"
                  data-testid={`input-poll-comment-label-${idx}-${qi}`}
                />
              )}
            </div>
          </div>
        ))}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setQuestions([...questions, newPollQuestion(questions.length + 1)])}
          data-testid={`button-poll-question-add-${idx}`}
        >
          <Plus className="w-3 h-3 mr-1" /> Add question
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end">
        <div>
          <Label className="text-xs">Button label</Label>
          <Input
            value={block.buttonLabel ?? ""}
            onChange={(e) => onChange({ buttonLabel: e.target.value })}
            placeholder="Submit"
            data-testid={`input-poll-button-label-${idx}`}
          />
        </div>
        <div className="flex items-center gap-2 pb-2">
          <Switch
            checked={block.responsesOpen ?? true}
            onCheckedChange={(v) => onChange({ responsesOpen: v })}
            data-testid={`switch-poll-open-${idx}`}
          />
          <Label className="text-xs">Submissions open</Label>
        </div>
        <div className="flex items-center gap-2 pb-2">
          <Switch
            checked={block.showResults ?? false}
            onCheckedChange={(v) => onChange({ showResults: v })}
            data-testid={`switch-poll-show-results-${idx}`}
          />
          <Label className="text-xs">Show results to participants</Label>
        </div>
      </div>
    </div>
  );
}
