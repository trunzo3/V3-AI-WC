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
import { Save } from "lucide-react";

const KNOWN_SETTINGS: { key: string; label: string; placeholder?: string }[] = [
  {
    key: "talk_with_anthony_url",
    label: "Talk with Anthony — Calendly link",
    placeholder: "https://calendly.com/...",
  },
  {
    key: "support_email",
    label: "Support email",
    placeholder: "support@example.com",
  },
  {
    key: "feedback_intro",
    label: "Feedback dialog intro text",
  },
];

const KNOWN_KEYS = new Set(KNOWN_SETTINGS.map((s) => s.key));

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

  const customRows = settings.filter((s) => !KNOWN_KEYS.has(s.key));

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

            {customRows.length > 0 && (
              <div className="pt-4 border-t space-y-3">
                <div className="text-xs uppercase tracking-widest text-muted-foreground">
                  Custom keys
                </div>
                {customRows.map((s) => {
                  const draft = values[s.key] ?? "";
                  const dirty = draft !== s.value;
                  return (
                    <div key={s.key} className="space-y-1">
                      <Label className="text-sm font-mono">{s.key}</Label>
                      <div className="flex gap-2">
                        <Input
                          value={draft}
                          onChange={(e) =>
                            setValues({ ...values, [s.key]: e.target.value })
                          }
                          data-testid={`input-setting-${s.key}`}
                        />
                        <Button
                          onClick={() => save(s.key)}
                          disabled={!dirty || upsertMut.isPending}
                        >
                          <Save className="w-4 h-4 mr-2" />
                          Save
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
