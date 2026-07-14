import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Briefcase, FileText } from "lucide-react";

export function ComingSoon({ 
  title, 
  description, 
  icon: Icon 
}: { 
  title: string; 
  description: string; 
  icon: React.ElementType 
}) {
  return (
    <div className="flex-1 flex items-center justify-center px-4 py-20 min-h-[70vh] bg-background animate-in fade-in duration-500">
      <div className="max-w-md w-full text-center space-y-8">
        <div className="mx-auto w-24 h-24 bg-card border border-border rounded-full flex items-center justify-center relative">
          <Icon className="w-10 h-10 text-primary relative z-10" />
          <div className="absolute inset-0 bg-primary/5 rounded-full animate-ping opacity-75"></div>
        </div>
        
        <div className="space-y-4">
          <h1 className="text-4xl md:text-5xl font-serif font-bold text-foreground">{title}</h1>
          <p className="text-lg text-muted-foreground">
            {description}
          </p>
        </div>
        
        <div className="pt-8 border-t border-border flex flex-col gap-4">
          <Button variant="outline" className="w-full rounded-full h-12" asChild>
            <Link href="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Return Home
            </Link>
          </Button>
          <Button className="w-full rounded-full h-12" asChild>
            <Link href="/contact">Get in Touch Instead</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

export function ResumePlaceholder() {
  return <ComingSoon 
    title="Résumé" 
    description="The interactive résumé and version history feature is currently under development. A detailed professional history will be available here soon."
    icon={FileText}
  />;
}

export function PortfolioPlaceholder() {
  return <ComingSoon 
    title="Selected Works" 
    description="I am currently curating case studies and project summaries. The interactive portfolio showcase is actively being built."
    icon={Briefcase}
  />;
}
