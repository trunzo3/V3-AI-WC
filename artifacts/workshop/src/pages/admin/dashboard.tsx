import { useEffect } from "react";
import { useLocation } from "wouter";
import { getAdminAuth, setAdminAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LogOut } from "lucide-react";

const PREFIX = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function AdminDashboard() {
  const [, setLocation] = useLocation();
  const isAdmin = getAdminAuth();

  useEffect(() => {
    if (!isAdmin) setLocation("/admin/login");
  }, [isAdmin, setLocation]);

  if (!isAdmin) return null;

  const handleLogout = async () => {
    try {
      await fetch(`${PREFIX}/api/admin/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch {}
    setAdminAuth(false);
    setLocation("/admin/login");
  };

  return (
    <div className="min-h-[100dvh] bg-background">
      <header className="bg-primary text-white px-6 py-4 flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-widest text-white/60">Workshop Companion</div>
          <h1 className="text-xl font-serif font-bold">Admin</h1>
        </div>
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
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <Card>
          <CardHeader>
            <CardTitle>Admin tools are coming back online</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-muted-foreground">
            <p>
              The participant-facing experience has been refreshed. The full admin console (cohorts, sections, content
              variants, safari library, LLM tools, app settings, feedback, and exports) will be reconnected here in the
              next phase.
            </p>
            <p>
              In the meantime, you can manage cohorts, content, and unlock codes directly via the API. Participants
              continue to use the workshop normally.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
