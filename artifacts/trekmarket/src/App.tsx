import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout";

import Home from "@/pages/home";
import TreksList from "@/pages/treks/index";
import TrekDetail from "@/pages/treks/[id]";
import AgencyProfile from "@/pages/agency/[id]";
import CustomRequestsList from "@/pages/custom-requests/index";
import CustomRequestDetail from "@/pages/custom-requests/[id]";
import Dashboard from "@/pages/dashboard/index";
import BookingConfirmation from "@/pages/bookings/[id]";
import Profile from "@/pages/profile/index";
import CommunityList from "@/pages/community/index";
import CommunityThread from "@/pages/community/[id]";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/treks" component={TreksList} />
        <Route path="/treks/:id" component={TrekDetail} />
        <Route path="/agency/:id" component={AgencyProfile} />
        <Route path="/custom-requests" component={CustomRequestsList} />
        <Route path="/custom-requests/:id" component={CustomRequestDetail} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/bookings/:id" component={BookingConfirmation} />
        <Route path="/profile" component={Profile} />
        <Route path="/community" component={CommunityList} />
        <Route path="/community/:id" component={CommunityThread} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
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
