import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  useAdminListCohorts,
  getAdminListCohortSectionsQueryKey,
  getAdminListCohortParticipantsQueryKey,
  getAdminListFeedbackQueryKey,
  adminListCohortSections,
  adminListCohortParticipants,
  adminListFeedback,
} from "@workspace/api-client-react";
import {
  getAdminAuth,
  setAdminAuth,
  ADMIN_SESSION_EXPIRED_EVENT,
} from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { LogOut } from "lucide-react";

import { CohortSwitcher } from "@/components/admin/CohortSwitcher";
import { StatsCards } from "@/components/admin/StatsCards";
import { CohortsTab } from "@/components/admin/tabs/CohortsTab";
import { SectionsTab } from "@/components/admin/tabs/SectionsTab";
import { VariantsTab } from "@/components/admin/tabs/VariantsTab";
import { ToolSafariTab } from "@/components/admin/tabs/ToolSafariTab";
import { ParticipantsTab } from "@/components/admin/tabs/ParticipantsTab";
import { FeedbackTab } from "@/components/admin/tabs/FeedbackTab";
import { LlmToolsTab } from "@/components/admin/tabs/LlmToolsTab";
import { SettingsTab } from "@/components/admin/tabs/SettingsTab";

const PREFIX = import.meta.env.BASE_URL.replace(/\/$/, "");
const COHORT_KEY = "workshop-admin-cohort-id";

function readSelectedCohort(): number | null {
  try {
    const v = localStorage.getItem(COHORT_KEY);
    return v ? Number(v) : null;
  } catch {
    return null;
  }
}

function writeSelectedCohort(id: number | null) {
  try {
    if (id == null) localStorage.removeItem(COHORT_KEY);
    else localStorage.setItem(COHORT_KEY, String(id));
  } catch {
    /* ignore */
  }
}

interface PerCohortStatsArgs {
  cohortId: number | null;
}

function usePerCohortStats({ cohortId }: PerCohortStatsArgs) {
  const sectionsQ = useQuery({
    queryKey: cohortId
      ? getAdminListCohortSectionsQueryKey(cohortId)
      : ["admin", "sections", "noop"],
    queryFn: () => adminListCohortSections(cohortId as number),
    enabled: cohortId != null,
  });
  const partsQ = useQuery({
    queryKey: cohortId
      ? getAdminListCohortParticipantsQueryKey(cohortId)
      : ["admin", "participants", "noop"],
    queryFn: () => adminListCohortParticipants(cohortId as number),
    enabled: cohortId != null,
  });
  const fbQ = useQuery({
    queryKey: cohortId
      ? getAdminListFeedbackQueryKey({ cohort_id: String(cohortId) })
      : ["admin", "feedback", "noop"],
    queryFn: () =>
      adminListFeedback({ cohort_id: String(cohortId as number) }),
    enabled: cohortId != null,
  });

  const participants = partsQ.data?.participants ?? [];
  const sections = sectionsQ.data?.sections ?? [];
  const feedback = fbQ.data?.feedback ?? [];

  return {
    participantCount: participants.length,
    sectionCount: sections.length,
    feedbackCount: feedback.length,
    unlocksTotal: participants.reduce(
      (sum: number, p: { unlockedCount?: number }) =>
        sum + (p.unlockedCount ?? 0),
      0,
    ),
  };
}

export default function AdminDashboard() {
  const [, setLocation] = useLocation();
  const isAdmin = getAdminAuth();

  useEffect(() => {
    if (!isAdmin) setLocation("/admin/login");
  }, [isAdmin, setLocation]);

  // Redirect to login when any admin API call comes back 401.
  useEffect(() => {
    const onExpired = () => setLocation("/admin/login");
    window.addEventListener(ADMIN_SESSION_EXPIRED_EVENT, onExpired);
    return () =>
      window.removeEventListener(ADMIN_SESSION_EXPIRED_EVENT, onExpired);
  }, [setLocation]);

  const [selectedCohortId, setSelectedCohortId] = useState<number | null>(
    readSelectedCohort(),
  );
  const [tab, setTab] = useState("cohorts");

  const cohortsQ = useAdminListCohorts();
  const cohorts = cohortsQ.data?.cohorts ?? [];

  // If nothing selected (or selection invalid), pick the newest cohort.
  useEffect(() => {
    if (!cohorts.length) return;
    const ok = selectedCohortId != null && cohorts.some((c) => c.id === selectedCohortId);
    if (!ok) {
      const next = cohorts[0]?.id ?? null;
      setSelectedCohortId(next);
      writeSelectedCohort(next);
    }
  }, [cohorts, selectedCohortId]);

  const onSelectCohort = (id: number) => {
    setSelectedCohortId(id);
    writeSelectedCohort(id);
  };

  const stats = usePerCohortStats({ cohortId: selectedCohortId });

  const activeCohort = useMemo(
    () => cohorts.find((c) => c.id === selectedCohortId) ?? null,
    [cohorts, selectedCohortId],
  );

  const handleLogout = async () => {
    try {
      await fetch(`${PREFIX}/api/admin/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch {
      /* ignore */
    }
    setAdminAuth(false);
    setLocation("/admin/login");
  };

  if (!isAdmin) return null;

  const perCohortDisabled = selectedCohortId == null;

  return (
    <div className="min-h-[100dvh] bg-background">
      <header className="bg-slate-950 text-white">
        <div className="px-6 py-4 flex items-center justify-between gap-6 flex-wrap">
          <div>
            <div className="text-xs uppercase tracking-widest text-white/50">
              Workshop Companion
            </div>
            <h1 className="text-xl font-serif font-bold">Admin</h1>
          </div>
          <CohortSwitcher
            cohorts={cohorts}
            selectedId={selectedCohortId}
            onSelect={onSelectCohort}
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="text-white/80 hover:text-white hover:bg-white/10"
            data-testid="button-admin-logout"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign out
          </Button>
        </div>
        <div className="px-6 pb-5">
          <StatsCards
            participantCount={stats.participantCount}
            sectionCount={stats.sectionCount}
            feedbackCount={stats.feedbackCount}
            unlocksTotal={stats.unlocksTotal}
          />
          {activeCohort && (
            <div className="text-xs text-white/60 mt-3">
              Stats above are scoped to{" "}
              <span className="text-white font-medium">{activeCohort.name}</span>{" "}
              ({activeCohort.cohortCode}).
            </div>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="flex flex-wrap h-auto gap-1 mb-4 items-end">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground px-1">
                Global
              </span>
              <div className="flex flex-wrap gap-1">
                <TabsTrigger value="cohorts" data-testid="tab-cohorts">
                  Cohorts
                </TabsTrigger>
                <TabsTrigger value="tool-safari" data-testid="tab-tool-safari">
                  Tool Safari
                </TabsTrigger>
                <TabsTrigger value="llm-tools" data-testid="tab-llm-tools">
                  Links to LLMs
                </TabsTrigger>
                <TabsTrigger value="feedback" data-testid="tab-feedback">
                  Feedback
                </TabsTrigger>
                <TabsTrigger value="settings" data-testid="tab-settings">
                  Settings
                </TabsTrigger>
              </div>
            </div>
            <span className="mx-3 self-center text-muted-foreground/50">│</span>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground px-1">
                Cohort{activeCohort ? ` — ${activeCohort.name}` : ""}
              </span>
              <div className="flex flex-wrap gap-1">
                <TabsTrigger
                  value="sections"
                  disabled={perCohortDisabled}
                  data-testid="tab-sections"
                >
                  Sections
                </TabsTrigger>
                <TabsTrigger
                  value="variants"
                  disabled={perCohortDisabled}
                  data-testid="tab-variants"
                >
                  Content variants
                </TabsTrigger>
                <TabsTrigger
                  value="participants"
                  disabled={perCohortDisabled}
                  data-testid="tab-participants"
                >
                  Participants
                </TabsTrigger>
              </div>
            </div>
          </TabsList>

          <TabsContent value="cohorts">
            <GlobalBanner />
            <CohortsTab
              selectedCohortId={selectedCohortId}
              onSelectCohort={onSelectCohort}
            />
          </TabsContent>
          <TabsContent value="tool-safari">
            <GlobalBanner />
            <ToolSafariTab
              cohortId={selectedCohortId}
              cohortLabel={activeCohort?.name ?? null}
            />
          </TabsContent>
          <TabsContent value="llm-tools">
            <GlobalBanner />
            <LlmToolsTab />
          </TabsContent>
          <TabsContent value="feedback">
            <GlobalBanner />
            <FeedbackTab />
          </TabsContent>
          <TabsContent value="settings">
            <GlobalBanner />
            <SettingsTab />
          </TabsContent>

          <TabsContent value="sections">
            {selectedCohortId != null ? (
              <>
                <CohortBanner name={activeCohort?.name ?? null} />
                <SectionsTab cohortId={selectedCohortId} />
              </>
            ) : null}
          </TabsContent>
          <TabsContent value="variants">
            {selectedCohortId != null ? (
              <>
                <CohortBanner name={activeCohort?.name ?? null} />
                <VariantsTab cohortId={selectedCohortId} />
              </>
            ) : null}
          </TabsContent>
          <TabsContent value="participants">
            {selectedCohortId != null ? (
              <>
                <CohortBanner name={activeCohort?.name ?? null} />
                <ParticipantsTab cohortId={selectedCohortId} />
              </>
            ) : null}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function GlobalBanner() {
  return (
    <div className="mb-3 inline-flex items-center gap-2 rounded-md bg-slate-100 px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-slate-600">
      <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
      Global — applies to every cohort
    </div>
  );
}

function CohortBanner({ name }: { name: string | null }) {
  return (
    <div className="mb-3 inline-flex items-center gap-2 rounded-md bg-amber-50 px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-amber-800">
      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
      Cohort{name ? ` — ${name}` : ""}
    </div>
  );
}
