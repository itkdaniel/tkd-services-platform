import React, { useMemo } from 'react';
import { useTestStatus, UnauthorizedError, ServiceResult, FeatureResult } from '@/hooks/use-test-status';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { RefreshCw, ShieldAlert, CheckCircle2, XCircle, AlertCircle, PlayCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Dashboard() {
  const { data, isLoading, error, refetch, isRefetching } = useTestStatus();

  if (error instanceof UnauthorizedError) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background p-6">
        <div className="max-w-md w-full text-center space-y-4">
          <ShieldAlert className="w-16 h-16 text-muted-foreground mx-auto" />
          <h1 className="text-xl font-semibold text-foreground tracking-tight">Access Denied</h1>
          <p className="text-muted-foreground text-sm">
            Sign in as an admin on the main site to view this dashboard.
          </p>
        </div>
      </div>
    );
  }

  const allPassed = data?.services.every(s => s.available && s.features.every(f => f.status === 'passed'));

  return (
    <div className="min-h-screen w-full bg-background text-foreground font-sans">
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-semibold tracking-tight">System Test Status</h1>
            {data && (
              <Badge variant={allPassed ? "success" : "destructive"} className="uppercase font-mono text-[10px] tracking-wider px-2 py-0.5">
                {allPassed ? "All Systems Go" : "Checks Failing"}
              </Badge>
            )}
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => refetch()} 
            disabled={isLoading || isRefetching}
            className="font-mono text-xs uppercase tracking-wider"
          >
            <RefreshCw className={cn("w-3.5 h-3.5 mr-2", isRefetching && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4 text-muted-foreground">
            <Loader2 className="w-8 h-8 animate-spin" />
            <div className="font-mono text-xs uppercase tracking-widest animate-pulse">Running Diagnostics...</div>
          </div>
        ) : error ? (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-6 text-center text-destructive">
            <AlertCircle className="w-10 h-10 mx-auto mb-3 opacity-80" />
            <h2 className="font-medium text-lg">Failed to retrieve status</h2>
            <p className="text-sm opacity-80 mt-1">{error.message}</p>
          </div>
        ) : data ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {data.services.map(service => (
              <ServicePanel key={service.service} data={service} />
            ))}
          </div>
        ) : null}
      </main>
    </div>
  );
}

function ServicePanel({ data }: { data: ServiceResult }) {
  const isAvailable = data.available;
  const isPassing = isAvailable && data.features.every(f => f.status === 'passed');
  const passCount = data.features.reduce((acc, f) => acc + f.passed, 0);
  const totalCount = data.features.reduce((acc, f) => acc + f.total, 0);
  const failCount = totalCount - passCount;

  return (
    <Card className="flex flex-col border-border bg-card overflow-hidden">
      <CardHeader className="border-b border-border bg-muted/30 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="font-mono text-lg tracking-tight mb-1">{data.service}</CardTitle>
            <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
              {isAvailable ? (
                <>
                  <span className={failCount > 0 ? "text-destructive" : "text-success"}>
                    {passCount}/{totalCount} passed
                  </span>
                  <span>•</span>
                  <span>{failCount} failing</span>
                </>
              ) : (
                <span className="text-warning">Service Offline</span>
              )}
            </div>
          </div>
          {isAvailable && (
            <Badge variant={isPassing ? "success" : "destructive"} className="uppercase font-mono text-[10px] tracking-wider">
              {isPassing ? "Passing" : "Failing"}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-0 flex-1 flex flex-col">
        {!isAvailable ? (
          <div className="p-8 text-center flex-1 flex flex-col items-center justify-center text-muted-foreground border-b border-border border-dashed">
            <PlayCircle className="w-12 h-12 mb-4 opacity-20" />
            <p className="text-sm font-medium text-foreground mb-1">No test run available</p>
            <p className="text-xs font-mono opacity-70 max-w-xs leading-relaxed">
              {data.error || `Run \`pnpm test\` in this service's directory to generate status reports.`}
            </p>
          </div>
        ) : (
          <div className="flex-1 flex flex-col">
            {data.coverage && (
              <div className="p-4 border-b border-border bg-muted/10 grid grid-cols-4 gap-4">
                <CoverageMetric label="Lines" value={data.coverage.lines} />
                <CoverageMetric label="Stmts" value={data.coverage.statements} />
                <CoverageMetric label="Funcs" value={data.coverage.functions} />
                <CoverageMetric label="Branch" value={data.coverage.branches} />
              </div>
            )}
            
            <div className="p-0">
              <Accordion type="multiple" className="w-full">
                {data.features.map(feature => (
                  <FeatureRow key={feature.name} feature={feature} />
                ))}
              </Accordion>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function FeatureRow({ feature }: { feature: FeatureResult }) {
  const isPassing = feature.status === 'passed';
  
  return (
    <AccordionItem value={feature.name} className="border-b border-border last:border-0">
      <AccordionTrigger className="px-4 py-3 hover:bg-muted/50 hover:no-underline data-[state=open]:bg-muted/30">
        <div className="flex items-center gap-3 w-full pr-4 text-left">
          {isPassing ? (
            <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
          ) : (
            <XCircle className="w-4 h-4 text-destructive shrink-0" />
          )}
          <span className="text-sm font-medium truncate flex-1">{feature.name}</span>
          <span className="text-xs font-mono text-muted-foreground shrink-0">
            {feature.passed}/{feature.total}
          </span>
        </div>
      </AccordionTrigger>
      <AccordionContent className="bg-background/50 border-t border-border p-0">
        <div className="divide-y divide-border">
          {feature.tests.map(test => (
            <div key={test.name} className="p-4">
              <div className="flex items-start gap-3">
                {test.status === 'passed' ? (
                  <div className="w-2 h-2 rounded-full bg-success/50 mt-1.5 shrink-0" />
                ) : (
                  <div className="w-2 h-2 rounded-full bg-destructive mt-1.5 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start gap-4">
                    <p className={cn(
                      "text-sm font-mono leading-tight break-words",
                      test.status === 'failed' ? "text-foreground font-semibold" : "text-muted-foreground"
                    )}>
                      {test.name}
                    </p>
                    <span className="text-[10px] font-mono text-muted-foreground opacity-50 shrink-0">
                      {test.durationMs}ms
                    </span>
                  </div>
                  
                  {test.status === 'failed' && test.failureMessages.length > 0 && (
                    <div className="mt-3 bg-card border border-destructive/20 rounded-md overflow-hidden">
                      {test.failureMessages.map((msg, i) => (
                        <pre 
                          key={i} 
                          className="p-3 text-[11px] font-mono text-destructive-foreground bg-destructive/10 overflow-x-auto custom-scrollbar whitespace-pre-wrap word-break-all border-b border-destructive/10 last:border-0"
                        >
                          {msg}
                        </pre>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

function CoverageMetric({ label, value }: { label: string; value: number }) {
  let colorClass = "bg-success";
  if (value < 50) colorClass = "bg-destructive";
  else if (value < 80) colorClass = "bg-warning";

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
        <span>{label}</span>
        <span className={cn(
          "font-semibold",
          value < 50 ? "text-destructive" : value < 80 ? "text-warning" : "text-success"
        )}>
          {value}%
        </span>
      </div>
      <Progress value={value} className="h-1.5 bg-background border border-border" indicatorClassName={colorClass} />
    </div>
  );
}
