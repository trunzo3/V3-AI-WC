import { useEffect, useState } from "react";
import { useAdminListSettings, useAdminUpsertSetting, getAdminListSettingsQueryKey, getGetAppSettingsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export function FeedbackIntroEditor() {
  const { data, isLoading } = useAdminListSettings();
  const stored = data?.settings.find(s => s.key === "feedback_intro")?.value ?? "";
  const [value, setValue] = useState("");
  useEffect(() => setValue(stored), [stored]);
  const mutation = useAdminUpsertSetting();
  const qc = useQueryClient();
  const { toast } = useToast();
  return <Card>
    <CardHeader><CardTitle>Feedback dialog intro text</CardTitle></CardHeader>
    <CardContent className="space-y-2">
      <p className="text-sm text-muted-foreground">Shown in the feedback dialog and on the self-assessment page for every workshop.</p>
      <div className="flex gap-2">
        <Input aria-label="Feedback dialog intro text" data-testid="input-setting-feedback_intro" value={value} disabled={isLoading} onChange={e => setValue(e.target.value)} />
        <Button data-testid="button-save-setting-feedback_intro" disabled={isLoading || mutation.isPending || value === stored} onClick={() => mutation.mutate({ data: { key: "feedback_intro", value } }, {
          onSuccess: () => {
            void qc.invalidateQueries({ queryKey: getAdminListSettingsQueryKey() });
            void qc.invalidateQueries({ queryKey: getGetAppSettingsQueryKey() });
            toast({ title: "Feedback intro saved" });
          },
          onError: () => toast({ title: "Save failed", variant: "destructive" }),
        })}>Save</Button>
      </div>
    </CardContent>
  </Card>;
}
