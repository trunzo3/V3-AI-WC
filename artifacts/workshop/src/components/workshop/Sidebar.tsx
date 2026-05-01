import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Lock, ChevronDown, ChevronRight, LogOut, CheckCircle2, Circle, ExternalLink } from "lucide-react";
import type { Section } from "@workspace/api-client-react";
import { useParticipantLogout, useListLlmTools } from "@workspace/api-client-react";
import { clearSession, getSession } from "@/lib/auth";

interface SidebarProps {
  sections: Section[];
  activeSectionId: string | null;
  onSelectSection: (id: string) => void;
  onNavigateHome?: () => void;
}

const LEVEL_LABELS: Record<number, string> = {
  1: "Level 1 — Core Workshop",
  2: "Level 2 — Deeper Practice",
  3: "Level 3 — Advanced Track",
};

export function Sidebar({
  sections,
  activeSectionId,
  onSelectSection,
  onNavigateHome,
}: SidebarProps) {
  const session = getSession();
  const logoutMutation = useParticipantLogout();
  const llmToolsQuery = useListLlmTools();
  const llmTools = llmToolsQuery.data?.tools ?? [];
  const expandKey = `workshop-sidebar-expanded-${session?.participantId ?? "anon"}`;

  const levels = Array.from(new Set(sections.map((s) => s.level))).sort();

  const [expanded, setExpanded] = useState<Record<number, boolean>>(() => {
    try {
      const raw = localStorage.getItem(expandKey);
      if (raw) return JSON.parse(raw);
    } catch {}
    // Default: only level 1 expanded.
    const init: Record<number, boolean> = {};
    levels.forEach((lv) => (init[lv] = lv === 1));
    return init;
  });

  // Persist expanded state.
  useEffect(() => {
    try {
      localStorage.setItem(expandKey, JSON.stringify(expanded));
    } catch {}
  }, [expanded, expandKey]);

  // Auto-expand the level of the active section once sections have loaded.
  useEffect(() => {
    if (!activeSectionId || sections.length === 0) return;
    const sec = sections.find((s) => s.id === activeSectionId);
    if (sec && !expanded[sec.level]) {
      setExpanded((prev) => ({ ...prev, [sec.level]: true }));
    }
  }, [activeSectionId, sections, expanded]);

  const toggleLevel = (level: number) =>
    setExpanded((prev) => ({ ...prev, [level]: !prev[level] }));

  const handleLogout = () => {
    logoutMutation.mutate(undefined as any, {
      onSettled: () => {
        clearSession();
        window.location.href = import.meta.env.BASE_URL || "/";
      },
    });
  };

  return (
    <div className="w-72 border-r bg-card h-full overflow-y-auto hidden md:flex flex-col flex-shrink-0">
      <div className="flex-1">
        <div className="px-2 pt-3 pb-2">
          <button
            onClick={onNavigateHome}
            className="w-full text-left px-3 py-2 rounded-md text-primary hover:bg-secondary transition-colors"
            style={{ fontSize: "14px", fontWeight: 500 }}
            data-testid="sidebar-home"
          >
            ← Home
          </button>
        </div>

        {llmTools.length > 0 && (
          <div className="px-3 pb-3 border-b border-border">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80 mb-2 px-1">
              LLM Links
            </div>
            <div className="flex flex-wrap gap-1.5">
              {llmTools.map((tool) => (
                <a
                  key={tool.id}
                  href={tool.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-secondary hover:bg-accent/20 hover:text-primary text-xs text-foreground transition-colors"
                  data-testid={`sidebar-llm-tool-${tool.id}`}
                  title={tool.url}
                >
                  <span>{tool.displayLabel}</span>
                  <ExternalLink className="w-3 h-3 opacity-60" />
                </a>
              ))}
            </div>
          </div>
        )}

        <div className="pt-2">
          {levels.map((level) => {
            const items = sections
              .filter((s) => s.level === level)
              .sort((a, b) => a.sortOrder - b.sortOrder);
            const unlockedInLevel = items.filter((s) => s.unlocked).length;
            const isOpen = !!expanded[level];

            return (
              <div key={level} className="mb-2">
                <button
                  onClick={() => toggleLevel(level)}
                  className="w-full flex items-center justify-between px-4 py-2 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-primary transition-colors"
                  data-testid={`sidebar-level-toggle-${level}`}
                >
                  <span className="flex items-center gap-2">
                    {isOpen ? (
                      <ChevronDown className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5" />
                    )}
                    {LEVEL_LABELS[level] ?? `Level ${level}`}
                  </span>
                  <span className="text-[10px] text-muted-foreground/70">
                    {unlockedInLevel}/{items.length}
                  </span>
                </button>

                {isOpen && (
                  <div className="space-y-0.5 mt-1 mb-2">
                    {items.map((section) => {
                      const isActive = activeSectionId === section.id;
                      return (
                        <button
                          key={section.id}
                          onClick={() => onSelectSection(section.id)}
                          data-testid={`sidebar-item-${section.id}`}
                          className={cn(
                            "w-full flex items-center gap-2 pl-9 pr-3 py-2 text-sm transition-colors text-left",
                            isActive
                              ? "bg-primary/10 text-primary font-medium border-r-2 border-primary"
                              : "text-foreground hover:bg-secondary",
                            !section.unlocked && "opacity-60",
                          )}
                        >
                          {section.unlocked ? (
                            <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 text-accent" />
                          ) : section.hasCode ? (
                            <Lock className="w-3 h-3 flex-shrink-0 text-muted-foreground" />
                          ) : (
                            <Circle className="w-3.5 h-3.5 flex-shrink-0 text-muted-foreground/40" />
                          )}
                          <span className="truncate">{section.title}</span>
                        </button>
                      );
                    })}
                    {items.length === 0 && (
                      <div className="pl-9 pr-3 py-2 text-xs text-muted-foreground italic">
                        No sections yet.
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="border-t border-border px-2 pt-3 pb-2">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          data-testid="sidebar-logout"
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          <span>Log out</span>
        </button>
      </div>
    </div>
  );
}
