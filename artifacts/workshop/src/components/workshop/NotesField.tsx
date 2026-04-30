import { useAutoSave } from "@/hooks/use-auto-save";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface NotesFieldProps {
  sectionId: string;
  fieldKey: string;
  label: string;
  placeholder?: string;
  initialValue?: string;
  className?: string;
  minHeight?: string;
}

export function NotesField({ sectionId, fieldKey, label, placeholder, initialValue = "", className = "", minHeight = "min-h-[100px]" }: NotesFieldProps) {
  const [value, setValue, flushSave] = useAutoSave(sectionId, fieldKey, initialValue);

  return (
    <div className={`space-y-2 ${className}`}>
      {label && (
        <Label htmlFor={fieldKey} className="text-sm font-semibold text-primary uppercase tracking-wider">{label}</Label>
      )}
      <Textarea
        id={fieldKey}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={flushSave}
        placeholder={placeholder || "Add your notes here..."}
        className={`${minHeight} resize-y bg-white border-border focus:border-ring`}
        data-testid={`notes-${sectionId}-${fieldKey}`}
      />
    </div>
  );
}
