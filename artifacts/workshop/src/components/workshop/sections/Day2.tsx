import { SectionHeader, GoalBox, InsightBox, DepthQuote } from "../SectionHeader";
import { NotesField } from "../NotesField";
import { Button } from "@/components/ui/button";

interface SectionProps {
  sectionId: string;
  title: string;
}

export function OvernightHarvest({ sectionId, title }: SectionProps) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <SectionHeader title={title} type="exercise" />
      <GoalBox text="Surface what you learned last night." />

      <div className="bg-card p-6 border rounded-lg mb-8 shadow-sm">
        <ol className="list-decimal list-inside space-y-2 text-foreground font-medium">
          <li>Report out</li>
          <li>Find the pattern</li>
        </ol>
      </div>

      <NotesField sectionId={sectionId} fieldKey="notes" label="Your Notes" />
    </div>
  );
}

export function StatusQuoBias({ sectionId, title }: SectionProps) {
  const biases = [
    { name: "Status Quo Bias", desc: "Preference for the current state of affairs.", imp: "Change is seen as a loss, even if it's an improvement." },
    { name: "Anticipated Regret", desc: "Fear that a change will turn out badly.", imp: "We overweigh the risk of action vs. inaction." },
    { name: "Selection Difficulty", desc: "Too many options causes paralysis.", imp: "When the path isn't clear, we default to doing nothing." },
    { name: "Perceived Cost", desc: "The transition effort feels too high.", imp: "The learning curve obscures the long-term benefit." },
  ];

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <SectionHeader title={title} type="reference" />

      <div className="bg-card border rounded-lg p-6 mb-8 shadow-sm">
        <h3 className="text-xl font-bold text-primary mb-2">Core Concept</h3>
        <p className="text-foreground">
          The "Old Brain" prefers safety and predictability. AI introduces massive unpredictability.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-8">
        {biases.map((b) => (
          <div key={b.name} className="bg-card border p-5 rounded-lg shadow-sm">
            <h4 className="font-bold text-primary text-lg mb-2">{b.name}</h4>
            <p className="text-foreground mb-3">{b.desc}</p>
            <div className="bg-secondary/50 p-3 rounded text-sm">
              <span className="font-semibold text-accent uppercase text-xs mr-2">Implication:</span>
              <span className="text-muted-foreground">{b.imp}</span>
            </div>
          </div>
        ))}
      </div>

      <InsightBox>
        You aren't fighting a lack of information. You are fighting millions of years of evolutionary wiring designed to
        keep people safe.
      </InsightBox>

      <NotesField sectionId={sectionId} fieldKey="notes" label="Your Notes" />
    </div>
  );
}

export function CountyChangeFramework({ sectionId, title }: SectionProps) {
  const steps = [
    { n: 1, title: "Community & Policy Forces", tone: "Empathy / Context" },
    { n: 2, title: "Common Practices", tone: "Validation" },
    { n: 3, title: "Unintended Consequences", tone: "The Pivot" },
    { n: 4, title: "A Stronger Path", tone: "The Solution" },
    { n: 5, title: "Measurable Impact", tone: "The Result" },
  ];

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <SectionHeader title={title} type="reference" />

      <div className="bg-card border rounded-lg p-6 mb-12 shadow-sm">
        <p className="text-foreground">
          A structured narrative for moving teams from resistance to adoption by validating their current reality before
          introducing the change.
        </p>
      </div>

      <div className="relative mb-12">
        <div className="absolute left-[27px] top-4 bottom-4 w-1 bg-border hidden md:block"></div>
        <div className="space-y-6">
          {steps.map((s) => (
            <div key={s.n} className="flex flex-col md:flex-row items-start gap-4 md:gap-6 relative">
              <div className="w-14 h-14 rounded-full bg-primary text-white font-bold text-xl flex items-center justify-center flex-shrink-0 z-10 shadow-md">
                {s.n}
              </div>
              <div className="bg-card border rounded-lg p-5 flex-1 shadow-sm mt-2 md:mt-0">
                <h4 className="font-bold text-primary text-lg mb-1">{s.title}</h4>
                <p className="text-muted-foreground text-sm uppercase tracking-wider font-semibold">Tone: {s.tone}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <DepthQuote>Logic tells us what to do. Emotion tells us to do it.</DepthQuote>

      <NotesField sectionId={sectionId} fieldKey="notes" label="Your Notes" />
    </div>
  );
}

export function CountyChangeMessage({ sectionId, title }: SectionProps) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <SectionHeader title={title} type="exercise" />
      <GoalBox text="Draft a change narrative tailored to your county's context." />

      <div className="bg-primary/5 p-6 rounded-lg border border-primary/20 mb-8">
        <h3 className="text-2xl font-serif font-bold text-primary mb-2">Key Shift Statements</h3>
        <p className="text-muted-foreground mb-4 font-medium">3 required, under 15 words each.</p>

        <div className="bg-white p-4 rounded border text-sm text-foreground shadow-sm">
          <strong className="text-primary block mb-1 uppercase text-xs tracking-wider">Coaching Hint</strong>
          Use only:<br />
          <span className="italic text-muted-foreground">
            "You're focused on X, but the real advantage is Y."
          </span>
          <br />
          or<br />
          <span className="italic text-muted-foreground">
            "You don't have an X problem. You have a Y problem."
          </span>
        </div>
      </div>

      <NotesField sectionId={sectionId} fieldKey="notes" label="Your Notes" />
    </div>
  );
}

export function Closing({ sectionId, title }: SectionProps) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <SectionHeader title={title} type="reference" />

      <div className="py-12 px-6 bg-primary text-white rounded-lg text-center shadow-lg my-12 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-accent"></div>
        <p className="font-serif text-2xl md:text-3xl leading-relaxed font-bold">
          "Small things.<br />
          Unlikely places.<br />
          Extraordinary work."
        </p>
        <div className="mt-8 text-primary-foreground/80 italic font-medium">
          You don't have to be first, but you have to be ready.
        </div>
      </div>

      <NotesField sectionId={sectionId} fieldKey="notes" label="Your Notes" />

      <div className="flex justify-center pt-8 mt-8 border-t">
        <Button
          size="lg"
          className="h-14 px-8 text-lg font-bold shadow-md hover:shadow-lg transition-shadow"
          asChild
        >
          <a href="https://headandheartca.com/close" target="_blank" rel="noopener noreferrer">
            Complete Workshop Survey
          </a>
        </Button>
      </div>
    </div>
  );
}
