import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useListSections, getListSectionsQueryKey } from "@workspace/api-client-react";
import { Sidebar } from "@/components/workshop/Sidebar";
import { TopNav } from "@/components/workshop/TopNav";
import { SectionRenderer } from "@/components/workshop/SectionRenderer";
import { getSession } from "@/lib/auth";

const ACTIVE_KEY_PREFIX = "workshop-active-section-";

export default function Workshop() {
  const [, setLocation] = useLocation();
  const session = getSession();
  const activeKey = `${ACTIVE_KEY_PREFIX}${session?.participantId ?? "anon"}`;

  useEffect(() => {
    if (!session) setLocation("/");
  }, [session, setLocation]);

  const { data: sectionsResp, isLoading } = useListSections({
    query: {
      queryKey: getListSectionsQueryKey(),
      refetchInterval: 4000,
    },
  });
  const sections = sectionsResp?.sections ?? [];

  const [activeSectionId, setActiveSectionId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(activeKey);
    } catch {
      return null;
    }
  });

  // Default to first unlocked section once sections load.
  useEffect(() => {
    if (activeSectionId) return;
    if (sections.length === 0) return;
    const firstUnlocked = sections.find((s) => s.unlocked);
    const target = firstUnlocked?.id ?? sections[0]?.id ?? null;
    if (target) setActiveSectionId(target);
  }, [sections, activeSectionId]);

  // Persist active section per participant.
  useEffect(() => {
    if (!activeSectionId) return;
    try {
      localStorage.setItem(activeKey, activeSectionId);
    } catch {}
  }, [activeSectionId, activeKey]);

  const activeSection = sections.find((s) => s.id === activeSectionId) ?? null;

  if (!session) return null;

  return (
    <div className="flex flex-col h-[100dvh] bg-background">
      <TopNav />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          sections={sections}
          activeSectionId={activeSectionId}
          onSelectSection={setActiveSectionId}
          onNavigateHome={() => setLocation("/home")}
        />
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {isLoading && !activeSection && (
              <div className="text-center text-muted-foreground py-20">Loading workshop...</div>
            )}
            {!isLoading && sections.length === 0 && (
              <div className="text-center text-muted-foreground py-20">
                No sections available yet. Please check back when the facilitator publishes content.
              </div>
            )}
            {activeSection && <SectionRenderer key={activeSection.id} section={activeSection} />}
          </div>
        </main>
      </div>
    </div>
  );
}
