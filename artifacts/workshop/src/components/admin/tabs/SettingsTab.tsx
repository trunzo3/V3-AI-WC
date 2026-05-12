import { useEffect, useMemo, useState } from "react";
import {
  useAdminListSettings,
  useAdminUpsertSetting,
  getAdminListSettingsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Save, Download } from "lucide-react";

const KNOWN_SETTINGS: { key: string; label: string; placeholder?: string }[] = [
  {
    key: "talk_with_anthony_url",
    label: "Talk with Anthony — Calendly link",
    placeholder: "https://calendly.com/...",
  },
  {
    key: "feedback_intro",
    label: "Feedback dialog intro text",
  },
];

export function SettingsTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading } = useAdminListSettings();
  const settings = data?.settings ?? [];

  const map = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of settings) m.set(s.key, s.value);
    return m;
  }, [settings]);

  const [values, setValues] = useState<Record<string, string>>({});
  useEffect(() => {
    const next: Record<string, string> = {};
    for (const s of settings) next[s.key] = s.value;
    for (const k of KNOWN_SETTINGS) if (!(k.key in next)) next[k.key] = "";
    setValues(next);
  }, [settings]);

  const upsertMut = useAdminUpsertSetting();
  const refresh = () =>
    qc.invalidateQueries({ queryKey: getAdminListSettingsQueryKey() });

  const save = (key: string) => {
    upsertMut.mutate(
      { data: { key, value: values[key] ?? "" } },
      {
        onSuccess: () => {
          toast({ title: `Saved ${key}` });
          refresh();
        },
        onError: () =>
          toast({ title: "Save failed", variant: "destructive" }),
      },
    );
  };

  const downloadExport = async () => {
    try {
      const res = await fetch("/api/admin/export", { credentials: "include" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const today = new Date().toISOString().slice(0, 10);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `iqmeeteq-backup-${today}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast({ title: "Backup downloaded" });
    } catch {
      toast({ title: "Export failed", variant: "destructive" });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>App settings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : (
          <>
            {KNOWN_SETTINGS.map((cfg) => {
              const stored = map.get(cfg.key) ?? "";
              const draft = values[cfg.key] ?? "";
              const dirty = draft !== stored;
              return (
                <div key={cfg.key} className="space-y-1">
                  <Label className="text-sm font-medium">{cfg.label}</Label>
                  <div className="text-xs text-muted-foreground font-mono">
                    {cfg.key}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={draft}
                      placeholder={cfg.placeholder}
                      onChange={(e) =>
                        setValues({ ...values, [cfg.key]: e.target.value })
                      }
                      data-testid={`input-setting-${cfg.key}`}
                    />
                    <Button
                      onClick={() => save(cfg.key)}
                      disabled={!dirty || upsertMut.isPending}
                      data-testid={`button-save-setting-${cfg.key}`}
                    >
                      <Save className="w-4 h-4 mr-2" />
                      Save
                    </Button>
                  </div>
                </div>
              );
            })}
            <div className="pt-6 mt-2 border-t">
              <h3 className="text-base font-semibold text-primary mb-1">
                Data Management
              </h3>
              <p className="text-sm text-muted-foreground mb-3">
                Download a JSON backup of every cohort, participant, note, and
                configuration row in the system. File metadata is included
                without raw file contents.
              </p>
              <Button
                onClick={downloadExport}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                data-testid="button-export-data"
              >
                <Download className="w-4 h-4 mr-2" />
                Export All Data (JSON)
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
