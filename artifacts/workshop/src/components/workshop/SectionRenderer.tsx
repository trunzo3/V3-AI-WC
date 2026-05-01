import type { Section } from "@workspace/api-client-react";
import { Lock } from "lucide-react";
import { SectionHeader, GoalBox } from "./SectionHeader";
import { NotesField } from "./NotesField";
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
  const promptBlock = generic?.promptBlock?.trim();
  const content = generic?.content ?? "";

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <SectionHeader title={title} type={section.type} />
      {goal && <GoalBox text={goal} />}

      {content &&
        (looksLikeHtml(content) ? (
          <div
            className="prose prose-slate max-w-none mb-8 text-foreground"
            // Content is admin-authored via the Tiptap editor, which only
            // emits StarterKit + Link nodes. No script/style/iframe vectors.
            dangerouslySetInnerHTML={{ __html: content }}
          />
        ) : (
          <div className="prose prose-slate max-w-none mb-8 whitespace-pre-wrap text-foreground">
            {content}
          </div>
        ))}

      {promptBlock && (
        <div className="bg-primary rounded-lg p-6 text-white mb-8">
          <span className="inline-block bg-accent text-primary text-xs font-bold tracking-widest uppercase px-2.5 py-1 rounded mb-4">
            Prompt
          </span>
          <pre className="text-white/90 text-sm leading-relaxed whitespace-pre-wrap font-mono">{promptBlock}</pre>
        </div>
      )}

      <div className="border-t pt-6 mt-6">
        <NotesField sectionId={section.id} fieldKey="notes" label="Your Notes" />
      </div>
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
