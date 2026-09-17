import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

interface LiveValuesContextValue {
  // Current typed value for each fieldKey in the active section, updated on
  // every keystroke so template-based prompt previews can reflect unsaved text.
  values: Record<string, string>;
  reportValue: (fieldKey: string, value: string) => void;
}

const LiveValuesContext = createContext<LiveValuesContextValue | null>(null);

// Scopes a set of live field values to one section render. Input fields report
// their current text upward; prompt/preview blocks in the same section read it
// to update instantly instead of waiting for the debounced save + refetch.
export function LiveValuesProvider({ children }: { children: ReactNode }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const reportValue = useCallback((fieldKey: string, value: string) => {
    setValues((prev) =>
      prev[fieldKey] === value ? prev : { ...prev, [fieldKey]: value },
    );
  }, []);
  const ctx = useMemo(() => ({ values, reportValue }), [values, reportValue]);
  return (
    <LiveValuesContext.Provider value={ctx}>
      {children}
    </LiveValuesContext.Provider>
  );
}

export function useLiveValues(): LiveValuesContextValue | null {
  return useContext(LiveValuesContext);
}
