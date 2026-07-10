import { useEffect } from "react";
import { useAutoSave } from "@/hooks/use-auto-save";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

interface NotesFieldProps {
  sectionId: string;
  fieldKey: string;
  label: string;
  placeholder?: string;
  /** Optional admin-authored rich HTML (sanitized server-side) rendered between the label and the input. */
  helpText?: string;
  initialValue?: string;
  className?: string;
  minHeight?: string;
  multiline?: boolean;
  /** Reports the current value upward on every change (used by form blocks to assemble copy text). */
  onValueChange?: (fieldKey: string, value: string) => void;
}

export function NotesField({ sectionId, fieldKey, label, placeholder, helpText, initialValue = "", className = "", minHeight = "min-h-[100px]", multiline = true, onValueChange }: NotesFieldProps) {
  const [value, setValue, flushSave] = useAutoSave(sectionId, fieldKey, initialValue);

  useEffect(() => {
    onValueChange?.(fieldKey, value);
  }, [value, fieldKey, onValueChange]);

  return (
    <div className={`space-y-2 ${className}`}>
      {label && (
        <Label htmlFor={fieldKey} className="text-sm font-semibold text-primary uppercase tracking-wider">{label}</Label>
      )}
      {helpText && helpText.trim() && (
        <div
          // Tiptap wraps content in <p> tags that carry prose margins; strip
          // them (and flush the first/last child) so the help text sits tight
          // between the label and the input without opening a gap.
          className="prose prose-sm prose-slate max-w-none text-sm text-muted-foreground [&_p]:my-0 [&>:first-child]:mt-0 [&>:last-child]:mb-0"
          dangerouslySetInnerHTML={{ __html: helpText }}
          data-testid={`help-${sectionId}-${fieldKey}`}
        />
      )}
      {multiline ? (
        <Textarea
          id={fieldKey}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={flushSave}
          placeholder={placeholder || "Add your notes here..."}
          className={`${minHeight} resize-y bg-white border-border focus:border-ring`}
          data-testid={`notes-${sectionId}-${fieldKey}`}
        />
      ) : (
        <Input
          id={fieldKey}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={flushSave}
          placeholder={placeholder || "Add your notes here..."}
          className="bg-white border-border focus:border-ring"
          data-testid={`notes-${sectionId}-${fieldKey}`}
        />
      )}
    </div>
  );
}
