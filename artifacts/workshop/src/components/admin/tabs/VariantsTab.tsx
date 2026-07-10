import { useEffect, useMemo, useState } from "react";
import { isAdminAuthError } from "@/lib/auth";
import {
  useAdminListCohortVariants,
  useAdminUpsertCohortVariant,
  getAdminListCohortVariantsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import { VARIANT_SECTIONS, type VariantSlot } from "../variant-slots";

interface Props {
  cohortId: number;
}

interface SlotEditorProps {
  cohortId: number;
  sectionId: string;
  slot: VariantSlot;
  current?: string;
}

function SlotEditor({ cohortId, sectionId, slot, current }: SlotEditorProps) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [val, setVal] = useState<string>(current ?? "");
  useEffect(() => {
    setVal(current ?? "");
  }, [current]);

  const mut = useAdminUpsertCohortVariant();
  const isOverride = (current ?? "") !== "";

  const save = () => {
    mut.mutate(
      { cohortId, data: { sectionId, blockKey: slot.blockKey, content: val } },
      {
        onSuccess: () => {
          qc.invalidateQueries({
            queryKey: getAdminListCohortVariantsQueryKey(cohortId),
          });
          toast({ title: val === "" ? "Override cleared" : "Override saved" });
        },
        onError: (err) => { if (isAdminAuthError(err)) return; toast({ title: "Save failed", variant: "destructive" }); },
      },
    );
  };

  const clear = () => {
    setVal("");
    mut.mutate(
      { cohortId, data: { sectionId, blockKey: slot.blockKey, content: "" } },
      {
        onSuccess: () => {
          qc.invalidateQueries({
            queryKey: getAdminListCohortVariantsQueryKey(cohortId),
          });
          toast({ title: "Override cleared — defaults restored" });
        },
        onError: (err) => { if (isAdminAuthError(err)) return; toast({ title: "Clear failed", variant: "destructive" }); },
      },
    );
  };

  return (
    <div className="space-y-3 border-t pt-3 first:border-t-0 first:pt-0">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-medium">
            {slot.label}{" "}
            <span className="font-mono text-xs text-muted-foreground">
              ({slot.blockKey})
            </span>
          </div>
          <div className="text-xs text-muted-foreground">{slot.description}</div>
        </div>
        <Badge variant={isOverride ? "default" : "outline"}>
          {isOverride ? "Override active" : "Using default"}
        </Badge>
      </div>
      <div>
        <div className="text-xs uppercase tracking-widest text-muted-foreground mb-1">
          Default content
        </div>
        <Textarea
          value={slot.defaultContent}
          readOnly
          rows={Math.min(8, slot.defaultContent.split("\n").length + 1)}
          className="font-mono text-xs bg-muted/40"
        />
      </div>
      <div>
        <div className="text-xs uppercase tracking-widest text-muted-foreground mb-1">
          This cohort's override
        </div>
        <Textarea
          value={val}
          rows={Math.max(6, val.split("\n").length + 1)}
          onChange={(e) => setVal(e.target.value)}
          placeholder="(empty = use default)"
          className="font-mono text-xs"
          data-testid={`textarea-variant-${sectionId}-${slot.blockKey}`}
        />
      </div>
      <div className="flex gap-2 justify-end">
        <Button
          variant="ghost"
          onClick={clear}
          disabled={!isOverride && val === ""}
          data-testid={`button-clear-variant-${sectionId}-${slot.blockKey}`}
        >
          Clear override
        </Button>
        <Button
          onClick={save}
          disabled={mut.isPending}
          data-testid={`button-save-variant-${sectionId}-${slot.blockKey}`}
        >
          Save override
        </Button>
      </div>
    </div>
  );
}

export function VariantsTab({ cohortId }: Props) {
  const { data } = useAdminListCohortVariants(cohortId);
  const variants = data?.variants ?? [];

  const valueOf = useMemo(
    () =>
      (sectionId: string, blockKey: string) =>
        variants.find(
          (v) => v.sectionId === sectionId && v.blockKey === blockKey,
        )?.content,
    [variants],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Content variants</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4">
          Override the default text shown inside hardcoded sections for this
          cohort. Leave a field empty (and click Clear override) to fall back to
          the default.
        </p>
        <Accordion type="multiple" defaultValue={VARIANT_SECTIONS.map((s) => s.sectionId)}>
          {VARIANT_SECTIONS.map((sec) => (
            <AccordionItem key={sec.sectionId} value={sec.sectionId}>
              <AccordionTrigger data-testid={`variant-section-${sec.sectionId}`}>
                {sec.title}
              </AccordionTrigger>
              <AccordionContent className="space-y-4">
                {sec.slots.map((slot) => (
                  <SlotEditor
                    key={slot.blockKey}
                    cohortId={cohortId}
                    sectionId={sec.sectionId}
                    slot={slot}
                    current={valueOf(sec.sectionId, slot.blockKey)}
                  />
                ))}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  );
}
