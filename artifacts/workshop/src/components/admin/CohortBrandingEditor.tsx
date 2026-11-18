import { useGetAppSettings, useUploadCohortLogo, type CohortSettings, type CohortLogo } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { talkCards } from "@/lib/cohort-branding";
import { ArrowUp, ArrowDown, Trash2 } from "lucide-react";

export function CohortBrandingEditor({ value, onChange }: { value: CohortSettings; onChange: (value: CohortSettings) => void }) {
  const { data: appSettings } = useGetAppSettings();
  const upload = useUploadCohortLogo();
  const { toast } = useToast();
  const logos = value.logos ?? [{ type: "builtin" } as CohortLogo];
  const setLogos = (next: CohortLogo[]) => onChange({ ...value, logos: next });
  const defaults = talkCards(undefined, (appSettings as Record<string, string>)?.talk_with_anthony_url)[0];
  const move = (index: number, direction: number) => {
    const next = [...logos];
    [next[index], next[index + direction]] = [next[index + direction], next[index]];
    setLogos(next);
  };
  return <div className="space-y-5 border-t pt-4">
    <section className="space-y-2">
      <h3 className="font-medium">Logos</h3>
      <p className="text-xs text-muted-foreground">Up to 3, shown in this order. PNG, JPG or SVG, up to 2 MB each.</p>
      {logos.map((logo, index) => <div className="flex items-center gap-2" key={index}>
        <span className="flex-1 text-sm truncate">{logo.type === "builtin" ? "IQmeetEQ (built in)" : logo.name}</span>
        <Button type="button" size="icon" variant="outline" aria-label={`Move logo ${index + 1} up`} disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp className="h-4 w-4" /></Button>
        <Button type="button" size="icon" variant="outline" aria-label={`Move logo ${index + 1} down`} disabled={index === logos.length - 1} onClick={() => move(index, 1)}><ArrowDown className="h-4 w-4" /></Button>
        <Button type="button" size="icon" variant="outline" aria-label={`Remove logo ${index + 1}`} onClick={() => setLogos(logos.filter((_, i) => i !== index))}><Trash2 className="h-4 w-4" /></Button>
      </div>)}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" disabled={logos.length >= 3 || upload.isPending} onClick={() => setLogos([...logos, { type: "builtin" }])}>Add IQmeetEQ</Button>
        <Input type="file" accept=".png,.jpg,.jpeg,.svg" aria-label="Upload logo" className="max-w-xs" disabled={logos.length >= 3 || upload.isPending} onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          if (file.size > 2 * 1024 * 1024) { toast({ title: "Logo must be 2 MB or smaller", variant: "destructive" }); return; }
          try {
            const dataBase64 = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(String(reader.result).split(",")[1]);
              reader.onerror = reject;
              reader.readAsDataURL(file);
            });
            const logo = await upload.mutateAsync({ data: { filename: file.name, mimeType: file.type as "image/png" | "image/jpeg" | "image/svg+xml", dataBase64 } });
            setLogos([...logos, logo]);
          } catch (error) {
            toast({ title: "Could not upload logo", description: error instanceof Error ? error.message : "Try a PNG, JPG or safe SVG.", variant: "destructive" });
          }
        }} />
      </div>
      {upload.isPending && <p className="text-sm">Uploading logo…</p>}
    </section>
    <section className="space-y-3">
      <h3 className="font-medium">Talk cards</h3>
      {[0, 1].map((index) => <fieldset key={index} className="border rounded-md p-3 space-y-2">
        <legend className="px-1 text-sm">Card {index + 1}{index === 1 ? " (optional)" : ""}</legend>
        {(["label", "title", "description", "link"] as const).map((field) => <div key={field}>
          <Label htmlFor={`talk-${index}-${field}`}>{field === "label" ? "Small label" : field.charAt(0).toUpperCase() + field.slice(1)}</Label>
          <Input id={`talk-${index}-${field}`} value={value.talkCards?.[index]?.[field] ?? ""} placeholder={index === 0 ? defaults[field] : ""} onChange={(e) => {
            const cards = [value.talkCards?.[0] ?? {}, value.talkCards?.[1] ?? {}];
            cards[index] = { ...cards[index], [field]: e.target.value };
            onChange({ ...value, talkCards: cards });
          }} />
        </div>)}
      </fieldset>)}
      <p className="text-xs text-muted-foreground">Card 2 appears only when its title and link are filled in.</p>
    </section>
  </div>;
}
