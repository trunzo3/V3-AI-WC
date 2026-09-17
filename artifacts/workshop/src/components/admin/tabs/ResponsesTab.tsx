import { useEffect, useMemo, useRef, useState } from "react";
import {
  useAdminListCohortFormResponses,
  getAdminListCohortFormResponsesQueryKey,
  useAdminListCohortSections,
  useAdminListGenericSections,
  type AdminFormResponse,
  type GenericContentBlock,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Copy, Check } from "lucide-react";

interface Props {
  cohortId: number;
}

const ALL = "__all__";

interface CollectingForm {
  key: string; // `${sectionId}:${blockIndex}`
  sectionId: string;
  blockIndex: number;
  label: string;
}

function fmt(d: string) {
  try {
    return new Date(d).toLocaleString();
  } catch {
    return d;
  }
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
  // to this cohort that contain a form block with collectResponses on.
  const sectionsQ = useAdminListCohortSections(cohortId);
  const genericsQ = useAdminListGenericSections();
  const collectingForms = useMemo<CollectingForm[]>(() => {
    const attached = sectionsQ.data?.sections ?? [];
    const generics = genericsQ.data?.sections ?? [];
    const byId = new Map(generics.map((g) => [`generic_${g.id}`, g]));
    const out: CollectingForm[] = [];
    for (const s of attached) {
      const g = byId.get(s.sectionId);
      if (!g) continue;
      const blocks = (g.contentBlocks ?? []) as GenericContentBlock[];
      blocks.forEach((b, i) => {
        if (b.type !== "form" || !b.collectResponses) return;
        const sectionTitle = s.displayName?.trim() || g.title;
        const name = b.formName?.trim() || `Form ${i + 1}`;
        out.push({
          key: `${s.sectionId}:${i}`,
          sectionId: s.sectionId,
          blockIndex: i,
          label: `${name} — ${sectionTitle}`,
        });
      });
    }
    return out;
  }, [sectionsQ.data, genericsQ.data]);

  const selected = collectingForms.find((f) => f.key === filter);
  const params =
    selected != null
      ? { sectionId: selected.sectionId, blockIndex: selected.blockIndex }
      : undefined;

  const responsesQ = useAdminListCohortFormResponses(cohortId, params, {
    query: {
      queryKey: getAdminListCohortFormResponsesQueryKey(cohortId, params),
      refetchInterval: 2000,
    },
  });
  const responses: AdminFormResponse[] = responsesQ.data?.responses ?? [];

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

  const copyAll = async () => {
    const text = responses
      .map((r) => `${r.participantName}\n${r.responseText}`)
      .join("\n\n");
    await copyText(text);
    toast({ title: `Copied ${responses.length} submission${responses.length === 1 ? "" : "s"}` });
  };

  return (
    <Card data-testid="responses-tab">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <CardTitle className="text-base">Responses</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Live stream of participant submissions from forms with "Collect
            responses" turned on. Newest first; refreshes every few seconds.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[220px]">
            <Label className="text-xs">Form</Label>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger data-testid="select-responses-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All forms</SelectItem>
                {collectingForms.map((f) => (
                  <SelectItem key={f.key} value={f.key}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={copyAll}
            disabled={responses.length === 0}
            data-testid="button-responses-copy-all"
          >
            <Copy className="w-3.5 h-3.5 mr-1" /> Copy all
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {responsesQ.isLoading ? (
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
