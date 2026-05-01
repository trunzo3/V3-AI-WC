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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Save } from "lucide-react";

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

  // ----- New custom setting dialog -----
  const [open, setOpen] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newVal, setNewVal] = useState("");
  const createCustom = () => {
    if (!newKey.trim()) {
      toast({ title: "Key required", variant: "destructive" });
      return;
    }
    upsertMut.mutate(
      { data: { key: newKey.trim(), value: newVal } },
      {
        onSuccess: () => {
          toast({ title: "Setting saved" });
          refresh();
          setOpen(false);
          setNewKey("");
          setNewVal("");
        },
        onError: () =>
          toast({ title: "Save failed", variant: "destructive" }),
      },
    );
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>App settings</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" data-testid="button-new-setting">
              <Plus className="w-4 h-4 mr-2" />
              Add custom key
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add custom setting</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Key</Label>
                <Input
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  placeholder="lower_snake_case"
                />
              </div>
              <div>
                <Label>Value</Label>
                <Input
                  value={newVal}
                  onChange={(e) => setNewVal(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={createCustom} disabled={upsertMut.isPending}>
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
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
