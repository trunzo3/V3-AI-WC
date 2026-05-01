import { useState } from "react";
import { useLocation } from "wouter";
import {
  useUpsertFeedback,
  useListFeedbackCategories,
  useGetAppSettings,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getSession } from "@/lib/auth";
import { useEffect } from "react";

const levels = [
  {
    num: 1,
    name: "Question Asker",
    tagline: "Using AI like a fancier search engine",
    bullets: [
      "One-off questions, no thought about framing",
      "Occasionally useful, not transformative",
      "Unaware that how you ask changes results",
    ],
  },
  {
    num: 2,
    name: "Prompt Crafter",
    tagline: "Realizing the prompt is the lever",
    bullets: [
      "Adds context, constraints, and examples",
      "Lets AI ask clarifying questions first",
      "Saves prompts that worked",
    ],
  },
  {
    num: 3,
    name: "Power User",
    tagline: "Context baked in — no more starting from scratch",
    bullets: [
      "Uses Projects with persistent instructions",
      "Files and tone carry across conversations",
      "Chooses deliberately between models",
    ],
  },
  {
    num: 4,
    name: "Workflow Weaver",
    tagline: "Right tool for each job, not one tool for all",
    bullets: [
      "Pulls in NotebookLM, image gen, meeting tools",
      "Prototypes interactive tools without code",
      "Combines tools in ways previously impossible",
    ],
  },
  {
    num: 5,
    name: "Builder",
    tagline: "Build something that does this for me",
    bullets: [
      "Automations that run without touching them",
      "Dashboards, apps, and portals for real use",
      "Sees repetitive tasks as systems to build",
    ],
  },
  {
    num: 6,
    name: "Architect",
    tagline: "Every slow process is a system waiting to be designed",
    bullets: [
      "Builds production software from descriptions",
      "Multi-agent workflows that orchestrate other agents",
      "Doesn't see problems anymore — sees systems",
    ],
  },
];

export default function LevelsPage() {
  const [, setLocation] = useLocation();
  const session = getSession();
  const [activeLevel, setActiveLevel] = useState(1);
  const level = levels[activeLevel - 1]!;
  const [feedbackText, setFeedbackText] = useState("");
  const [category, setCategory] = useState<string>("");
  const feedbackMutation = useUpsertFeedback();
  const { data: catsResp } = useListFeedbackCategories();
  const categories = catsResp?.categories ?? [];
  const { data: settings } = useGetAppSettings();
  const feedbackIntro =
    (settings as Record<string, string> | undefined)?.["feedback_intro"]?.trim() ||
    "Tell us what you're working on, what you're stuck on, or what you'd like to go deeper on.";
  const { toast } = useToast();

  useEffect(() => {
    if (!session) setLocation("/");
  }, [session, setLocation]);

  if (!session) return null;

  const submitFeedback = () => {
    if (!feedbackText.trim()) return;
    feedbackMutation.mutate(
      {
        data: {
          content: feedbackText,
          category: category || undefined,
        } as any,
      },
      {
        onSuccess: () => {
          toast({ title: "Submitted", description: "Thank you for your thoughts!" });
          setFeedbackText("");
          setCategory("");
        },
        onError: () => {
          toast({
            variant: "destructive",
            title: "Error",
            description: "Could not submit feedback.",
          });
        },
      },
    );
  };

  return (
    <div className="min-h-[100dvh] bg-background">
      <header className="bg-primary text-white px-6 py-3 flex items-center justify-between border-b border-primary/20">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => setLocation("/home")}>
          <Logo variant="white" className="scale-75 origin-left" />
        </div>
        <button
          onClick={() => setLocation("/home")}
          className="text-sm text-white/80 hover:text-white transition-colors"
        >
          ← Back to vestibule
        </button>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-10">
        <div className="mb-8 border-b-2 border-primary pb-4">
          <div className="text-xs font-bold tracking-widest uppercase text-accent mb-2">Self-Assessment</div>
          <h1 className="text-3xl md:text-4xl font-serif font-bold text-foreground">Where Are You on the Path?</h1>
          <p className="text-sm text-muted-foreground mt-2">Six levels of fluency. Find yours.</p>
        </div>

        <div className="flex border-b border-border mb-6 overflow-x-auto">
          {levels.map((l) => (
            <button
              key={l.num}
              onClick={() => setActiveLevel(l.num)}
              className={`flex-1 min-w-[80px] text-center py-3 px-1 border-b-2 transition-colors ${
                activeLevel === l.num
                  ? "border-accent text-primary font-medium"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
              data-testid={`level-tab-${l.num}`}
            >
              <div
                className={`w-9 h-9 rounded-full border-2 mx-auto mb-1 flex items-center justify-center text-sm font-bold transition-colors ${
                  activeLevel === l.num
                    ? "bg-primary text-white border-primary"
                    : "border-border text-muted-foreground"
                }`}
              >
                {l.num}
              </div>
              <div className="text-xs leading-tight hidden sm:block">{l.name}</div>
            </button>
          ))}
        </div>

        <div className="bg-secondary/30 rounded-lg p-6 border">
          <div className="text-xs font-bold tracking-widest uppercase text-muted-foreground mb-1">
            Level {level.num}
          </div>
          <h3 className="text-2xl font-serif font-bold text-primary mb-1">{level.name}</h3>
          <div className="text-sm text-accent italic font-medium mb-4">{level.tagline}</div>
          <ul className="space-y-2">
            {level.bullets.map((b, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                <span className="text-accent mt-0.5 flex-shrink-0">◦</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
          <div className="mt-6 flex justify-end">
            <Button
              onClick={() => setLocation("/workshop")}
              data-testid="button-enter-workshop"
            >
              Enter the Workshop
            </Button>
          </div>
        </div>

        <div className="mt-10 border-t border-border pt-8">
          <h4 className="text-base font-bold text-primary mb-2">What should we teach next?</h4>
          <p className="text-sm text-muted-foreground mb-4 whitespace-pre-wrap">
            {feedbackIntro}
          </p>

          {categories.length > 0 && (
            <div className="mb-3">
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="w-full md:w-72" data-testid="select-feedback-category">
                  <SelectValue placeholder="Select a category (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.name}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <Textarea
            placeholder="Share your thoughts..."
            value={feedbackText}
            onChange={(e) => setFeedbackText(e.target.value)}
            className="min-h-[120px] mb-3"
            data-testid="input-feedback-levels"
          />
          <Button
            onClick={submitFeedback}
            disabled={feedbackMutation.isPending || !feedbackText.trim()}
            data-testid="button-submit-feedback-levels"
          >
            {feedbackMutation.isPending ? "Submitting..." : "Submit"}
          </Button>
        </div>
      </main>
    </div>
  );
}
