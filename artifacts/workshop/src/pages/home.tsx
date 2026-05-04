import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  useListSections,
  useGetAppSettings,
  useParticipantLogout,
  useGetCurrentParticipant,
} from "@workspace/api-client-react";
import { getSession, clearSession } from "@/lib/auth";
import { Logo } from "@/components/logo";
import { useToast } from "@/hooks/use-toast";

export default function Home() {
  const [, setLocation] = useLocation();
  const session = getSession();

  const { data: sectionsResp } = useListSections();
  const sections = sectionsResp?.sections ?? [];
  const { data: settings } = useGetAppSettings();
  const { data: meResp } = useGetCurrentParticipant();
  const cohortName = meResp?.cohort?.name?.trim() || "";
  const homeMessage = (meResp?.cohort?.homeMessage ?? "").trim();
  const facilitatorMessage = (meResp?.cohort?.facilitatorMessage ?? "").trim();
  const workbookEnabled = (meResp?.cohort as any)?.workbookEnabled ?? false;
  const logoutMutation = useParticipantLogout();
  const { toast } = useToast();
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!session) setLocation("/");
  }, [session, setLocation]);

  if (!session) return null;

  const level1 = sections.filter((s) => s.level === 1);
  const unlockedCount = level1.filter((s) => s.unlocked).length;
  const totalCount = level1.length;
  const progressPct = totalCount > 0 ? Math.round((unlockedCount / totalCount) * 100) : 0;

  const talkUrl = (settings as Record<string, string> | undefined)?.["talk_with_anthony_url"] || "https://talkwithanthony.com";

  const handleDownloadWorkbook = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      const res = await fetch("/api/workbook/download", {
        credentials: "include",
      });
      if (!res.ok) {
        let message = "Could not generate your workbook.";
        try {
          const body = await res.json();
          if (body?.error) message = body.error;
        } catch {}
        throw new Error(message);
      }
      const disposition = res.headers.get("Content-Disposition") ?? "";
      let filename = "iqmeeteq-workbook.pdf";
      const match = /filename\*?=(?:UTF-\d+''|"?)([^";]+)"?/i.exec(disposition);
      if (match && match[1]) {
        try {
          filename = decodeURIComponent(match[1]);
        } catch {
          filename = match[1];
        }
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      toast({
        title: "Download failed",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setDownloading(false);
    }
  };

  const handleLogout = () => {
    // Match the sidebar behaviour: hard-reload to "/" after the API call so
    // the React Query cache (esp. the cached `useGetCurrentParticipant`
    // payload) is fully discarded. SPA navigation kept the cached `me` data
    // alive, which the login page then used to auto-redirect back to /home,
    // forcing the user to click "Log out" twice.
    logoutMutation.mutate(undefined as any, {
      onSettled: () => {
        clearSession();
        window.location.href = import.meta.env.BASE_URL || "/";
      },
    });
  };

  const greeting = session.name ? `Welcome back, ${session.name}.` : "Welcome back.";

  return (
    <div className="min-h-[100dvh] bg-background">
      <header className="bg-primary text-white px-6 py-3 flex items-center justify-between border-b border-primary/20">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => setLocation("/home")}>
          <Logo variant="white" className="scale-75 origin-left" />
        </div>
        <div
          className="text-xs uppercase tracking-widest text-white/60"
          data-testid="home-cohort-name"
        >
          {cohortName}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-12 space-y-10">
        <div className="text-center pb-2">
          <h1 className="text-4xl font-serif font-bold text-primary mb-2">{greeting}</h1>
          {homeMessage ? (
            <div
              className="prose prose-slate max-w-xl mx-auto text-muted-foreground text-base"
              data-testid="home-message"
              // Cohort home message is admin-authored via the Tiptap editor
              // (StarterKit + Link + Underline nodes only — no script/iframe
              // vectors).
              dangerouslySetInnerHTML={{ __html: homeMessage }}
            />
          ) : (
            <p className="text-muted-foreground text-base max-w-xl mx-auto">
              This is your home base between sessions. Begin by getting your bearings, then enter the workshop when you're ready.
            </p>
          )}
        </div>

        <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-bold uppercase tracking-wider text-primary">Your Progress</div>
            <div className="text-xs text-muted-foreground">{unlockedCount} of {totalCount} unlocked</div>
          </div>
          <div className="h-3 bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {facilitatorMessage && (
          <div
            className="bg-white border border-border rounded-xl shadow-sm"
            style={{
              borderLeft: "4px solid #C8963E",
              padding: "28px",
              borderRadius: "12px",
            }}
            data-testid="facilitator-message-card"
          >
            <div
              className="text-accent uppercase mb-3"
              style={{
                fontSize: "11px",
                fontWeight: 700,
                letterSpacing: "1.5px",
              }}
            >
              From Your Facilitator
            </div>
            <div
              className="prose prose-slate max-w-none text-foreground"
              data-testid="facilitator-message-content"
              // Server-side sanitized via sanitizeRichHtml on admin write
              // (StarterKit + Link + Underline allowlist).
              dangerouslySetInnerHTML={{ __html: facilitatorMessage }}
            />
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={() => setLocation("/levels")}
            className="bg-card border border-border rounded-xl p-6 text-left hover:border-accent hover:shadow-md transition-all group"
            data-testid="button-levels"
          >
            <div className="text-xs font-bold tracking-widest uppercase text-accent mb-2">Self-Assessment</div>
            <h3 className="font-serif font-bold text-primary text-xl mb-1">Where Are You on the Path?</h3>
            <p className="text-sm text-muted-foreground">Find your level on the journey from Question Asker to Architect.</p>
          </button>

          <a
            href={talkUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-card border border-border rounded-xl p-6 text-left hover:border-accent hover:shadow-md transition-all"
            data-testid="link-talk-anthony"
          >
            <div className="text-xs font-bold tracking-widest uppercase text-accent mb-2">One-on-One</div>
            <h3 className="font-serif font-bold text-primary text-xl mb-1">Talk with Anthony</h3>
            <p className="text-sm text-muted-foreground">Book a conversation about how to apply this in your work.</p>
          </a>
        </div>

        <div className="flex justify-center pt-4">
          <button
            onClick={() => setLocation("/workshop")}
            className="px-10 py-4 bg-primary text-white font-bold rounded-lg hover:bg-primary/90 transition-colors shadow-md text-lg"
            data-testid="button-enter-workshop"
          >
            Enter the Workshop →
          </button>
        </div>

        {workbookEnabled && (
          <div className="flex justify-center pt-2">
            <button
              type="button"
              onClick={handleDownloadWorkbook}
              disabled={downloading}
              className="text-sm text-muted-foreground hover:text-foreground hover:underline transition-colors disabled:opacity-60"
              style={{ fontSize: "14px", color: "#6B7280" }}
              data-testid="home-download-workbook"
            >
              {downloading ? "Preparing PDF…" : "Download your workbook"}
            </button>
          </div>
        )}

        <div className="flex justify-center pt-2">
          <button
            onClick={handleLogout}
            className="inline-flex items-center justify-center min-h-[44px] px-6 py-3 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/50 rounded-md transition-colors"
            data-testid="button-logout"
          >
            Log out
          </button>
        </div>
      </main>
    </div>
  );
}
