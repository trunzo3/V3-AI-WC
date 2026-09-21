import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useParams } from "wouter";
import {
  useAdminGetCohort,
  useAdminListCohortParticipants,
  useAdminListCohortSections,
  useAdminListGenericSections,
  useAdminListCohortFormResponses,
  getAdminGetCohortQueryKey,
  getAdminListCohortParticipantsQueryKey,
  getAdminListCohortSectionsQueryKey,
  getAdminListGenericSectionsQueryKey,
  getAdminListCohortFormResponsesQueryKey,
  type AdminFormResponse,
  type GenericContentBlock,
} from "@workspace/api-client-react";
import { getAdminAuth, ADMIN_SESSION_EXPIRED_EVENT } from "@/lib/auth";
import { cn } from "@/lib/utils";

// Projector "Board" view: a full-screen, read-only wall of submissions for
// one collecting form. Reads only existing admin endpoints; nothing here
// writes. Opened from the Responses tab in a new browser tab.

const POLL_MS = 2000;

interface ParsedLine {
  label: string;
  value: string;
}

/**
 * Split "Label: value" lines (first ": " only). Lines without a separator are
 * continuation lines of the previous value (multiline answers). Text that
 * starts with an unlabeled line is not in the labeled format: returns [] so
 * the caller falls back to the full text.
 */
function parseLabeled(text: string): ParsedLine[] {
  const out: ParsedLine[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const idx = line.indexOf(": ");
    if (idx <= 0) {
      const prev = out[out.length - 1];
      if (!prev) return [];
      prev.value = `${prev.value}\n${line}`;
      continue;
    }
    out.push({ label: line.slice(0, idx).trim(), value: line.slice(idx + 2).trim() });
  }
  return out;
}

function findValue(lines: ParsedLine[], label: string): string | undefined {
  const want = label.toLowerCase();
  return lines.find((l) => l.label.toLowerCase() === want)?.value;
}

/** Case-insensitive lookup in the identifiers object (label -> value). */
function findIdentifier(
  ids: Record<string, string> | null | undefined,
  label: string,
): string | undefined {
  if (!ids) return undefined;
  const want = label.toLowerCase();
  for (const [k, v] of Object.entries(ids)) {
    if (k.trim().toLowerCase() === want && v.trim()) return v.trim();
  }
  return undefined;
}

interface CardModel {
  id: number;
  updatedAt: string;
  title: string;
  subtitle?: string;
  tableNumber?: string;
  body: string;
  bodyIsHighlight: boolean;
  lines: ParsedLine[];
  fullText: string;
}

function toCardModel(r: AdminFormResponse): CardModel {
  const lines = parseLabeled(r.responseText);
  // Identifiers first (they're excluded from the text by design), then the
  // labeled text as a fallback for forms that keep table fields inline.
  const tableNumber =
    findIdentifier(r.identifiers, "Table number") ?? findValue(lines, "Table number");
  const tableName =
    findIdentifier(r.identifiers, "Table name") ?? findValue(lines, "Table name");
  const title = tableNumber ? `Table ${tableNumber}` : r.participantName;
  const subtitle = tableNumber ? tableName : undefined;

  const goal = findValue(lines, "The goal");
  const firstBody = lines.find(
    (l) => !["table number", "table name"].includes(l.label.toLowerCase()),
  )?.value;
  const highlight = goal ?? firstBody;
  return {
    id: r.id,
    updatedAt: r.updatedAt,
    title,
    subtitle,
    tableNumber,
    body: highlight ?? r.responseText.trim(),
    bodyIsHighlight: highlight != null,
    lines,
    fullText: r.responseText.trim(),
  };
}

function relativeTime(iso: string, now: number): string {
  const diff = Math.max(0, now - new Date(iso).getTime());
  const s = Math.floor(diff / 1000);
  if (s < 10) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function AdminBoard() {
  const params = useParams<{ cohortId: string; sectionId: string; blockIndex: string }>();
  const cohortId = Number(params.cohortId);
  const sectionId = params.sectionId ?? "";
  const blockIndex = Number(params.blockIndex);
  const [, setLocation] = useLocation();
  const isAdmin = getAdminAuth();

  useEffect(() => {
    if (!isAdmin) setLocation("/admin/login");
  }, [isAdmin, setLocation]);
  useEffect(() => {
    const onExpired = () => setLocation("/admin/login");
    window.addEventListener(ADMIN_SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(ADMIN_SESSION_EXPIRED_EVENT, onExpired);
  }, [setLocation]);

  const validParams =
    isAdmin && Number.isInteger(cohortId) && sectionId.length > 0 && Number.isInteger(blockIndex);

  const cohortQ = useAdminGetCohort(cohortId, {
    query: { queryKey: getAdminGetCohortQueryKey(cohortId), enabled: validParams },
  });
  const participantsQ = useAdminListCohortParticipants(cohortId, {
    query: {
      queryKey: getAdminListCohortParticipantsQueryKey(cohortId),
      enabled: validParams,
      refetchInterval: POLL_MS,
    },
  });
  const sectionsQ = useAdminListCohortSections(cohortId, {
    query: { queryKey: getAdminListCohortSectionsQueryKey(cohortId), enabled: validParams },
  });
  const genericsQ = useAdminListGenericSections({
    query: { queryKey: getAdminListGenericSectionsQueryKey(), enabled: validParams },
  });
  const filter = { sectionId, blockIndex };
  const responsesQ = useAdminListCohortFormResponses(cohortId, filter, {
    query: {
      enabled: validParams,
      queryKey: getAdminListCohortFormResponsesQueryKey(cohortId, filter),
      refetchInterval: POLL_MS,
    },
  });

  const cohortName = cohortQ.data?.cohort.name ?? "";
  const formName = useMemo(() => {
    const generics = genericsQ.data?.sections ?? [];
    const g = generics.find((x) => `generic_${x.id}` === sectionId);
    const block = (g?.contentBlocks as GenericContentBlock[] | undefined)?.[blockIndex];
    const name = block?.type === "form" ? block.formName?.trim() : "";
    if (name) return name;
    const row = sectionsQ.data?.sections.find((s) => s.sectionId === sectionId);
    const sectionTitle = row?.displayName?.trim() || g?.title;
    return sectionTitle ? `Form ${blockIndex + 1} — ${sectionTitle}` : "";
  }, [genericsQ.data, sectionsQ.data, sectionId, blockIndex]);

  const responses = responsesQ.data?.responses ?? [];
  const cards = useMemo(
    () =>
      [...responses]
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .map(toCardModel),
    [responses],
  );

  // NEW tag baseline: snapshot of id -> updatedAt from the first load.
  const baselineRef = useRef<Map<number, string> | null>(null);
  useEffect(() => {
    if (baselineRef.current == null && responsesQ.data) {
      baselineRef.current = new Map(responsesQ.data.responses.map((r) => [r.id, r.updatedAt]));
    }
  }, [responsesQ.data]);
  const isNew = (c: CardModel) => {
    const base = baselineRef.current;
    if (base == null) return false;
    const seen = base.get(c.id);
    return seen == null || seen !== c.updatedAt;
  };

  // Relative times tick with the poll.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), POLL_MS);
    return () => clearInterval(t);
  }, []);

  const [expandedId, setExpandedId] = useState<number | null>(null);

  const totalParticipants = participantsQ.data?.participants.length ?? 0;
  const tableNumbers = new Set(cards.map((c) => c.tableNumber).filter(Boolean));
  const countText =
    tableNumbers.size > 0
      ? `${tableNumbers.size} table${tableNumbers.size === 1 ? "" : "s"} submitted`
      : `${cards.length} of ${totalParticipants} submitted`;

  if (!validParams) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">
        Invalid board link.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground" data-testid="board-page">
      <header
        className="bg-primary text-primary-foreground px-8 py-5 flex flex-wrap items-center justify-between gap-4 sticky top-0 z-10"
        data-testid="board-header"
      >
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 min-w-0">
          <h1 className="font-serif text-2xl md:text-3xl leading-tight" data-testid="board-cohort-name">
            {cohortName || "\u00a0"}
          </h1>
          {formName && (
            <span className="text-base md:text-lg text-white/75" data-testid="board-form-name">
              {formName}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-lg md:text-xl font-medium" data-testid="board-count">
          <span
            aria-hidden="true"
            className="inline-block w-3 h-3 rounded-full bg-accent motion-safe:animate-pulse"
          />
          <span>{countText}</span>
        </div>
      </header>

      <main className="px-8 py-7">
        {responsesQ.isLoading ? null : cards.length === 0 ? (
          <p
            className="text-center text-muted-foreground text-2xl py-24 font-serif"
            data-testid="board-empty"
          >
            No submissions yet.
          </p>
        ) : (
          <div
            className="grid"
            style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(420px, 100%), 1fr))", gap: 22 }}
            data-testid="board-grid"
          >
            {cards.map((c) => {
              const expanded = expandedId === c.id;
              return (
                <article
                  key={c.id}
                  role="button"
                  tabIndex={0}
                  aria-expanded={expanded}
                  aria-controls={expanded ? `board-card-details-${c.id}` : undefined}
                  onClick={() => setExpandedId(expanded ? null : c.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setExpandedId(expanded ? null : c.id);
                    }
                  }}
                  className={cn(
                    "cursor-pointer text-left bg-card border border-border rounded-lg shadow-sm border-l-[6px] border-l-accent p-6 flex flex-col gap-3",
                    "transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/60",
                    expanded && "col-span-full",
                  )}
                  style={expanded ? { gridColumn: "1 / -1" } : undefined}
                  data-testid={`board-card-${c.id}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-serif text-2xl leading-tight" data-testid={`board-card-title-${c.id}`}>
                        {c.title}
                      </div>
                      {c.subtitle && (
                        <div className="text-base text-muted-foreground mt-0.5">{c.subtitle}</div>
                      )}
                    </div>
                    {isNew(c) && (
                      <span
                        className="shrink-0 bg-accent text-primary text-xs font-bold tracking-widest uppercase px-2 py-1 rounded"
                        data-testid={`board-card-new-${c.id}`}
                      >
                        New
                      </span>
                    )}
                  </div>

                  {c.bodyIsHighlight ? (
                    <p className="text-[24px] leading-snug whitespace-pre-wrap">{c.body}</p>
                  ) : (
                    <p className="text-base whitespace-pre-wrap">
                      {c.body || <span className="text-muted-foreground italic">(empty)</span>}
                    </p>
                  )}

                  {expanded && (
                    <div
                      id={`board-card-details-${c.id}`}
                      className="mt-2 pt-4 border-t border-border"
                      data-testid={`board-card-details-${c.id}`}
                    >
                      {c.lines.length > 0 ? (
                        <dl className="grid gap-x-8 gap-y-3" style={{ gridTemplateColumns: "max-content 1fr" }}>
                          {c.lines.map((l, i) => (
                            <div key={i} className="contents">
                              <dt className="font-semibold">{l.label}</dt>
                              <dd className="whitespace-pre-wrap">{l.value}</dd>
                            </div>
                          ))}
                        </dl>
                      ) : (
                        <pre className="whitespace-pre-wrap font-sans text-base">{c.fullText}</pre>
                      )}
                    </div>
                  )}

                  <div className="text-sm text-muted-foreground mt-auto pt-1">
                    Submitted {relativeTime(c.updatedAt, now)}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
