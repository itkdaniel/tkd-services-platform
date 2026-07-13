import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Route, Switch, Router as WouterRouter, useLocation } from 'wouter';
import { Layout } from '@/components/layout';

// Pages
import Home from '@/pages/home';
import About from '@/pages/about';
import Contact from '@/pages/contact';
import BlogList from '@/pages/blog-list';
import BlogDetail from '@/pages/blog-detail';
import BlogEditor from '@/pages/blog-editor';
import { Login, Register } from '@/pages/auth';
import { ResumePlaceholder, PortfolioPlaceholder, BookingPlaceholder } from '@/pages/placeholders';
import NotFound from '@/pages/not-found';
import { useGetCurrentSession } from "@workspace/api-client-react";
import { useEffect } from 'react';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

// Admin Route Guard
function AdminRoute({ component: Component, ...rest }: any) {
  const { data: session, isLoading } = useGetCurrentSession();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && session?.user?.role !== "admin") {
      setLocation("/");
    }
  }, [isLoading, session, setLocation]);

  if (isLoading || session?.user?.role !== "admin") {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return <Component {...rest} />;
}

function Router() {
  return (
    <Switch>
      {/* Auth routes don't use the main layout shell */}
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />

      {/* Main app routes wrapped in Layout */}
      <Route path="/" nest>
        <Layout>
          <Switch>
            <Route path="/" component={Home} />
            <Route path="/about" component={About} />
            <Route path="/resume" component={ResumePlaceholder} />
            <Route path="/portfolio" component={PortfolioPlaceholder} />
            <Route path="/booking" component={BookingPlaceholder} />
            <Route path="/contact" component={Contact} />
            
            <Route path="/blog" component={BlogList} />
            <Route path="/blog/new">
              <AdminRoute component={BlogEditor} />
            </Route>
            <Route path="/blog/:id/edit">
              <AdminRoute component={BlogEditor} />
            </Route>
            <Route path="/blog/:slug" component={BlogDetail} />
            
            <Route component={NotFound} />
          </Switch>
        </Layout>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
