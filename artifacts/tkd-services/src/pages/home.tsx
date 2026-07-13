import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export default function Home() {
  return (
    <div className="flex flex-col w-full">
      {/* Hero Section */}
      <section className="relative px-4 md:px-8 py-24 md:py-32 lg:py-48 overflow-hidden bg-card">
        {/* Subtle background noise texture */}
        <div className="absolute inset-0 opacity-[0.02] mix-blend-overlay pointer-events-none" 
             style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.65%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")' }}>
        </div>
        
        <div className="container mx-auto relative z-10 flex flex-col items-start max-w-4xl animate-in fade-in slide-in-from-bottom-8 duration-1000">
          <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-sm font-medium text-primary mb-8">
            <span className="flex h-2 w-2 rounded-full bg-primary mr-2 animate-pulse"></span>
            Currently accepting new clients
          </div>
          
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-serif font-bold text-foreground leading-[1.1] tracking-tight mb-6">
            Crafting clarity from <span className="text-primary italic">complexity.</span>
          </h1>
          
          <p className="text-lg md:text-2xl text-muted-foreground leading-relaxed max-w-2xl mb-12">
            I'm an independent consultant specializing in elegant solutions that scale. I partner with teams to build systems that actually work in the real world.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
            <Button size="lg" className="rounded-full text-base h-14 px-8" asChild>
              <Link href="/booking">Book a Consultation</Link>
            </Button>
            <Button variant="outline" size="lg" className="rounded-full text-base h-14 px-8 bg-transparent border-primary/20 hover:bg-primary/5" asChild>
              <Link href="/portfolio">View My Work</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Philosophy Section */}
      <section className="px-4 md:px-8 py-24 bg-background">
        <div className="container mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-16 md:gap-24 items-center">
            <div>
              <h2 className="text-3xl md:text-5xl font-serif font-bold mb-6">The approach is simple: do the right work.</h2>
              <p className="text-lg text-muted-foreground mb-6 leading-relaxed">
                Most consultants sell templates. I sell attention. When you hire me, you get my undivided focus on your specific problem. No junior associates, no generic playbooks.
              </p>
              <Button variant="link" className="p-0 text-primary hover:text-primary/80 text-lg group" asChild>
                <Link href="/about">
                  Read more about my background 
                  <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
              <div className="bg-card p-8 border border-border rounded-2xl">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-6 text-primary font-serif text-2xl font-bold">1</div>
                <h3 className="text-xl font-bold mb-3 font-serif">Diagnosis</h3>
                <p className="text-muted-foreground">Finding the actual problem, not just treating the symptoms.</p>
              </div>
              <div className="bg-card p-8 border border-border rounded-2xl sm:translate-y-8">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-6 text-primary font-serif text-2xl font-bold">2</div>
                <h3 className="text-xl font-bold mb-3 font-serif">Strategy</h3>
                <p className="text-muted-foreground">Designing a tailored solution that fits your exact constraints.</p>
              </div>
              <div className="bg-card p-8 border border-border rounded-2xl">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-6 text-primary font-serif text-2xl font-bold">3</div>
                <h3 className="text-xl font-bold mb-3 font-serif">Execution</h3>
                <p className="text-muted-foreground">Building it right the first time with uncompromising quality.</p>
              </div>
              <div className="bg-card p-8 border border-border rounded-2xl sm:translate-y-8">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-6 text-primary font-serif text-2xl font-bold">4</div>
                <h3 className="text-xl font-bold mb-3 font-serif">Handoff</h3>
                <p className="text-muted-foreground">Ensuring your team can own and maintain the system.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-4 md:px-8 py-32 bg-primary text-primary-foreground text-center">
        <div className="container mx-auto max-w-3xl">
          <h2 className="text-4xl md:text-6xl font-serif font-bold mb-8">Ready to build something lasting?</h2>
          <p className="text-xl md:text-2xl text-primary-foreground/80 mb-12">
            Let's discuss how we can partner on your next major initiative.
          </p>
          <Button size="lg" variant="secondary" className="rounded-full text-lg h-14 px-10 bg-background text-foreground hover:bg-background/90" asChild>
            <Link href="/contact">Get in Touch</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
