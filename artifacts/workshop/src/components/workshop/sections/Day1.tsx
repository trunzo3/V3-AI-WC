import { useEffect, useMemo, useState } from "react";
import { SectionHeader, GoalBox, InsightBox, DepthQuote } from "../SectionHeader";
import { NotesField } from "../NotesField";
import { CopyButton } from "../CopyButton";
import {
  useListSafariTabs,
  useListLlmTools,
  useGetContentVariants,
} from "@workspace/api-client-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Note: do NOT prefix with import.meta.env.BASE_URL here. The shared proxy
// routes root-relative /api/* directly to the api-server; prefixing with
// /workshop would route the call back to the workshop dev server and 404.

const FALLBACK_VERIFY_PROMPT = `For each statistic, verify against primary sources. Output: Claim | Correct? | Actual Figure | Source Link.

One table for each bullet. No other commentary.

– Child protective services identified 556,899 victims of child abuse and neglect in federal fiscal year 2022, matching a national rate of 7.7 victims per 1,000 children. Agencies received 4,276,000 total referrals involving about 7.53 million children.

– Among the 47 states reporting both screened-in and screened-out referrals, 50% were screened in and 50.5% screened out.

– In 2022, the U.S. population aged 65 and older reached 57.8 million, or 17.3% of the total population. In 2023, approximately 25% of community-dwelling older adults lived alone.`;

const FALLBACK_ANSWER_KEY = `Stat 1 — CPS Victims Count
Error: 556,000 victims
Correct: 558,899 victims of child abuse and neglect in FFY 2022, at a national rate of 7.7 per 1,000 children. 4,276,000 referrals involving ~7.53 million children.

Stat 2 — Screening Rates
Error: 50% screened in
Correct: Among the 47 reporting states, 49.5% were screened in and 50.5% screened out.

Stat 3 — Older Adults Living Alone
Error: 25% of community-dwelling older adults lived alone
Correct: U.S. population 65+ reached 57.8 million (17.3%) in 2022. In 2023, approximately 28% of community-dwelling older adults lived alone.`;

const CRITIQUE_SCAFFOLD = `"Here are the instructions I gave to [Model A]:"
---
[PASTE YOUR ORIGINAL PROMPT]
---
"Below is the response. Critique only. Do not redraft."
---
[PASTE MODEL A'S OUTPUT]`;

const RESPOND_SCAFFOLD = `"Below is GPT's critique. Is it useful?"
---
[PASTE MODEL B'S CRITIQUE]`;

interface SectionProps {
  sectionId: string;
  title: string;
}

function LlmToolButtons() {
  const { data: toolsResp } = useListLlmTools();
  const tools = toolsResp?.tools ?? [];
  if (tools.length === 0) return null;

  return (
    <div className="flex flex-wrap justify-center gap-6">
      {tools.map((t) => (
        <a
          key={t.id}
          href={t.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-lg font-bold text-primary hover:text-accent transition-colors"
          data-testid={`llm-tool-${t.name}`}
        >
          {t.displayLabel}
        </a>
      ))}
    </div>
  );
}

export function VerificationTest({ sectionId, title }: SectionProps) {
  const { data: variantsResp } = useGetContentVariants(sectionId);
  const variants = variantsResp?.variants ?? [];
  const byKey = (k: string) => variants.find((v) => v.blockKey === k)?.content;

  const promptText = byKey("prompt") ?? FALLBACK_VERIFY_PROMPT;
  const answerKeyText = byKey("answer_key") ?? FALLBACK_ANSWER_KEY;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <SectionHeader title={title} type="exercise" />
      <GoalBox text="Catch the errors AI makes — before they catch you." />

      <div className="space-y-6">
        <div>
          <div className="text-center py-2 text-xs font-bold tracking-widest uppercase text-muted-foreground mb-3">
            Open an LLM
          </div>
          <LlmToolButtons />
        </div>

        <div className="bg-card p-6 rounded-lg border space-y-4">
          {[
            { n: 1, title: "Copy the prompt", desc: "Use the button below to copy the full prompt to your clipboard." },
            { n: 2, title: "Paste into your tool", desc: "Open any LLM above and paste. Hit send." },
            { n: 3, title: "Read the output", desc: "What did it catch — and what did it miss?" },
            { n: 4, title: "Scroll past the stop", desc: "Check the answer key only after you've run the test." },
          ].map((s) => (
            <div key={s.n} className="flex gap-3 items-start">
              <div className="w-7 h-7 rounded-full bg-primary text-white font-bold text-sm flex items-center justify-center flex-shrink-0 mt-0.5">
                {s.n}
              </div>
              <div>
                <div className="font-bold text-primary">{s.title}</div>
                <div className="text-sm text-muted-foreground">{s.desc}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-primary rounded-lg p-6 text-white">
          <span className="inline-block bg-accent text-primary text-xs font-bold tracking-widest uppercase px-2.5 py-1 rounded mb-4">
            Prompt to Copy
          </span>
          <pre className="text-white/90 text-sm leading-relaxed whitespace-pre-wrap font-mono">{promptText}</pre>
          <CopyButton text={promptText} label="Copy Prompt" />
        </div>

        <div className="bg-red-600 text-white text-center py-5 rounded-lg">
          <div className="text-2xl font-bold mb-1">🛑 Stop Here</div>
          <div className="text-sm opacity-90">
            Run your AI test first. Scroll past this point only after you've seen what your tool found.
          </div>
        </div>

        <div className="border border-border rounded-lg overflow-hidden">
          <div className="bg-primary px-5 py-3 flex items-center gap-3">
            <span className="bg-red-600 text-white text-xs font-bold tracking-widest uppercase px-2 py-0.5 rounded">
              Answer Key
            </span>
            <span className="text-white font-bold text-sm">Correct Information</span>
          </div>
          <pre className="px-5 py-4 whitespace-pre-wrap text-sm text-foreground bg-card">{answerKeyText}</pre>
        </div>

        <InsightBox>
          AI doesn't know when it's wrong. Confident delivery is not the same as accurate content. Your judgment is the
          quality control layer — not the model's.
        </InsightBox>

        <NotesField sectionId={sectionId} fieldKey="notes" label="Your Notes" />
      </div>
    </div>
  );
}

export function ToolSafari({ sectionId, title }: SectionProps) {
  const { data: tabsResp } = useListSafariTabs();
  const tabs = useMemo(
    () => (tabsResp?.tabs ?? []).filter((t) => t.active),
    [tabsResp],
  );
  type SafariFile = { id: number; safariLibraryId: number | null; filename: string };
  const [filesByLib, setFilesByLib] = useState<Record<number, SafariFile | undefined>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/files/by-section/tool-safari`, {
          credentials: "include",
        });
        if (!res.ok) return;
        const body = (await res.json()) as { files: SafariFile[] };
        if (cancelled) return;
        const map: Record<number, SafariFile> = {};
        for (const f of body.files) {
          if (f.safariLibraryId != null && map[f.safariLibraryId] == null) {
            map[f.safariLibraryId] = f;
          }
        }
        setFilesByLib(map);
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, [tabs]);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <SectionHeader title={title} type="exercise" />
      <GoalBox text="Explore multiple AI tools hands-on. Know which tool fits which task." />

      <div className="bg-card p-6 rounded-lg border mb-6">
        <p className="text-foreground">
          Take 15 minutes to explore different tools using the provided worksheets. Switch tabs below to see the guide
          for each tool.
        </p>
      </div>

      {tabs.length > 0 ? (
        <Tabs defaultValue={tabs[0]?.id.toString()} className="w-full">
          <TabsList className="flex flex-wrap h-auto justify-start mb-0 bg-secondary/50 rounded-b-none">
            {tabs.map((w) => (
              <TabsTrigger
                key={w.id}
                value={w.id.toString()}
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                data-testid={`safari-tab-${w.name}`}
              >
                {w.name}
              </TabsTrigger>
            ))}
          </TabsList>
          {tabs.map((w) => {
            const file = filesByLib[w.safariLibraryId];
            return (
              <TabsContent
                key={w.id}
                value={w.id.toString()}
                className="space-y-4 bg-card p-6 rounded-b-lg rounded-tr-lg border border-t-0"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-primary">{w.name} Exploration</h3>
                  {file ? (
                    <a
                      href={`/api/files/${file.id}/download`}
                      className="inline-flex items-center gap-2 bg-primary text-white px-3 py-1.5 rounded text-xs font-bold hover:bg-primary/90 transition-colors"
                      data-testid={`button-safari-download-${w.safariLibraryId}`}
                    >
                      ⬇ Download Safari Guide
                    </a>
                  ) : (
                    <button
                      disabled
                      className="inline-flex items-center gap-2 bg-secondary text-muted-foreground px-3 py-1.5 rounded text-xs font-medium cursor-not-allowed"
                    >
                      Guide coming soon
                    </button>
                  )}
                </div>
              </TabsContent>
            );
          })}
        </Tabs>
      ) : (
        <div className="p-8 text-center border rounded-lg bg-secondary/20 text-muted-foreground">
          No safari tabs configured yet.
        </div>
      )}

      <div className="mt-8 border-t pt-8">
        <NotesField sectionId={sectionId} fieldKey="notes" label="Your Notes" />
      </div>
    </div>
  );
}

export function RicecoFramework({ sectionId, title }: SectionProps) {
  const rows = [
    { l: "R", name: "Role", desc: "Who is the AI acting as?" },
    { l: "I", name: "Instruction", desc: "What exactly do you want it to do?" },
    { l: "C", name: "Context", desc: "What background information is needed?" },
    { l: "E", name: "Examples", desc: "What does good look like?" },
    { l: "C", name: "Constraints", desc: "What rules must it follow?" },
    { l: "O", name: "Output", desc: "How should the final result be formatted?" },
  ];

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <SectionHeader title={title} type="reference" />
      <GoalBox text="Six ingredients for prompts that produce usable output the first time." />

      <div className="grid gap-4 mb-8">
        {rows.map((r) => (
          <div key={r.name} className="flex gap-4 p-4 border rounded-lg bg-card items-start">
            <div className="w-10 h-10 rounded-full bg-accent text-primary font-bold flex items-center justify-center flex-shrink-0 text-lg">
              {r.l}
            </div>
            <div>
              <h4 className="font-bold text-primary text-lg">{r.name}</h4>
              <p className="text-foreground mt-1">{r.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="border-l-4 border-accent pl-6 py-2 my-8 bg-secondary/30 rounded-r-lg p-4">
        <h4 className="font-bold text-primary mb-2 flex items-center gap-2">
          <span className="bg-accent text-primary px-2 py-1 rounded text-xs uppercase tracking-wider">80% Shortcut</span>
        </h4>
        <p className="text-foreground">
          You don't need all six every time. For most daily tasks, <strong>I + C + C</strong> — Instruction, Context,
          Constraints — gets you 80% of the way there.
        </p>
      </div>

      <NotesField sectionId={sectionId} fieldKey="notes" label="Your Notes" />
    </div>
  );
}

export function DraftWithRiceco({ sectionId, title }: SectionProps) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <SectionHeader title={title} type="exercise" />
      <GoalBox text="Use your 6 Ways worksheet task to create a real first draft." />

      <div className="bg-card p-6 rounded-lg border mb-8">
        <ol className="list-decimal list-inside space-y-2 text-foreground">
          <li>Pick your task from the 6 Ways worksheet</li>
          <li>Build your RICECO prompt — start with I+C+C minimum</li>
          <li>Run it and note what you got</li>
        </ol>
      </div>

      <NotesField sectionId={sectionId} fieldKey="notes" label="Your Notes" />
    </div>
  );
}

export function LlmPeerReview({ sectionId, title }: SectionProps) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <SectionHeader title={title} type="exercise" />
      <GoalBox text="Use a second AI to check the first one's work. Build the verification habit." />

      <div className="flex items-center gap-3 mb-8 flex-wrap">
        <span className="px-4 py-2 rounded-full border border-border text-primary font-semibold text-sm">Draft</span>
        <span className="text-accent font-bold">→</span>
        <span className="px-4 py-2 rounded-full bg-primary text-white font-semibold text-sm">Critique</span>
        <span className="text-accent font-bold">→</span>
        <span className="px-4 py-2 rounded-full border border-border text-primary font-semibold text-sm">Respond</span>
      </div>

      <div className="bg-primary rounded-lg p-6 text-white mb-4">
        <span className="inline-block bg-accent text-primary text-xs font-bold tracking-widest uppercase px-2.5 py-1 rounded mb-4">
          Critique Scaffold (for Model B)
        </span>
        <pre className="text-white/90 text-sm leading-relaxed whitespace-pre-wrap font-mono">{CRITIQUE_SCAFFOLD}</pre>
        <CopyButton text={CRITIQUE_SCAFFOLD} label="Copy Scaffold" />
      </div>

      <div className="bg-primary rounded-lg p-6 text-white mb-8">
        <span className="inline-block bg-accent text-primary text-xs font-bold tracking-widest uppercase px-2.5 py-1 rounded mb-4">
          Respond Scaffold (back in Model A)
        </span>
        <pre className="text-white/90 text-sm leading-relaxed whitespace-pre-wrap font-mono">{RESPOND_SCAFFOLD}</pre>
        <CopyButton text={RESPOND_SCAFFOLD} label="Copy Scaffold" />
      </div>

      <InsightBox>
        Different models catch different errors and carry different biases. Using them to check each other is a
        structural safeguard — not just a best practice.
      </InsightBox>

      <NotesField sectionId={sectionId} fieldKey="notes" label="Your Notes" />
    </div>
  );
}

export function Distill({ sectionId, title }: SectionProps) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <SectionHeader title={title} type="exercise" />
      <GoalBox text="Turn something complex into something clear." />

      <div className="bg-card p-6 border rounded-lg mb-8 shadow-sm">
        <h3 className="font-bold text-primary mb-3">RICECO Scaffold</h3>
        <p className="text-foreground font-mono text-sm bg-secondary/50 p-4 rounded">
          <strong className="text-primary">I:</strong> Summarize the attached document.<br />
          <strong className="text-primary">C:</strong> The audience is busy executives who need the bottom line.<br />
          <strong className="text-primary">C:</strong> Keep it under 300 words. No jargon.<br />
          <strong className="text-primary">O:</strong> 3 bullet points of key takeaways, 1 paragraph summary.
        </p>
      </div>

      <NotesField sectionId={sectionId} fieldKey="notes" label="Your Notes" />
    </div>
  );
}

export function Prepare({ sectionId, title }: SectionProps) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <SectionHeader title={title} type="exercise" />
      <GoalBox text="Get ready for a high-stakes conversation before it happens." />

      <div className="bg-card p-6 border rounded-lg mb-6 shadow-sm">
        <h3 className="font-bold text-primary mb-3">RICECO Scaffold</h3>
        <p className="text-foreground font-mono text-sm bg-secondary/50 p-4 rounded">
          <strong className="text-primary">R:</strong> You are a skeptical community member.<br />
          <strong className="text-primary">I:</strong> Roleplay a conversation with me about [Topic].<br />
          <strong className="text-primary">C:</strong> We are at a town hall. I am presenting a new policy.<br />
          <strong className="text-primary">C:</strong> Push back on my points. Ask one question at a time.<br />
          <strong className="text-primary">O:</strong> Dialogue format. Wait for my response before replying.
        </p>
      </div>

      <div className="border-l-4 border-accent pl-4 py-3 my-8 bg-card rounded-r-lg">
        <h4 className="font-bold text-primary uppercase text-xs tracking-wider mb-1">Power Move</h4>
        <p className="text-foreground">Don't just ask for objections. Ask for the strongest case against you.</p>
      </div>

      <DepthQuote>Preparing for conversations is critical.</DepthQuote>

      <NotesField sectionId={sectionId} fieldKey="notes" label="Your Notes" />
    </div>
  );
}

export function Synthesize({ sectionId, title }: SectionProps) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <SectionHeader title={title} type="exercise" />
      <GoalBox text="Find patterns across multiple documents." />

      <div className="bg-card p-6 border rounded-lg mb-8 shadow-sm">
        <h3 className="font-bold text-primary mb-3">Steps & Scaffold</h3>
        <p className="text-foreground font-mono text-sm bg-secondary/50 p-4 rounded">
          <strong className="text-primary">I:</strong> Review the attached reports and identify common themes.<br />
          <strong className="text-primary">C:</strong> Focus on recurring challenges and proposed solutions.<br />
          <strong className="text-primary">C:</strong> Cite which document each point comes from.<br />
          <strong className="text-primary">O:</strong> A thematic summary table.
        </p>
      </div>

      <NotesField sectionId={sectionId} fieldKey="notes" label="Your Notes" />
    </div>
  );
}

export function PowerFollowUps({ sectionId, title }: SectionProps) {
  const moves = [
    { name: "Simplify", prompt: "Explain this to a 10-year-old." },
    { name: "Sticky", prompt: "Make this more memorable. Use an analogy." },
    { name: "Test", prompt: "What's the strongest argument against this?" },
    { name: "Push", prompt: "Give me 5 more ideas, crazier this time." },
    { name: "Flip", prompt: "Argue the exact opposite position." },
    { name: "Rank", prompt: "Rank these by feasibility and explain why." },
    { name: "Ground", prompt: "Give me a real-world example of this working." },
    { name: "Tone", prompt: "Rewrite this to be more empathetic and less formal." },
    { name: "Format", prompt: "Turn this into a checklist." },
  ];

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <SectionHeader title={title} type="reference" />
      <GoalBox text="Nine moves to refine, pressure-test, and reshape AI output." />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {moves.map((m) => (
          <div
            key={m.name}
            className="bg-card border border-border rounded-lg p-5 hover:border-accent transition-colors shadow-sm"
          >
            <h4 className="font-bold text-primary mb-2 uppercase text-sm tracking-wider">{m.name}</h4>
            <p className="text-foreground italic">"{m.prompt}"</p>
          </div>
        ))}
      </div>

      <div className="bg-primary text-white p-6 rounded-lg mb-8 shadow-md">
        <h4 className="font-bold text-accent uppercase text-xs tracking-wider mb-2">Key Principle</h4>
        <p>The first response is raw material, not a final product. Every follow-up is an editing decision.</p>
      </div>

      <NotesField sectionId={sectionId} fieldKey="notes" label="Your Notes" />
    </div>
  );
}

export function WhatAiIs({ sectionId, title }: SectionProps) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <SectionHeader title={title} type="reference" />

      <div className="bg-card border rounded-lg p-6 mb-8 text-center shadow-sm">
        <h3 className="text-xl font-bold text-primary mb-2">Core Concept</h3>
        <p className="text-foreground">
          Pattern matching, not thinking. The same process produces correct answers and hallucinations.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-8 mb-12">
        <div className="space-y-4">
          <h3 className="text-2xl font-serif font-bold text-primary border-b pb-2">It IS</h3>
          <ul className="space-y-3">
            {[
              { icon: "✦", title: "Probabilistic", desc: "Always guessing what comes next. Whether output is true or fabricated, the process is identical." },
              { icon: "✦", title: "Pattern Matching at Scale", desc: "It finds connections humans might miss." },
              { icon: "✦", title: "A Confident Communicator", desc: "It sounds authoritative, even when wrong." },
            ].map((item) => (
              <li key={item.title} className="flex items-start gap-2">
                <span className="text-accent mt-1">{item.icon}</span>
                <span>
                  <strong>{item.title}</strong>
                  <br />
                  <span className="text-muted-foreground text-sm">{item.desc}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="space-y-4">
          <h3 className="text-2xl font-serif font-bold text-destructive border-b pb-2">It Is NOT</h3>
          <ul className="space-y-3">
            {[
              { icon: "✕", title: "Thinking or Knowing", desc: "There is no reasoning. There is prediction." },
              { icon: "✕", title: "Sentient or Caring", desc: "It does not have feelings or intent." },
              { icon: "✕", title: "A Reliable Fact Database", desc: "It is a reasoning engine, not a search engine." },
            ].map((item) => (
              <li key={item.title} className="flex items-start gap-2">
                <span className="text-destructive mt-1">{item.icon}</span>
                <span>
                  <strong>{item.title}</strong>
                  <br />
                  <span className="text-muted-foreground text-sm">{item.desc}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <NotesField sectionId={sectionId} fieldKey="notes" label="Your Notes" />
    </div>
  );
}

export function PersistentContext({ sectionId, title }: SectionProps) {
  const levels = [
    { l: "L1", name: "Custom Instructions", desc: "Basic rules applied to every chat." },
    { l: "L2", name: "Projects / Spaces", desc: "Scoped context for specific workflows." },
    { l: "L3", name: "Custom GPTs", desc: "Shareable, specialized bots with specific knowledge." },
    { l: "RAG", name: "NotebookLM", desc: "Retrieval-Augmented Generation. Highest accuracy on specific docs." },
  ];

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <SectionHeader title={title} type="reference" />

      <div className="bg-card border rounded-lg p-6 mb-8 text-center shadow-sm">
        <h3 className="text-xl font-bold text-primary mb-2">Core Concept</h3>
        <p className="text-foreground font-medium text-lg">Stop re-explaining yourself.</p>
      </div>

      <div className="overflow-x-auto mb-8">
        <table className="w-full border-collapse bg-card rounded-lg overflow-hidden shadow-sm">
          <thead>
            <tr className="bg-primary text-white text-left">
              <th className="p-4 font-semibold w-24">Level</th>
              <th className="p-4 font-semibold">Tool Type</th>
              <th className="p-4 font-semibold">Description</th>
            </tr>
          </thead>
          <tbody>
            {levels.map((lvl, i) => (
              <tr key={lvl.l} className={i % 2 === 0 ? "bg-card" : "bg-secondary/30"}>
                <td className="p-4 border-b font-bold text-accent">{lvl.l}</td>
                <td className="p-4 border-b font-semibold text-primary">{lvl.name}</td>
                <td className="p-4 border-b text-foreground">{lvl.desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <NotesField sectionId={sectionId} fieldKey="notes" label="Your Notes" />
    </div>
  );
}

export function RedYellowGreen({ sectionId, title }: SectionProps) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <SectionHeader title={title} type="exercise" />
      <GoalBox text="Build shared judgment about what's safe." />

      <div className="bg-card p-6 border rounded-lg mb-8 shadow-sm">
        <ol className="list-decimal list-inside space-y-2 text-foreground font-medium">
          <li>Hold your cards</li>
          <li>Discuss disagreements</li>
        </ol>
      </div>

      <DepthQuote>Context dictates risk. What is safe internally may be dangerous externally.</DepthQuote>

      <NotesField sectionId={sectionId} fieldKey="notes" label="Your Notes" />
    </div>
  );
}

export function Capstone({ sectionId, title }: SectionProps) {
  const sixWaysRows = [
    { name: "Draft", def: "Create something new — email, report, talking points, agenda" },
    { name: "Brainstorm", def: "Generate options or ideas (approaches, solutions, alternatives)" },
    { name: "Prepare", def: "Get ready for a conversation (anticipate objections, plan questions)" },
    { name: "Synthesize", def: "Find patterns across sources (themes in feedback, documents)" },
    { name: "Distill", def: "Make complex things clear (policy to plain language, long to short)" },
    { name: "Critique", def: "Evaluate and find weaknesses (check a draft, identify gaps)" },
  ];

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <SectionHeader title={title} type="exercise" />
      <GoalBox text="Build a complete, AI-assisted work product on a real task. Full cycle: prompt, run, verify, revise." />

      <div className="mb-2 text-xs font-bold tracking-widest uppercase text-muted-foreground">The 6 Ways to Use AI</div>

      <div className="overflow-x-auto mb-6">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-primary text-white">
              <th className="text-left p-3 text-xs font-bold tracking-wider uppercase w-32">Use Case</th>
              <th className="text-left p-3 text-xs font-bold tracking-wider uppercase">Definition</th>
            </tr>
          </thead>
          <tbody>
            {sixWaysRows.map((row, i) => (
              <tr key={row.name} className={i % 2 === 0 ? "bg-card" : "bg-secondary/20"}>
                <td className="p-3 font-bold text-accent align-top">{row.name}</td>
                <td className="p-3 text-muted-foreground align-top">{row.def}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-card p-6 border rounded-lg mb-8 shadow-sm">
        {[
          { n: 1, title: "Pick a Real Task", desc: "Choose one from the table above. Genuine work, not invented scenarios." },
          { n: 2, title: "Prime & Prompt", desc: "Use RICECO. Set up persistent context if you're building something reusable." },
          { n: 3, title: "Draft → Verify → Revise", desc: "Run the LLM Council. Verify facts, logic, tone. Apply Power Follow-Ups." },
        ].map((s) => (
          <div key={s.n} className="flex gap-3 items-start mb-4 last:mb-0">
            <div className="w-7 h-7 rounded-full bg-primary text-white font-bold text-sm flex items-center justify-center flex-shrink-0 mt-0.5">
              {s.n}
            </div>
            <div>
              <div className="font-bold text-primary">{s.title}</div>
              <div className="text-sm text-muted-foreground">{s.desc}</div>
            </div>
          </div>
        ))}
      </div>

      <DepthQuote>
        Building something once is a skill. Building something you can reuse and hand to your team is a system.
      </DepthQuote>

      <NotesField sectionId={sectionId} fieldKey="notes" label="Your Notes" />
    </div>
  );
}

export function OvernightAssignment({ sectionId, title }: SectionProps) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <SectionHeader title={title} type="reference" />
      <GoalBox text="Use what you built on one safe task. Come to Day 2 ready to report." />

      <div className="bg-primary text-white p-6 rounded-lg mb-6 shadow-md">
        <h3 className="font-bold text-accent uppercase text-xs tracking-wider mb-2">The Ask</h3>
        <p className="text-white/90">
          Don't try to use AI for everything tonight. Pick <strong className="text-accent">one task</strong> — the one
          from today that felt most promising — and actually use your AI workspace on it before tomorrow.
        </p>
      </div>

      <div className="bg-card border border-border rounded-lg p-5 mb-8">
        <h4 className="text-xs font-bold tracking-wider uppercase text-primary mb-3">Ask Yourself Tonight</h4>
        <ul className="space-y-1.5">
          {[
            "Where do you spend time on something a machine could draft first?",
            "Where do you repeat the same process weekly or monthly?",
            "Where does your team bottleneck waiting on someone to write, summarize, or translate?",
          ].map((q, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
              <span className="text-accent mt-1 flex-shrink-0 text-xs">●</span>
              <span>{q}</span>
            </li>
          ))}
        </ul>
      </div>

      <NotesField sectionId={sectionId} fieldKey="notes" label="Your Notes" />
    </div>
  );
}

export function SixWaysWorksheet({ sectionId, title }: SectionProps) {
  const ways = [
    { name: "DRAFT", example: "First pass at a tricky email" },
    { name: "BRAINSTORM", example: "10 ideas for team offsite" },
    { name: "PREPARE", example: "Roleplay a difficult conversation" },
    { name: "SYNTHESIZE", example: "Find themes in 50 survey responses" },
    { name: "DISTILL", example: "Turn a 20-page report into a 1-pager" },
    { name: "CRITIQUE", example: "Find holes in my project plan" },
  ];

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <SectionHeader title={title} type="reference" />

      <div className="bg-card p-6 border rounded-lg mb-8 shadow-sm">
        <p className="text-foreground font-medium">
          For each use case, write one task you do regularly that AI could help with.
        </p>
      </div>

      <div className="space-y-4 mb-8">
        {ways.map((way) => (
          <div key={way.name} className="bg-card p-4 border rounded-lg shadow-sm">
            <div className="flex items-center justify-between">
              <span className="bg-accent text-primary font-bold px-3 py-1 rounded text-sm uppercase tracking-wider">
                {way.name}
              </span>
              <span className="text-muted-foreground text-sm italic">Ex: {way.example}</span>
            </div>
          </div>
        ))}
      </div>

      <NotesField sectionId={sectionId} fieldKey="notes" label="Your Notes" />
    </div>
  );
}
