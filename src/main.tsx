import { createRoot } from "react-dom/client";
import { Router as WouterRouter, Switch, Route, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import LandingApp from "./App";
import AdminLogin from "./pages/AdminLogin";
import CRMLayout from "./pages/crm/CRMLayout";
import CRMDashboard from "./pages/crm/Dashboard";
import Patients from "./pages/crm/Patients";
import Appointments from "./pages/crm/Appointments";
import Treatments from "./pages/crm/Treatments";
import Billing from "./pages/crm/Billing";
import Collections from "./pages/crm/Collections";
import Followups from "./pages/crm/Followups";
import Users from "./pages/crm/Users";
import "./index.css";

const queryClient = new QueryClient();

function CRMRoutes() {
  return (
    <CRMLayout>
      <Switch>
        <Route path="/crm/dashboard" component={CRMDashboard} />
        <Route path="/crm/patients" component={Patients} />
        <Route path="/crm/appointments" component={Appointments} />
        <Route path="/crm/treatments" component={Treatments} />
        <Route path="/crm/billing" component={Billing} />
        <Route path="/crm/collections" component={Collections} />
        <Route path="/crm/followups" component={Followups} />
        <Route path="/crm/users" component={Users} />
        <Route>
          <Redirect to="/crm/dashboard" />
        </Route>
      </Switch>
    </CRMLayout>
  );
}

function AppRouter() {
  const base = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
  return (
    <QueryClientProvider client={queryClient}>
      <WouterRouter base={base}>
        <Switch>
          {/* Legacy /dashboard redirect → new CRM */}
          <Route path="/dashboard">
            <Redirect to="/crm/dashboard" />
          </Route>
          <Route path="/admin" component={AdminLogin} />
          <Route path="/crm/:rest*" component={CRMRoutes} />
          <Route path="/" component={LandingApp} />
        </Switch>
      </WouterRouter>
    </QueryClientProvider>
  );
}

createRoot(document.getElementById("root")!).render(<AppRouter />);
