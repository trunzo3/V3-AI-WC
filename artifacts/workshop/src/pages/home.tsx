import { useEffect } from "react";
import { useLocation } from "wouter";
import {
  useListSections,
  useGetAppSettings,
  useParticipantLogout,
} from "@workspace/api-client-react";
import { getSession, clearSession } from "@/lib/auth";
import { Logo } from "@/components/logo";

export default function Home() {
  const [, setLocation] = useLocation();
  const session = getSession();

  const { data: sectionsResp } = useListSections();
  const sections = sectionsResp?.sections ?? [];
  const { data: settings } = useGetAppSettings();
  const logoutMutation = useParticipantLogout();

  useEffect(() => {
    if (!session) setLocation("/");
  }, [session, setLocation]);

  if (!session) return null;

  const level1 = sections.filter((s) => s.level === 1);
  const unlockedCount = level1.filter((s) => s.unlocked).length;
  const totalCount = level1.length;
  const progressPct = totalCount > 0 ? Math.round((unlockedCount / totalCount) * 100) : 0;

  const talkUrl = (settings as Record<string, string> | undefined)?.["talk_with_anthony_url"] || "https://talkwithanthony.com";

  const handleLogout = () => {
    logoutMutation.mutate(undefined as any, {
      onSettled: () => {
        clearSession();
        setLocation("/");
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
        <div className="text-xs uppercase tracking-widest text-white/60">
          {session.cohortCode ? `Cohort: ${session.cohortCode}` : "Vestibule"}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-12 space-y-10">
        <div className="text-center pb-2">
          <h1 className="text-4xl font-serif font-bold text-primary mb-2">{greeting}</h1>
          <p className="text-muted-foreground text-base max-w-xl mx-auto">
            This is your home base between sessions. Begin by getting your bearings, then enter the workshop when you're ready.
          </p>
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

        <div className="text-center pt-2">
          <button
            onClick={handleLogout}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            data-testid="button-logout"
          >
            Log out
          </button>
        </div>
      </main>
    </div>
  );
}
