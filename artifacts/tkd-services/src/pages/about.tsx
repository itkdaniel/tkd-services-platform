import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function About() {
  return (
    <div className="flex flex-col w-full animate-in fade-in duration-500">
      <section className="px-4 md:px-8 py-20 md:py-32 max-w-4xl mx-auto w-full">
        <div className="mb-16">
          <h1 className="text-5xl md:text-7xl font-serif font-bold mb-6 text-foreground">
            About the Practice.
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground leading-relaxed">
            I built this consultancy because I believe the best work comes from direct partnership, not agency layers.
          </p>
        </div>

        <div className="prose prose-lg dark:prose-invert prose-p:text-muted-foreground prose-headings:font-serif prose-headings:font-bold prose-headings:text-foreground prose-a:text-primary hover:prose-a:text-primary/80 max-w-none">
          <p>
            For the past decade, I've worked across startups and established enterprises, designing technical strategies and leading implementations that move the needle. 
          </p>
          
          <p>
            What I've learned is that the hardest part of software isn't the code—it's clarity. It's knowing exactly what problem you're solving before you write a single line. That's where I come in.
          </p>

          <h2>My Background</h2>
          <p>
            I began my career as a full-stack engineer before moving into systems architecture and technical leadership. My experience spans building distributed systems from scratch, rescuing failing legacy migrations, and establishing engineering practices for growing teams.
          </p>
          <p>
            Today, I operate independently to offer unbiased, high-leverage expertise to organizations that need senior technical guidance but may not require a full-time executive hire.
          </p>

          <h2>How I Work</h2>
          <p>
            I take on a limited number of clients at any given time to ensure I can dedicate the deep, sustained focus required for meaningful work. Engagements typically fall into three categories:
          </p>
          <ul>
            <li><strong>Advisory & Strategy:</strong> Helping technical leadership validate architecture decisions and technical roadmaps.</li>
            <li><strong>Implementation:</strong> Hands-on development for critical, high-risk components of your system.</li>
            <li><strong>Team Enablement:</strong> Mentoring teams and establishing technical standards that persist long after I'm gone.</li>
          </ul>

          <div className="mt-12 p-8 bg-card border border-border rounded-2xl not-prose text-center">
            <h3 className="text-2xl font-serif font-bold mb-4">Want to see the details?</h3>
            <p className="text-muted-foreground mb-6">
              Review my full work history, previous roles, and specific technical proficiencies.
            </p>
            <Button variant="outline" asChild className="rounded-full">
              <Link href="/resume">View Résumé</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
