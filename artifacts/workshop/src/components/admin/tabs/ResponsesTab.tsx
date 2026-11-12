import { useEffect, useMemo, useRef, useState } from "react";
import {
  useAdminListCohortFormResponses,
  getAdminListCohortFormResponsesQueryKey,
  useAdminListCohortSections,
  useAdminListGenericSections,
  useAdminGetCohortPollResults,
  getAdminGetCohortPollResultsQueryKey,
  useAdminListCohortNonResponders,
  getAdminListCohortNonRespondersQueryKey,
  useAdminGetCohort,
  getAdminGetCohortQueryKey,
  type AdminFormResponse,
  type AdminPollResponse,
  type GenericContentBlock,
  type GenericPollQuestion,
} from "@workspace/api-client-react";
import { PollCounts, pollAnswersToText } from "@/components/admin/PollResultsView";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Copy, Check, Presentation, Download } from "lucide-react";

interface Props {
  cohortId: number;
}

const ALL = "__all__";

interface CollectingForm {
  key: string; // `${sectionId}:${blockIndex}`
  sectionId: string;
  blockIndex: number;
  label: string;
  groupId: number | null;
  groupName: string;
  kind: "form" | "poll";
  // Poll only: the block's questions, for rendering answers.
  questions?: GenericPollQuestion[];
}

function fmt(d: string) {
  try {
    return new Date(d).toLocaleString();
  } catch {
    return d;
  }
}

// CSV helpers: RFC 4180 quoting (quote fields containing comma, quote or
// newline; double embedded quotes) and a UTF-8 BOM so Excel reads accents.
function csvField(v: string): string {
  return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}
function csvFrom(rows: string[][]): string {
  return "\uFEFF" + rows.map((r) => r.map(csvField).join(",")).join("\r\n") + "\r\n";
}
function safeFileName(s: string): string {
  return s.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "").replace(/\s+/g, " ").trim();
}
function downloadText(filename: string, text: string, type: string) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function fmtCsvDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  // e.g. "Nov 12, 2026 5:41 PM" in the admin's local time zone.
  const date = d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${date} ${time}`;
}
function localDateStamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const el = document.createElement("textarea");
    el.value = text;
    document.body.appendChild(el);
    el.select();
    document.execCommand("copy");
    document.body.removeChild(el);
  }
}

export function ResponsesTab({ cohortId }: Props) {
  const { toast } = useToast();
  const [filter, setFilter] = useState<string>(ALL);

  // Build the "collecting forms" filter list from generic sections attached
  // to this cohort that contain a form block with collectResponses on, or a
  // poll block. Course order: the API returns section rows sorted by group
  // order then section sortOrder, but we re-sort explicitly here so the
  // dropdown never depends on that; blocks keep their index order.
  const sectionsQ = useAdminListCohortSections(cohortId);
  const genericsQ = useAdminListGenericSections();
  const collectingForms = useMemo<CollectingForm[]>(() => {
    const generics = genericsQ.data?.sections ?? [];
    const groups = sectionsQ.data?.groups ?? [];
    const groupOrder = new Map(groups.map((g, i) => [g.id, i]));
    const groupName = new Map(groups.map((g) => [g.id, g.name]));
    const attached = [...(sectionsQ.data?.sections ?? [])].sort(
      (a, b) =>
        (groupOrder.get(a.groupId ?? -1) ?? 999) - (groupOrder.get(b.groupId ?? -1) ?? 999) ||
        a.sortOrder - b.sortOrder ||
        a.id - b.id,
    );
    const byId = new Map(generics.map((g) => [`generic_${g.id}`, g]));
    const out: CollectingForm[] = [];
    for (const s of attached) {
      const g = byId.get(s.sectionId);
      if (!g) continue;
      const blocks = (g.contentBlocks ?? []) as GenericContentBlock[];
      const gid = s.groupId ?? null;
      const gname = (gid != null ? groupName.get(gid) : undefined) ?? "Other";
      blocks.forEach((b, i) => {
        const sectionTitle = s.displayName?.trim() || g.title;
        if (b.type === "poll") {
          const name = b.pollName?.trim() || `Poll ${i + 1}`;
          out.push({
            key: `${s.sectionId}:${i}`,
            sectionId: s.sectionId,
            blockIndex: i,
            label: `${name} — ${sectionTitle}`,
            groupId: gid,
            groupName: gname,
            kind: "poll",
            questions: b.questions ?? [],
          });
          return;
        }
        if (b.type !== "form" || !b.collectResponses) return;
        const name = b.formName?.trim() || `Form ${i + 1}`;
        out.push({
          key: `${s.sectionId}:${i}`,
          sectionId: s.sectionId,
          blockIndex: i,
          label: `${name} — ${sectionTitle}`,
          groupId: gid,
          groupName: gname,
          kind: "form",
        });
      });
    }
    return out;
  }, [sectionsQ.data, genericsQ.data]);
  // Consecutive items with the same group become one labelled dropdown group.
  const groupedForms = useMemo(() => {
    const out: Array<{ groupId: number | null; groupName: string; items: CollectingForm[] }> = [];
    for (const f of collectingForms) {
      const last = out[out.length - 1];
      if (last && last.groupId === f.groupId) last.items.push(f);
      else out.push({ groupId: f.groupId, groupName: f.groupName, items: [f] });
    }
    return out;
  }, [collectingForms]);

  const selected = collectingForms.find((f) => f.key === filter);
  const isPoll = selected?.kind === "poll";
  const params =
    selected != null
      ? { sectionId: selected.sectionId, blockIndex: selected.blockIndex }
      : undefined;

  const responsesQ = useAdminListCohortFormResponses(cohortId, params, {
    query: {
      queryKey: getAdminListCohortFormResponsesQueryKey(cohortId, params),
      refetchInterval: 2000,
      enabled: !isPoll,
    },
  });
  const pollParams = params ?? { sectionId: "", blockIndex: 0 };
  const pollQ = useAdminGetCohortPollResults(cohortId, pollParams, {
    query: {
      queryKey: getAdminGetCohortPollResultsQueryKey(cohortId, pollParams),
      refetchInterval: 2000,
      enabled: isPoll,
    },
  });
  const pollResponses: AdminPollResponse[] = pollQ.data?.responses ?? [];
  const responses: AdminFormResponse[] = responsesQ.data?.responses ?? [];
  // "Hasn't answered": participants with no submission for the selected
  // block. Same 2s interval as the responses list so names drop off live.
  const nonParams = params ?? { sectionId: "", blockIndex: 0 };
  const nonRespondersQ = useAdminListCohortNonResponders(cohortId, nonParams, {
    query: {
      queryKey: getAdminListCohortNonRespondersQueryKey(cohortId, nonParams),
      refetchInterval: 2000,
      enabled: selected != null,
    },
  });
  const nonResponders = nonRespondersQ.data?.participants ?? [];
  const answered = nonRespondersQ.data?.answered ?? 0;
  const totalSignedIn = nonRespondersQ.data?.total ?? 0;
  const percent = totalSignedIn > 0 ? Math.round((answered / totalSignedIn) * 100) : 0;
  const cohortQ = useAdminGetCohort(cohortId, {
    query: { queryKey: getAdminGetCohortQueryKey(cohortId) },
  });

  const downloadCsv = () => {
    if (!selected || !isPoll || !pollQ.data) return;
    const questions = selected.questions ?? [];
    const header = ["Name", "Email", "Submitted"];
    for (const q of questions) {
      header.push(q.text);
      if (q.allowComment) header.push(q.commentLabel?.trim() || "Comment");
    }
    const rows = [...pollResponses]
      .sort((a, b) => a.participantName.localeCompare(b.participantName, undefined, { sensitivity: "base" }) || a.id - b.id)
      .map((r) => {
        const row = [r.participantName, r.participantEmail, fmtCsvDate(r.updatedAt)];
        for (const q of questions) {
          const a = r.answers[q.questionKey];
          row.push((a?.choices ?? []).join("; "));
          if (q.allowComment) row.push(a?.comment ?? "");
        }
        return row;
      });
    const cohortName = cohortQ.data?.cohort.name ?? `Cohort ${cohortId}`;
    const pollName = pollQ.data.pollName?.trim() || `Poll ${selected.blockIndex + 1}`;
    const filename = `${safeFileName(`${cohortName} - ${pollName} - ${localDateStamp()}`)}.csv`;
    downloadText(filename, csvFrom([header, ...rows]), "text/csv;charset=utf-8");
    toast({ title: `Downloaded ${rows.length} row${rows.length === 1 ? "" : "s"}` });
  };
  const copyNonResponders = async () => {
    await copyText(nonResponders.map((p) => `${p.name} <${p.email}>`).join("\n"));
    toast({ title: `Copied ${nonResponders.length} name${nonResponders.length === 1 ? "" : "s"}` });
  };

  // "New" badge: anything that arrived (or was resubmitted) after the tab
  // was opened. We snapshot what the first successful load returned — a map
  // of id -> updatedAt — and compare later polls against it. This avoids
  // relying on browser vs. server clock agreement. The snapshot resets when
  // the cohort changes.
  const baselineRef = useRef<Map<number, string> | null>(null);
  useEffect(() => {
    baselineRef.current = null;
  }, [cohortId]);
  const allResponsesQ = useAdminListCohortFormResponses(cohortId, undefined, {
    query: {
      queryKey: getAdminListCohortFormResponsesQueryKey(cohortId, undefined),
      refetchInterval: 2000,
    },
  });
  useEffect(() => {
    if (baselineRef.current == null && allResponsesQ.data) {
      baselineRef.current = new Map(
        allResponsesQ.data.responses.map((r) => [r.id, r.updatedAt]),
      );
    }
  }, [allResponsesQ.data]);
  const isNew = (r: AdminFormResponse) => {
    const base = baselineRef.current;
    if (base == null) return false;
    const seen = base.get(r.id);
    return seen == null || seen !== r.updatedAt;
  };
  // Same idea for the selected poll: baseline from its first load.
  const pollBaselineRef = useRef<{ key: string; seen: Map<number, string> } | null>(null);
  useEffect(() => {
    if (!isPoll || !pollQ.data || !selected) return;
    if (pollBaselineRef.current?.key !== selected.key) {
      pollBaselineRef.current = {
        key: selected.key,
        seen: new Map(pollQ.data.responses.map((r) => [r.id, r.updatedAt])),
      };
    }
  }, [isPoll, pollQ.data, selected]);
  const isNewPoll = (r: AdminPollResponse) => {
    const base = pollBaselineRef.current;
    if (base == null || base.key !== selected?.key) return false;
    const seen = base.seen.get(r.id);
    return seen == null || seen !== r.updatedAt;
  };

  const openBoard = () => {
    if (!selected) return;
    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    window.open(
      `${base}/admin/board/${cohortId}/${encodeURIComponent(selected.sectionId)}/${selected.blockIndex}`,
      "_blank",
      "noopener",
    );
  };

  const copyAll = async () => {
    const list = isPoll
      ? pollResponses.map(
          (r) => `${r.participantName}\n${pollAnswersToText(selected?.questions ?? [], r.answers)}`,
        )
      : responses.map((r) => `${r.participantName}\n${r.responseText}`);
    await copyText(list.join("\n\n"));
    toast({ title: `Copied ${list.length} submission${list.length === 1 ? "" : "s"}` });
  };

  return (
    <Card data-testid="responses-tab">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <CardTitle className="text-base">Responses</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Live stream of participant submissions from forms with "Collect
            responses" turned on, and from polls. Newest first; refreshes every few seconds.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[220px]">
            <Label className="text-xs">Form or poll</Label>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger data-testid="select-responses-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All forms</SelectItem>
                {groupedForms.map((grp, gi) => (
                  <SelectGroup key={`${grp.groupId ?? "none"}-${gi}`}>
                    <SelectLabel
                      className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
                      data-testid={`responses-filter-group-${grp.groupId ?? "none"}`}
                    >
                      {grp.groupName}
                    </SelectLabel>
                    {grp.items.map((f) => (
                      <SelectItem key={f.key} value={f.key} data-testid={`responses-filter-item-${f.key}`}>
                        {f.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={openBoard}
            disabled={!selected}
            title={selected ? "Open the projector board in a new tab" : "Select a form first"}
            data-testid="button-open-board"
          >
            <Presentation className="w-3.5 h-3.5 mr-1" /> Open board
          </Button>
          {isPoll && (
            <Button
              variant="outline"
              size="sm"
              onClick={downloadCsv}
              disabled={!pollQ.data || pollResponses.length === 0}
              data-testid="button-responses-download-csv"
            >
              <Download className="w-3.5 h-3.5 mr-1" /> Download CSV
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={copyAll}
            disabled={(isPoll ? pollResponses.length : responses.length) === 0}
            data-testid="button-responses-copy-all"
          >
            <Copy className="w-3.5 h-3.5 mr-1" /> Copy all
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {selected && (
          <div className="border rounded-lg p-4 bg-card" data-testid="response-rate-panel">
            {nonRespondersQ.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : totalSignedIn === 0 ? (
              <p className="text-sm text-muted-foreground" data-testid="response-rate-empty">
                No one has signed in to this cohort yet.
              </p>
            ) : (
              <>
                <div className="flex items-baseline justify-between gap-4">
                  <span className="text-2xl font-semibold tabular-nums" data-testid="response-rate-text">
                    {answered} of {totalSignedIn} answered
                  </span>
                  <span className="text-2xl font-semibold tabular-nums text-primary" data-testid="response-rate-percent">
                    {percent}%
                  </span>
                </div>
                <div className="mt-2 h-2.5 rounded bg-muted overflow-hidden">
                  <div
                    className="h-full bg-accent transition-all"
                    style={{ width: `${percent}%` }}
                    data-testid="response-rate-bar"
                  />
                </div>
              </>
            )}
            <p className="text-xs text-muted-foreground mt-2">
              Counted against the {totalSignedIn} people who have signed in to this cohort. Updates as people submit.
            </p>
          </div>
        )}
        {selected && (
          <div className="border rounded-lg p-4 bg-muted/30" data-testid="non-responders-panel">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="font-semibold text-sm" data-testid="non-responders-heading">
                  Hasn't answered ({nonResponders.length})
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Only lists people who have signed in to the Companion.
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={copyNonResponders}
                disabled={nonResponders.length === 0}
                data-testid="button-non-responders-copy"
              >
                <Copy className="w-3.5 h-3.5 mr-1" /> Copy
              </Button>
            </div>
            {nonRespondersQ.isLoading ? (
              <p className="text-xs text-muted-foreground mt-2">Loading…</p>
            ) : nonResponders.length === 0 ? (
              <p className="text-xs text-muted-foreground mt-2" data-testid="non-responders-empty">
                Everyone who has signed in has answered.
              </p>
            ) : (
              <ul className="mt-2 grid gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-3 text-sm">
                {nonResponders.map((p) => (
                  <li key={p.id} className="flex flex-col" data-testid={`non-responder-${p.id}`}>
                    <span className="font-medium">{p.name}</span>
                    <span className="text-xs text-muted-foreground">{p.email}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        {isPoll ? (
          pollQ.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : pollQ.data ? (
            <div className="space-y-6">
              <div className="border rounded-lg p-4 bg-muted/30">
                <div className="text-xs text-muted-foreground mb-3" data-testid="poll-results-total">
                  {pollQ.data.total} response{pollQ.data.total === 1 ? "" : "s"}
                </div>
                <PollCounts results={pollQ.data} />
              </div>
              {pollResponses.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center" data-testid="responses-empty">
                  No submissions yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {pollResponses.map((r) => (
                    <PollResponseCard
                      key={r.id}
                      response={r}
                      questions={selected?.questions ?? []}
                      isNew={isNewPoll(r)}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Could not load poll results.</p>
          )
        ) : responsesQ.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : responses.length === 0 ? (
          <p
            className="text-sm text-muted-foreground py-8 text-center"
            data-testid="responses-empty"
          >
            No submissions yet.
          </p>
        ) : (
          <div className="space-y-3">
            {responses.map((r) => (
              <ResponseCard key={r.id} response={r} isNew={isNew(r)} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ResponseCard({
  response: r,
  isNew,
}: {
  response: AdminFormResponse;
  isNew: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    await copyText(r.responseText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  // Identifier field values (e.g. "Table 6 · The Breezers"). Display only —
  // deliberately absent from the card Copy and from Copy all.
  const identifierLine = Object.values(r.identifiers ?? {})
    .map((v) => v.trim())
    .filter((v) => v.length > 0)
    .join(" · ");
  return (
    <div
      className="border rounded-lg p-4 bg-card space-y-2"
      data-testid={`response-card-${r.id}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span
              className="font-semibold text-sm"
              data-testid={`response-participant-${r.id}`}
            >
              {r.participantName}
            </span>
            {isNew && (
              <Badge
                className="bg-accent text-primary hover:bg-accent"
                data-testid={`response-new-${r.id}`}
              >
                New
              </Badge>
            )}
          </div>
          <div className="text-xs text-muted-foreground">
            {r.formName?.trim() || `Form ${r.blockIndex + 1}`} · {r.sectionTitle}{" "}
            · {fmt(r.updatedAt)}
          </div>
          {identifierLine && (
            <div
              className="font-semibold text-sm"
              data-testid={`response-identifiers-${r.id}`}
            >
              {identifierLine}
            </div>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onCopy}
          data-testid={`button-response-copy-${r.id}`}
        >
          {copied ? (
            <Check className="w-3.5 h-3.5 mr-1" />
          ) : (
            <Copy className="w-3.5 h-3.5 mr-1" />
          )}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <pre
        className="whitespace-pre-wrap font-sans text-sm text-foreground bg-muted/40 rounded p-3"
        data-testid={`response-text-${r.id}`}
      >
        {r.responseText.trim() || <span className="text-muted-foreground italic">(empty)</span>}
      </pre>
    </div>
  );
}

function PollResponseCard({
  response: r,
  questions,
  isNew,
}: {
  response: AdminPollResponse;
  questions: GenericPollQuestion[];
  isNew: boolean;
}) {
  return (
    <div
      className="border rounded-lg p-4 bg-card space-y-2"
      data-testid={`poll-response-card-${r.id}`}
    >
      <div className="flex items-center gap-2">
        <span className="font-semibold text-sm" data-testid={`poll-response-participant-${r.id}`}>
          {r.participantName}
        </span>
        {isNew && (
          <Badge className="bg-accent text-primary hover:bg-accent" data-testid={`poll-response-new-${r.id}`}>
            New
          </Badge>
        )}
        <span className="text-xs text-muted-foreground">{fmt(r.updatedAt)}</span>
      </div>
      <dl className="text-sm space-y-1.5">
        {questions.map((q, qi) => {
          const a = r.answers[q.questionKey];
          return (
            <div key={q.questionKey} data-testid={`poll-response-answer-${r.id}-${qi}`}>
              <dt className="text-xs text-muted-foreground">{q.text}</dt>
              <dd>
                {a?.choices?.length ? a.choices.join(", ") : <span className="italic text-muted-foreground">No answer</span>}
                {a?.comment?.trim() && (
                  <div className="mt-0.5 text-sm bg-muted/40 rounded px-2 py-1 whitespace-pre-wrap">
                    <span className="text-xs text-muted-foreground">{q.commentLabel?.trim() || "Comment"}: </span>
                    {a.comment}
                  </div>
                )}
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}
