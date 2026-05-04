import { useState, useEffect, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  useParticipantLogin,
  useParticipantCheckEmail,
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

// Cohort code is optional in the schema because the returning-email flow
// hides the workshop-code field entirely. Submission validates conditionally
// based on whether the field is currently shown (see `onSubmit` below).
const loginSchema = z.object({
  cohortCode: z.string().trim().optional().default(""),
  email: z.string().trim().email("Please enter a valid email address"),
  name: z.string().trim().optional(),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const loginMutation = useParticipantLogin();
  const checkEmail = useParticipantCheckEmail();

  // Returning-participant state
  const [isReturning, setIsReturning] = useState(false);
  const [showCohortField, setShowCohortField] = useState(true);

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
    // Workshop code is intentionally empty by default — admins want
    // participants to type it from the email invite, not auto-fill "WORKSHOP".
    defaultValues: { cohortCode: "", email: "", name: "" },
  });

  // Email blur → look up participant. If known, prefill name and
  // collapse the workshop-code field (returning user); otherwise stay
  // in new-user mode and require the code.
  const handleEmailBlur = useCallback(
    (value: string) => {
      const email = value.trim().toLowerCase();
      if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
        return;
      }
      checkEmail.mutate(
        { data: { email } },
        {
          onSuccess: (data) => {
            if (data.exists) {
              if (data.name) form.setValue("name", data.name);
              setIsReturning(true);
              setShowCohortField(false);
            } else {
              setIsReturning(false);
              setShowCohortField(true);
            }
          },
        },
      );
    },
    [checkEmail, form],
  );

  const onSubmit = (values: LoginFormValues) => {
    const trimmedName = values.name?.trim() ?? "";
    const fallbackName =
      trimmedName.length > 0
        ? trimmedName
        : values.email.trim().split("@")[0] || "Participant";
    const cohortCode = (values.cohortCode ?? "").trim().toUpperCase();
    // No client-side block when the cohort code is missing. Two reasons:
    //   1. Returning users may submit before the email-blur check has
    //      finished (single-click bug). For them the backend resolves the
    //      cohort from the email alone — no code required.
    //   2. New users who genuinely forget the code get a clearer 404
    //      message from the server: "We don't recognize this email yet.
    //      Enter your workshop code to join."
    // Either way, deferring to the backend keeps Login a one-click action
    // and avoids racing the in-flight check-email request.
    loginMutation.mutate(
      {
        data: {
          // Omit the field entirely in returning mode so the server falls
          // back to email-only resolution.
          ...(cohortCode.length > 0 ? { cohortCode } : {}),
          email: values.email.trim().toLowerCase(),
          name: fallbackName,
        },
      },
      {
        onSuccess: (data) => {
          const p = data.participant;
          setSession({
            email: p.email,
            participantId: p.id,
            cohortId: p.cohortId,
            cohortCode,
            name: p.name ?? undefined,
          });
          setLocation("/home");
        },
        onError: (err: any) => {
          toast({
            variant: "destructive",
            title: "Sign-in failed",
            description:
              err?.error ||
              err?.message ||
              "Unable to sign you in. Check the workshop code and try again.",
          });
        },
      },
    );
  };

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center p-4 bg-background relative">
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center text-center space-y-4">
          <Logo className="scale-125 mb-2" />
          <h1 className="text-3xl font-serif font-bold text-primary">
            Workshop Companion
          </h1>
          <p className="text-muted-foreground max-w-sm">
            {isReturning
              ? "Welcome back. Sign in with your email."
              : "Enter your workshop code and email to access your interactive workbook."}
          </p>
        </div>

        <div className="bg-card p-8 rounded-xl shadow-sm border border-border">
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="space-y-5"
            >
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
                        onBlur={(e) => {
                          field.onBlur();
                          handleEmailBlur(e.target.value);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {showCohortField ? (
                <FormField
                  control={form.control}
                  name="cohortCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Workshop Code</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter your code"
                          autoComplete="off"
                          data-testid="input-cohort-code"
                          className="uppercase tracking-wider font-semibold"
                          {...field}
                          onChange={(e) =>
                            field.onChange(e.target.value.toUpperCase())
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setShowCohortField(true)}
                  className="text-sm text-primary hover:underline"
                  data-testid="button-switch-workshop"
                >
                  Switch workshop
                </button>
              )}

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Your Name{" "}
                      <span className="text-muted-foreground font-normal text-xs">
                        (optional)
                      </span>
                    </FormLabel>
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
                {loginMutation.isPending
                  ? "Entering..."
                  : isReturning
                    ? "Continue"
                    : "Enter Workshop"}
              </Button>
            </form>
          </Form>
        </div>
      </div>

      <Link
        href="/admin/login"
        className="fixed bottom-4 left-4 text-muted-foreground opacity-40 hover:opacity-70 transition-opacity text-xl p-1"
        aria-label="Admin access"
        title="Admin"
        data-testid="gear-admin-icon"
      >
        ⚙
      </Link>
    </div>
  );
}
