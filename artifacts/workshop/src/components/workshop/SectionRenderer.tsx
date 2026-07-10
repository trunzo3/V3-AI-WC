import { useMemo, useState } from "react";
import type {
  Section,
  GenericContentBlock,
  GenericFormField,
} from "@workspace/api-client-react";
import { Lock, ExternalLink, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  SectionHeader,
  GoalBox,
  InsightBox,
  RuleBox,
  DepthQuote,
} from "./SectionHeader";
import { NotesField } from "./NotesField";
import { SectionAttachedFiles } from "./SectionAttachedFiles";
import { useResolveTemplate } from "@/hooks/use-resolve-template";
import { CopyButton } from "./CopyButton";
import {
  VerificationTest,
  ToolSafari,
  RicecoFramework,
  DraftWithRiceco,
  LlmPeerReview,
  Distill,
  Prepare,
  Synthesize,
  PowerFollowUps,
  WhatAiIs,
  PersistentContext,
  RedYellowGreen,
  Capstone,
  OvernightAssignment,
  SixWaysWorksheet,
} from "./sections/Day1";
import {
  OvernightHarvest,
  StatusQuoBias,
  CountyChangeFramework,
  CountyChangeMessage,
  Closing,
} from "./sections/Day2";
import { WorkflowConfigurator } from "./sections/WorkflowConfigurator";

// True when the string contains at least one HTML element tag — used to
// pick between dangerouslySetInnerHTML (Tiptap output) and pre-wrap text
// (legacy plaintext bodies authored before the WYSIWYG was introduced).
function looksLikeHtml(s: string): boolean {
  return /<\/?[a-z][\s\S]*?>/i.test(s);
}

function TextBlock({ html }: { html: string }) {
  if (!html.trim()) return null;
  if (looksLikeHtml(html)) {
    return (
      <div
        className="prose prose-slate max-w-none mb-6 text-foreground"
        // Content is admin-authored via the Tiptap editor, which only
        // emits StarterKit + Link + Underline nodes. No script/style/iframe
        // vectors.
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }
  return (
    <div className="prose prose-slate max-w-none mb-6 whitespace-pre-wrap text-foreground">
      {html}
    </div>
  );
}

function PromptBlock({
  text,
  pill,
  buttonLabel,
}: {
  text: string;
  pill: string;
  buttonLabel?: string;
}) {
  // {{sectionId:fieldKey}} placeholders resolve to the participant's own
  // saved answers before the prompt is shown or copied.
  const resolved = useResolveTemplate(text);
  return (
    <div
      className="bg-primary rounded-lg p-6 text-white mb-6"
      data-testid="generic-prompt-block"
    >
      <span className="inline-block bg-accent text-primary text-xs font-bold tracking-widest uppercase px-2.5 py-1 rounded mb-4">
        {pill}
      </span>
      <pre className="text-white/90 text-sm leading-relaxed whitespace-pre-wrap font-mono">
        {resolved}
      </pre>
      <CopyButton text={resolved} label={buttonLabel || "Copy Prompt"} />
    </div>
  );
}

// A field block whose starting text (prefill) may reference the
// participant's answers from other sections. The resolved value only seeds
// the field; the participant edits and saves to this field normally.
function FieldBlock({
  sectionId,
  fieldKey,
  label,
  placeholder,
  helpText,
  prefill,
  multiline,
}: {
  sectionId: string;
  fieldKey: string;
  label: string;
  placeholder?: string;
  helpText?: string;
  prefill?: string;
  multiline: boolean;
}) {
  const resolvedPrefill = useResolveTemplate(prefill ?? "");
  return (
    <div className="mb-6">
      <NotesField
        sectionId={sectionId}
        fieldKey={fieldKey}
        label={label}
        placeholder={placeholder}
        helpText={helpText}
        initialValue={resolvedPrefill}
        multiline={multiline}
      />
    </div>
  );
}

// Renders sanitized admin-authored HTML, or plaintext with preserved
// line breaks for legacy bodies.
function RichBody({ html }: { html: string }) {
  if (looksLikeHtml(html)) {
    return <div dangerouslySetInnerHTML={{ __html: html }} />;
  }
  return <div className="whitespace-pre-wrap">{html}</div>;
}

function CalloutBlock({
  variant,
  title,
  content,
}: {
  variant: "stop" | "insight" | "rule" | "quote";
  title?: string;
  content: string;
}) {
  switch (variant) {
    case "stop":
      return (
        <div
          className="bg-red-600 text-white text-center py-5 px-4 rounded-lg mb-6"
          data-testid="generic-callout-stop"
        >
          {title && <div className="text-2xl font-bold mb-1">{title}</div>}
          <div className="text-sm opacity-90">
            <RichBody html={content} />
          </div>
        </div>
      );
    case "insight":
      return (
        <InsightBox>
          {title && <h4 className="font-bold text-accent uppercase text-xs tracking-wider mb-2">{title}</h4>}
          <RichBody html={content} />
        </InsightBox>
      );
    case "rule":
      return (
        <RuleBox title={title}>
          <RichBody html={content} />
        </RuleBox>
      );
    case "quote":
      return (
        <DepthQuote>
          <RichBody html={content} />
        </DepthQuote>
      );
    default:
      return null;
  }
}

function CardsBlock({
  columns,
  cards,
}: {
  columns: 2 | 3;
  cards: Array<{ title: string; body: string }>;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-4 mb-6",
        columns === 3 ? "md:grid-cols-2 lg:grid-cols-3" : "md:grid-cols-2",
      )}
      data-testid="generic-cards-block"
    >
      {cards.map((c, i) => (
        <div
          key={i}
          className="bg-card border border-border rounded-lg p-5 hover:border-accent transition-colors shadow-sm"
        >
          <h4 className="font-bold text-primary mb-2 uppercase text-sm tracking-wider">
            {c.title}
          </h4>
          <div className="text-foreground">
            <RichBody html={c.body} />
          </div>
        </div>
      ))}
    </div>
  );
}

function StepsBlock({
  ordered,
  items,
}: {
  ordered: boolean;
  items: Array<{ title: string; body: string }>;
}) {
  return (
    <div
      className="bg-card p-6 rounded-lg border space-y-4 mb-6"
      data-testid="generic-steps-block"
    >
      {items.map((s, i) => (
        <div key={i} className="flex gap-3 items-start">
          <div className="w-7 h-7 rounded-full bg-primary text-white font-bold text-sm flex items-center justify-center flex-shrink-0 mt-0.5">
            {ordered ? i + 1 : "•"}
          </div>
          <div>
            <div className="font-bold text-primary">{s.title}</div>
            <div className="text-sm text-muted-foreground">
              <RichBody html={s.body} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function LinkBlock({
  url,
  label,
  style,
}: {
  url: string;
  label: string;
  style: "button" | "text";
}) {
  if (style === "button") {
    return (
      <div className="mb-6">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 bg-primary text-white font-semibold px-5 py-2.5 rounded-lg hover:bg-primary/90 transition-colors"
          data-testid="generic-link-button"
        >
          {label}
          <ExternalLink className="w-4 h-4" />
        </a>
      </div>
    );
  }
  return (
    <div className="mb-6">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-primary underline underline-offset-2 hover:text-accent transition-colors"
        data-testid="generic-link-text"
      >
        {label}
        <ExternalLink className="w-3.5 h-3.5" />
      </a>
    </div>
  );
}

// One file, one button. The file must be attached to the same section; the
// server enforces that the section is unlocked for this participant before
// serving the download.
// Note: root-relative /api/* is correct here — the shared proxy routes it
// directly to the api-server (see SafariFilesDialog for the same pattern).
function DownloadBlock({ fileId, label }: { fileId: number; label: string }) {
  return (
    <div className="mb-6">
      <a
        href={`/api/files/${fileId}/download`}
        className="inline-flex items-center gap-2 bg-primary text-white font-semibold px-5 py-2.5 rounded-lg hover:bg-primary/90 transition-colors"
        data-testid={`download-block-${fileId}`}
      >
        <Download className="w-4 h-4" />
        {label || "Download"}
      </a>
    </div>
  );
}

// A group of auto-saving input fields with one button that copies all current
// answers at once. Mirrors the RicecoInputFields pattern in Day1.tsx: each
// child field reports its live value upward into a Map, and the copy button
// assembles from what's currently typed (not what was last saved).
function FormBlock({
  sectionId,
  fields,
  buttonLabel,
  copyStyle,
}: {
  sectionId: string;
  fields: GenericFormField[];
  buttonLabel: string;
  copyStyle: "labeled" | "joined";
}) {
  const [copied, setCopied] = useState(false);
  const valuesRef = useMemo(() => new Map<string, string>(), []);

  const handleValueChange = useMemo(
    () => (key: string, value: string) => {
      valuesRef.set(key, value);
    },
    [valuesRef],
  );

  const handleCopyAll = async () => {
    const parts: string[] = [];
    for (const f of fields) {
      if (!f.fieldKey) continue;
      const v = (valuesRef.get(f.fieldKey) ?? "").trim();
      if (v.length === 0) continue;
      parts.push(copyStyle === "labeled" ? `${f.label}: ${v}` : v);
    }
    if (parts.length === 0) return;
    const text = copyStyle === "labeled" ? parts.join("\n") : parts.join(" ");
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
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mb-6 space-y-5">
      {fields.map(
        (f) =>
          f.fieldKey && (
            <NotesField
              key={f.fieldKey}
              sectionId={sectionId}
              fieldKey={f.fieldKey}
              label={f.label ?? ""}
              placeholder={f.placeholder}
              helpText={f.helpText}
              multiline={f.multiline ?? true}
              onValueChange={handleValueChange}
            />
          ),
      )}
      <div className="flex justify-center pt-2">
        <button
          onClick={handleCopyAll}
          className="inline-flex items-center gap-2 text-white font-semibold text-sm px-8 py-3 rounded-lg hover:opacity-90 transition-opacity"
          style={{ backgroundColor: "#1e293b" }}
          data-testid={`form-copy-${sectionId}`}
        >
          📋 {copied ? "Copied!" : buttonLabel || "Copy"}
        </button>
      </div>
    </div>
  );
}

function LockedSection({
  title,
  description,
  hasCode,
}: {
  title: string;
  description: string;
  hasCode: boolean;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
      <div className="w-16 h-16 bg-secondary rounded-full flex items-center justify-center mb-6 text-muted-foreground">
        <Lock className="w-8 h-8" />
      </div>
      <h2 className="text-2xl font-serif font-bold text-foreground mb-4">{title}</h2>
      <p className="text-muted-foreground max-w-md">
        {description}
        {hasCode ? (
          <>
            <br />
            <br />
            Enter the access code in the top bar when instructed by the facilitator.
          </>
        ) : (
          <>
            <br />
            <br />
            This content will be unlocked by your facilitator.
          </>
        )}
      </p>
    </div>
  );
}

function GenericSectionView({
  section,
  title,
}: {
  section: Section;
  title: string;
}) {
  const generic = section.generic;
  const goal = generic?.goalText?.trim();
  const blocks = (generic?.contentBlocks ?? []) as GenericContentBlock[];
  const showNotesField = generic?.showNotesField ?? true;

  // Prompt blocks are numbered sequentially among themselves so authors who
  // mix multiple text/prompt blocks see "Prompt 1", "Prompt 2", … rather
  // than the absolute index of every block in the section. A prompt block
  // with a custom label renders the label and does not consume a number.
  let promptCounter = 0;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <SectionHeader
        title={title}
        type={section.type}
        badgeLabel={generic?.badgeLabel}
      />
      {goal && <GoalBox text={goal} />}

      {blocks.map((block, i) => {
        switch (block.type) {
          case "prompt": {
            let pill = block.label;
            if (!pill) {
              promptCounter += 1;
              pill = `Prompt ${promptCounter}`;
            }
            return (
              <PromptBlock
                key={i}
                text={block.content ?? ""}
                pill={pill}
                buttonLabel={block.buttonLabel}
              />
            );
          }
          case "text":
            return <TextBlock key={i} html={block.content ?? ""} />;
          case "callout":
            if (!block.variant) return null;
            return (
              <CalloutBlock
                key={i}
                variant={block.variant as "stop" | "insight" | "rule" | "quote"}
                title={block.title}
                content={block.content ?? ""}
              />
            );
          case "cards":
            return (
              <CardsBlock
                key={i}
                columns={block.columns === 3 ? 3 : 2}
                cards={block.cards ?? []}
              />
            );
          case "steps":
            return (
              <StepsBlock
                key={i}
                ordered={block.ordered ?? true}
                items={block.items ?? []}
              />
            );
          case "link":
            if (!block.url) return null;
            return (
              <LinkBlock
                key={i}
                url={block.url}
                label={block.label ?? block.url}
                style={block.style === "text" ? "text" : "button"}
              />
            );
          case "field":
            if (!block.fieldKey) return null;
            return (
              <FieldBlock
                key={i}
                sectionId={section.id}
                fieldKey={block.fieldKey}
                label={block.label ?? ""}
                placeholder={block.placeholder}
                helpText={block.helpText}
                prefill={block.prefill}
                multiline={block.multiline ?? true}
              />
            );
          case "form":
            if (!block.fields || block.fields.length === 0) return null;
            return (
              <FormBlock
                key={i}
                sectionId={section.id}
                fields={block.fields}
                buttonLabel={block.buttonLabel ?? ""}
                copyStyle={block.copyStyle === "joined" ? "joined" : "labeled"}
              />
            );
          case "download":
            if (!block.fileId) return null;
            return (
              <DownloadBlock
                key={i}
                fileId={block.fileId}
                label={block.label ?? ""}
              />
            );
          default:
            // Unknown block type from a newer schema version: render nothing.
            return null;
        }
      })}

      {showNotesField && (
        <div className="border-t pt-6 mt-6">
          <NotesField sectionId={section.id} fieldKey="notes" label="Your Notes" />
        </div>
      )}
    </div>
  );
}

export function SectionRenderer({ section }: { section: Section }) {
  if (!section.unlocked) {
    return (
      <LockedSection
        title={section.title}
        description={section.description || "This section is locked."}
        hasCode={section.hasCode}
      />
    );
  }

  if (section.isGeneric) {
    return <GenericSectionView section={section} title={section.title} />;
  }

  // Hardcoded sections render their own component, then any files attached
  // to the section (via the admin Sections tab) as download buttons at the
  // very bottom, below the section's notes field.
  return (
    <>
      <HardcodedSectionBody section={section} />
      {/* Keyed by section id so switching sections remounts the component,
          preventing a brief flash of the previous section's files. */}
      <SectionAttachedFiles key={section.id} sectionId={section.id} />
    </>
  );
}

function HardcodedSectionBody({ section }: { section: Section }) {
  switch (section.id) {
    case "verification-test":
      return <VerificationTest sectionId={section.id} title={section.title} />;
    case "tool-safari":
      return <ToolSafari sectionId={section.id} title={section.title} />;
    case "riceco-framework":
      return <RicecoFramework sectionId={section.id} title={section.title} />;
    case "draft-with-riceco":
      return <DraftWithRiceco sectionId={section.id} title={section.title} />;
    case "llm-peer-review":
      return <LlmPeerReview sectionId={section.id} title={section.title} />;
    case "distill":
      return <Distill sectionId={section.id} title={section.title} />;
    case "prepare":
      return <Prepare sectionId={section.id} title={section.title} />;
    case "synthesize":
      return <Synthesize sectionId={section.id} title={section.title} />;
    case "power-follow-ups":
      return <PowerFollowUps sectionId={section.id} title={section.title} />;
    case "what-ai-is":
      return <WhatAiIs sectionId={section.id} title={section.title} />;
    case "persistent-context":
      return <PersistentContext sectionId={section.id} title={section.title} />;
    case "red-yellow-green":
      return <RedYellowGreen sectionId={section.id} title={section.title} />;
    case "capstone":
      return <Capstone sectionId={section.id} title={section.title} />;
    case "overnight-assignment":
      return <OvernightAssignment sectionId={section.id} title={section.title} />;
    case "six-ways-worksheet":
      return <SixWaysWorksheet sectionId={section.id} title={section.title} />;

    case "overnight-harvest":
      return <OvernightHarvest sectionId={section.id} title={section.title} />;
    case "workflow-configurator":
      return <WorkflowConfigurator sectionId={section.id} title={section.title} />;
    case "status-quo-bias":
      return <StatusQuoBias sectionId={section.id} title={section.title} />;
    case "county-change-framework":
      return <CountyChangeFramework sectionId={section.id} title={section.title} />;
    case "county-change-message":
      return <CountyChangeMessage sectionId={section.id} title={section.title} />;
    case "closing":
      return <Closing sectionId={section.id} title={section.title} />;

    default:
      // Unknown hardcoded id — fall back to a basic notes view.
      return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <SectionHeader title={section.title} type={section.type} />
          {section.description && (
            <p className="text-muted-foreground mb-6">{section.description}</p>
          )}
          <NotesField sectionId={section.id} fieldKey="notes" label="Your Notes" />
        </div>
      );
  }
}
