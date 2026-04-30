import { useState } from "react";
import { useLocation } from "wouter";
import { useAdminLogin } from "@workspace/api-client-react";
import { setAdminAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Logo } from "@/components/logo";
import { useToast } from "@/hooks/use-toast";

export default function AdminLogin() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const loginMutation = useAdminLogin();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    loginMutation.mutate(
      { data: { email, password } as any },
      {
        onSuccess: () => {
          setAdminAuth(true);
          setLocation("/admin");
        },
        onError: () => {
          toast({
            variant: "destructive",
            title: "Access Denied",
            description: "Incorrect credentials.",
          });
        }
      }
    );
  };

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center p-4 bg-slate-950">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center text-center space-y-4">
          <Logo className="scale-125 mb-4 brightness-0 invert" />
          <h1 className="text-2xl font-serif font-bold text-slate-50">
            Admin Access
          </h1>
        </div>

        <div className="bg-slate-900 p-8 rounded-xl shadow-lg border border-slate-800">
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Admin Email</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-slate-800 border-slate-700 text-slate-100"
                autoFocus
                data-testid="input-admin-email"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Admin Password</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-slate-800 border-slate-700 text-slate-100"
                data-testid="input-admin-password"
              />
            </div>
            <Button
              type="submit"
              className="w-full bg-slate-100 text-slate-900 hover:bg-white"
              disabled={loginMutation.isPending}
              data-testid="button-admin-login"
            >
              Authenticate
            </Button>
          </form>
        </div>
        
        <div className="text-center">
          <button 
            onClick={() => setLocation("/")}
            className="text-sm text-slate-500 hover:text-slate-300"
          >
            Back to Participant Login
          </button>
        </div>
      </div>
    </div>
  );
}
