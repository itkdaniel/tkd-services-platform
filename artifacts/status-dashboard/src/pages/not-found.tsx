import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md bg-card border-border">
        <CardContent className="pt-6">
          <div className="flex mb-4 gap-2 text-destructive font-mono">
            <AlertCircle className="h-6 w-6" />
            <h1 className="text-xl font-bold">404 - Unknown Vector</h1>
          </div>
          <p className="mt-4 text-sm text-muted-foreground font-mono">
            The requested diagnostic panel could not be found. 
            Return to the main dashboard.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
