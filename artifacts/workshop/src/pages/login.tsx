import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  useParticipantLogin,
  useGetCurrentParticipant,
  getGetCurrentParticipantQueryKey,
} from "@workspace/api-client-react";
import { setSession } from "@/lib/auth";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";

const loginSchema = z.object({
  cohortCode: z.string().trim().min(1, "Workshop code is required"),
  email: z.string().trim().email("Please enter a valid email address"),
  name: z.string().trim().optional(),
});

type LoginFormValues = z.infer<typeof loginSchema>;

const PREFIX = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const loginMutation = useParticipantLogin();
  const [showAdmin, setShowAdmin] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [adminError, setAdminError] = useState("");
  const [adminLoading, setAdminLoading] = useState(false);

  // If already authenticated, jump straight to /home.
  const meQuery = useGetCurrentParticipant({
    query: {
      queryKey: getGetCurrentParticipantQueryKey(),
      retry: false,
      staleTime: 0,
    },
  });
  useEffect(() => {
    if (meQuery.isSuccess && meQuery.data?.participant) {
      const p = meQuery.data.participant as any;
      setSession({
        email: p.email,
        participantId: p.id,
        cohortId: p.cohortId,
        name: p.name ?? undefined,
      });
      setLocation("/home");
    }
  }, [meQuery.isSuccess, meQuery.data, setLocation]);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { cohortCode: "WORKSHOP", email: "", name: "" },
  });

  const onSubmit = (values: LoginFormValues) => {
    const trimmedName = values.name?.trim() ?? "";
    const fallbackName =
      trimmedName.length > 0
        ? trimmedName
        : values.email.trim().split("@")[0] || "Participant";
    loginMutation.mutate(
      {
        data: {
          cohortCode: values.cohortCode.trim().toUpperCase(),
          email: values.email.trim().toLowerCase(),
          name: fallbackName,
        } as any,
      },
      {
        onSuccess: (data: any) => {
          const p = data.participant;
          setSession({
            email: p.email,
            participantId: p.id,
            cohortId: p.cohortId,
            cohortCode: values.cohortCode.trim().toUpperCase(),
            name: p.name ?? undefined,
          });
          setLocation("/home");
        },
        onError: (err: any) => {
          toast({
            variant: "destructive",
            title: "Sign-in failed",
            description: err?.error || err?.message || "Unable to sign you in. Check the workshop code and try again.",
          });
        },
      },
    );
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminError("");
    setAdminLoading(true);
    try {
      const res = await fetch(`${PREFIX}/api/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ password: adminPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAdminError(data.error || "Invalid credentials.");
      } else {
        localStorage.setItem("admin-authenticated", "true");
        setLocation("/admin");
      }
    } catch {
      setAdminError("Connection error. Please try again.");
    } finally {
      setAdminLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center p-4 bg-background relative">
      <div className="w-full max-w-md space-y-8">
        {!showAdmin ? (
          <>
            <div className="flex flex-col items-center text-center space-y-4">
              <Logo className="scale-125 mb-2" />
              <h1 className="text-3xl font-serif font-bold text-primary">Workshop Companion</h1>
              <p className="text-muted-foreground max-w-sm">
                Enter your workshop code and email to access your interactive workbook.
              </p>
            </div>

            <div className="bg-card p-8 rounded-xl shadow-sm border border-border">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                  <FormField
                    control={form.control}
                    name="cohortCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Workshop Code</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="WORKSHOP"
                            autoComplete="off"
                            data-testid="input-cohort-code"
                            className="uppercase tracking-wider font-semibold"
                            {...field}
                            onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email Address</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="you@county.ca.gov"
                            type="email"
                            autoComplete="email"
                            data-testid="input-email"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Your Name <span className="text-muted-foreground font-normal text-xs">(optional)</span></FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Optional"
                            autoComplete="name"
                            data-testid="input-name"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="submit"
                    className="w-full h-12 text-lg"
                    disabled={loginMutation.isPending}
                    data-testid="button-login"
                  >
                    {loginMutation.isPending ? "Entering..." : "Enter Workshop"}
                  </Button>
                </form>
              </Form>
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-col items-center text-center space-y-2 mb-4">
              <span className="text-xs font-bold tracking-widest uppercase text-muted-foreground">
                ⚙ Admin Access
              </span>
            </div>
            <div className="bg-card p-8 rounded-xl shadow-sm border border-border">
              <form onSubmit={handleAdminLogin} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Password</label>
                  <Input
                    type="password"
                    placeholder="Admin password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                    data-testid="input-admin-password"
                  />
                </div>
                {adminError && (
                  <p className="text-sm text-destructive font-medium">{adminError}</p>
                )}
                <Button type="submit" className="w-full h-12 text-lg" disabled={adminLoading} data-testid="button-admin-login">
                  {adminLoading ? "Signing in..." : "Sign In"}
                </Button>
              </form>
              <button
                onClick={() => { setShowAdmin(false); setAdminError(""); }}
                className="mt-6 text-sm text-muted-foreground hover:text-foreground transition-colors block w-full text-center"
              >
                ← Back to participant login
              </button>
            </div>
          </>
        )}
      </div>

      <button
        onClick={() => setShowAdmin(true)}
        className="fixed bottom-4 left-4 text-muted-foreground opacity-40 hover:opacity-70 transition-opacity text-xl p-1"
        aria-label="Admin access"
        title="Admin"
        data-testid="gear-admin-icon"
      >
        ⚙
      </button>
    </div>
  );
}
