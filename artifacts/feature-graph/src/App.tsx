import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, Router as WouterRouter } from 'wouter';

import MainLayout from '@/components/layout/MainLayout';
import GraphExplorer from '@/pages/graph';
import TablesDirectory from '@/pages/tables';
import TableWorkspace from '@/pages/tables/workspace';
import Login from '@/pages/login';
import Register from '@/pages/register';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
    },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      
      <Route path="/">
        <MainLayout>
          <GraphExplorer />
        </MainLayout>
      </Route>
      
      <Route path="/tables">
        <MainLayout>
          <TablesDirectory />
        </MainLayout>
      </Route>
      
      <Route path="/tables/:id">
        {params => (
          <MainLayout>
            <TableWorkspace tableId={Number(params.id)} />
          </MainLayout>
        )}
      </Route>

      <Route>
        <MainLayout>
          <NotFound />
        </MainLayout>
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
