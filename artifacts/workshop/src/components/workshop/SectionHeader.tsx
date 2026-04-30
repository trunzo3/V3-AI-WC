import { Badge } from "@/components/ui/badge";

interface SectionHeaderProps {
  title: string;
  type: "exercise" | "reference";
}

export function SectionHeader({ title, type }: SectionHeaderProps) {
  return (
    <div className="mb-8 border-b-2 border-primary pb-4">
      <div className="flex items-center gap-3 mb-2">
        <Badge 
          variant="outline" 
          className={`uppercase tracking-wider font-semibold ${
            type === "exercise" 
              ? "bg-accent/10 text-accent border-accent" 
              : "bg-primary/10 text-primary border-primary"
          }`}
        >
          {type}
        </Badge>
      </div>
      <h1 className="text-3xl md:text-4xl font-serif font-bold text-foreground">{title}</h1>
    </div>
  );
}

export function InsightBox({ children, className = "" }: { children: React.ReactNode, className?: string }) {
  return (
    <div className={`bg-primary text-white p-6 rounded-r-lg border-l-4 border-accent my-6 ${className}`}>
      {children}
    </div>
  );
}

export function GoalBox({ text }: { text: string }) {
  return (
    <div className="bg-secondary/50 p-5 rounded-lg border border-border mb-6">
      <p className="font-semibold text-primary">
        <span className="uppercase text-xs tracking-wider text-muted-foreground block mb-1">Goal</span>
        {text}
      </p>
    </div>
  );
}

export function RuleBox({ title, children }: { title?: string, children: React.ReactNode }) {
  return (
    <div className="border-l-4 border-accent pl-4 py-2 my-6">
      {title && <h4 className="font-bold text-primary mb-1">{title}</h4>}
      <div className="text-foreground">{children}</div>
    </div>
  );
}

export function DepthQuote({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-center my-12">
      <p className="italic text-muted-foreground text-lg font-serif">
        "{children}"
      </p>
    </div>
  );
}
