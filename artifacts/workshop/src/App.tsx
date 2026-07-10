import { Switch, Route, Router as WouterRouter } from "wouter";
import {
  QueryClient,
  QueryClientProvider,
  QueryCache,
  MutationCache,
} from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { handleAdminAuthError } from "@/lib/auth";
import NotFound from "@/pages/not-found";

import Login from "@/pages/login";
import Home from "@/pages/home";
import Workshop from "@/pages/workshop";
import Levels from "@/pages/levels";
import AdminLogin from "@/pages/admin/login";
import AdminDashboard from "@/pages/admin/dashboard";

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => {
      handleAdminAuthError(error);
    },
  }),
  mutationCache: new MutationCache({
    onError: (error) => {
      handleAdminAuthError(error);
    },
  }),
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
    },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/" component={Login} />
      <Route path="/home" component={Home} />
      <Route path="/levels" component={Levels} />
      <Route path="/workshop" component={Workshop} />
      <Route path="/admin/login" component={AdminLogin} />
      <Route path="/admin" component={AdminDashboard} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
