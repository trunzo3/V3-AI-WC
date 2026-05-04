import { useState, useEffect, useRef, useCallback } from "react";
import {
  useGetWorkflowMap,
  useUpsertWorkflowMap,
  getGetWorkflowMapQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { SectionHeader, GoalBox, DepthQuote } from "../SectionHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { NotesField } from "../NotesField";

interface Workflow {
  id: string;
  name: string;
  frequency: string;
  currentSteps: string[];
  redesignedSteps: string[];
  verificationCheckpoints: string;
  stopConditions: string;
}

interface WorkflowMapData {
  workflows: Workflow[];
}

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `wf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const emptyWorkflow = (): Workflow => ({
  id: newId(),
  name: "New Workflow",
  frequency: "",
  currentSteps: [],
  redesignedSteps: [],
  verificationCheckpoints: "",
  stopConditions: "",
});

function StepList({
  steps,
  title,
  onChange,
}: {
  steps: string[];
  title: string;
  onChange: (steps: string[]) => void;
}) {
  const updateStep = (index: number, value: string) => {
    const next = [...steps];
    next[index] = value;
    onChange(next);
  };
  const removeStep = (index: number) => onChange(steps.filter((_, i) => i !== index));
  const moveStep = (index: number, direction: "up" | "down") => {
    if (direction === "up" && index > 0) {
      const next = [...steps];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      onChange(next);
    } else if (direction === "down" && index < steps.length - 1) {
      const next = [...steps];
      [next[index + 1], next[index]] = [next[index], next[index + 1]];
      onChange(next);
    }
  };
  const addStep = () => onChange([...steps, ""]);

  return (
    <div className="space-y-4">
      <h4 className="font-bold text-primary uppercase text-sm tracking-wider border-b pb-2">{title}</h4>
      <div className="space-y-2">
        {steps.map((step, index) => (
          <div key={index} className="flex items-start gap-2 bg-secondary/20 p-2 rounded border">
            <div className="flex flex-col gap-1 mt-1">
              <button
                onClick={() => moveStep(index, "up")}
                disabled={index === 0}
                className="text-muted-foreground hover:text-primary disabled:opacity-30"
                aria-label="Move step up"
              >
                <ChevronUp className="w-4 h-4" />
              </button>
              <button
                onClick={() => moveStep(index, "down")}
                disabled={index === steps.length - 1}
                className="text-muted-foreground hover:text-primary disabled:opacity-30"
                aria-label="Move step down"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1">
              <Textarea
                value={step}
                onChange={(e) => updateStep(index, e.target.value)}
                placeholder={`Step ${index + 1}`}
                className="min-h-[60px] resize-none"
              />
            </div>
            <button
              onClick={() => removeStep(index)}
              className="text-muted-foreground hover:text-destructive mt-2 p-1"
              aria-label="Remove step"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
      <Button variant="outline" size="sm" onClick={addStep} className="w-full mt-2">
        <Plus className="w-4 h-4 mr-2" /> Add Step
      </Button>
    </div>
  );
}

function WorkflowEditor({
  workflow,
  onChange,
  onDelete,
}: {
  workflow: Workflow;
  onChange: (next: Workflow) => void;
  onDelete: () => void;
}) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const update = (patch: Partial<Workflow>) => onChange({ ...workflow, ...patch });

  return (
    <Card className="mb-8 border-primary/20 shadow-md">
      <CardHeader className="bg-secondary/30 border-b flex flex-row items-center justify-between pb-4">
        <div className="flex-1 mr-4 space-y-4">
          <div>
            <Label className="text-xs uppercase font-bold text-muted-foreground">Workflow Name</Label>
            <Input
              value={workflow.name}
              onChange={(e) => update({ name: e.target.value })}
              className="text-lg font-bold bg-transparent border-none px-0 h-auto focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground/50"
              placeholder="Untitled Workflow"
            />
          </div>
          <div>
            <Label className="text-xs uppercase font-bold text-muted-foreground">Frequency</Label>
            <Input
              value={workflow.frequency}
              onChange={(e) => update({ frequency: e.target.value })}
              className="bg-background"
              placeholder="e.g., Daily, Weekly, Monthly"
            />
          </div>
        </div>
        <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <DialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
              aria-label="Delete workflow"
            >
              <Trash2 className="w-5 h-5" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Workflow?</DialogTitle>
            </DialogHeader>
            <p className="py-4">Are you sure you want to delete this workflow map? This cannot be undone.</p>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
              <Button
                variant="destructive"
                onClick={() => {
                  onDelete();
                  setDeleteOpen(false);
                }}
              >
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>

      <CardContent className="p-6">
        <div className="grid md:grid-cols-2 gap-8 mb-8">
          <StepList
            title="Today — How It Works"
            steps={workflow.currentSteps}
            onChange={(steps) => update({ currentSteps: steps })}
          />
          <StepList
            title="With AI — Redesigned"
            steps={workflow.redesignedSteps}
            onChange={(steps) => update({ redesignedSteps: steps })}
          />
        </div>

        <div className="grid md:grid-cols-2 gap-8 border-t pt-6 mt-6">
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-primary uppercase tracking-wider">
              Human Verification Checkpoints
            </Label>
            <Textarea
              value={workflow.verificationCheckpoints}
              onChange={(e) => update({ verificationCheckpoints: e.target.value })}
              placeholder="Where must a human review the output?"
              className="min-h-[100px]"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-primary uppercase tracking-wider">Stop Conditions</Label>
            <Textarea
              value={workflow.stopConditions}
              onChange={(e) => update({ stopConditions: e.target.value })}
              placeholder="When should we abandon the AI approach for this task?"
              className="min-h-[100px]"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function WorkflowConfigurator({
  sectionId,
  title,
}: {
  sectionId: string;
  title: string;
}) {
  const qc = useQueryClient();
  const { data: mapResp, isSuccess } = useGetWorkflowMap();
  const upsertMutation = useUpsertWorkflowMap();

  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const initialized = useRef(false);
  const lastSaved = useRef<string>("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hydrate from server once.
  useEffect(() => {
    if (initialized.current || !isSuccess) return;
    const raw = (mapResp as any)?.workflowMap?.data;
    let parsed: WorkflowMapData = { workflows: [] };
    try {
      if (raw && typeof raw === "object" && "workflows" in raw) {
        parsed = raw as WorkflowMapData;
      } else if (typeof raw === "string") {
        parsed = JSON.parse(raw);
      }
    } catch {}
    const list = Array.isArray(parsed.workflows) ? parsed.workflows : [];
    setWorkflows(list);
    lastSaved.current = JSON.stringify({ workflows: list });
    initialized.current = true;
  }, [isSuccess, mapResp]);

  // Debounced save.
  useEffect(() => {
    if (!initialized.current) return;
    const payload = JSON.stringify({ workflows });
    if (payload === lastSaved.current) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      upsertMutation.mutate(
        { data: { data: { workflows } } as any },
        {
          onSuccess: () => {
            lastSaved.current = payload;
            qc.invalidateQueries({ queryKey: getGetWorkflowMapQueryKey() });
          },
        },
      );
    }, 1000);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [workflows, qc, upsertMutation]);

  const addWorkflow = useCallback(() => {
    setWorkflows((prev) => [...prev, emptyWorkflow()]);
  }, []);

  const updateWorkflow = useCallback((id: string, next: Workflow) => {
    setWorkflows((prev) => prev.map((w) => (w.id === id ? next : w)));
  }, []);

  const deleteWorkflow = useCallback((id: string) => {
    setWorkflows((prev) => prev.filter((w) => w.id !== id));
  }, []);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 border-b-2 border-primary pb-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="bg-accent/10 text-accent border border-accent px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider">
              Flagship Exercise
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-serif font-bold text-foreground">{title}</h1>
        </div>
        <Button onClick={addWorkflow} className="whitespace-nowrap" data-testid="button-add-workflow">
          <Plus className="w-4 h-4 mr-2" /> New Workflow Map
        </Button>
      </div>

      <GoalBox text="Produce a one-page, deployable workflow document." />

      {workflows.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed rounded-lg bg-secondary/10">
          <p className="text-muted-foreground mb-4">No workflow maps yet.</p>
          <Button onClick={addWorkflow} variant="outline">
            Create your first map
          </Button>
        </div>
      ) : (
        <div className="space-y-8">
          {[...workflows].reverse().map((wf) => (
            <WorkflowEditor
              key={wf.id}
              workflow={wf}
              onChange={(next) => updateWorkflow(wf.id, next)}
              onDelete={() => deleteWorkflow(wf.id)}
            />
          ))}
        </div>
      )}

      <DepthQuote>A good workflow removes the need for brilliant execution every time.</DepthQuote>

      <div className="border-t pt-8 mt-8">
        <NotesField sectionId={sectionId} fieldKey="notes" label="Your Notes" />
      </div>
    </div>
  );
}
