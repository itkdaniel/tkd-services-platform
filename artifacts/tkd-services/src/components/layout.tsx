import { Link, useLocation } from "wouter";
import { useGetCurrentSession, useLogoutUser } from "@workspace/api-client-react";
import { useTheme } from "@/hooks/use-theme";
import { Moon, Sun, Menu, X, ArrowRight } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function Navbar() {
  const [location] = useLocation();
  const { data: session } = useGetCurrentSession();
  const logout = useLogoutUser();
  const { theme, setTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  const navLinks = [
    { href: "/about", label: "About" },
    { href: "/resume", label: "Résumé" },
    { href: "/portfolio", label: "Portfolio" },
    { href: "/blog", label: "Journal" },
    { href: "/contact", label: "Contact" },
  ];

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => {
        window.location.reload();
      }
    });
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-md">
      <div className="container mx-auto px-4 md:px-8 h-20 flex items-center justify-between">
        <Link href="/" className="font-serif text-2xl font-bold tracking-tight text-primary">
          TKD Studio.
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm font-medium transition-colors hover:text-primary ${
                location.startsWith(link.href) ? "text-primary" : "text-muted-foreground"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={toggleTheme} className="text-muted-foreground hover:text-primary">
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            <span className="sr-only">Toggle theme</span>
          </Button>

          {session?.user ? (
            <div className="flex items-center gap-4">
              {session.user.role === "admin" && (
                <Link href="/admin/bookings" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
                  Bookings Inbox
                </Link>
              )}
              <span className="text-sm text-muted-foreground">
                {session.user.username} {session.user.role === "admin" && <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full ml-1">Admin</span>}
              </span>
              <Button variant="ghost" size="sm" onClick={handleLogout}>Log out</Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/login">Sign In</Link>
              </Button>
            </div>
          )}
          
          <Button asChild size="sm" className="rounded-full px-6">
            <Link href="/booking">Book Consultation</Link>
          </Button>
        </div>

        {/* Mobile Menu Toggle */}
        <div className="flex items-center gap-4 md:hidden">
          <Button variant="ghost" size="icon" onClick={toggleTheme}>
            {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {/* Mobile Nav */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-border bg-background p-4 absolute top-20 left-0 w-full animate-in slide-in-from-top-2">
          <nav className="flex flex-col gap-4">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-lg font-medium py-2 border-b border-border/50"
                onClick={() => setMobileMenuOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <div className="flex flex-col gap-2 pt-4">
              {session?.user ? (
                <>
                  <div className="text-sm text-muted-foreground py-2">
                    Signed in as {session.user.username}
                  </div>
                  {session.user.role === "admin" && (
                    <Link
                      href="/admin/bookings"
                      className="text-lg font-medium py-2 border-b border-border/50"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Bookings Inbox
                    </Link>
                  )}
                  <Button variant="outline" onClick={handleLogout} className="justify-start">Log out</Button>
                </>
              ) : (
                <Button variant="outline" asChild className="justify-start">
                  <Link href="/login" onClick={() => setMobileMenuOpen(false)}>Sign In</Link>
                </Button>
              )}
              <Button asChild className="justify-start mt-2">
                <Link href="/booking" onClick={() => setMobileMenuOpen(false)}>Book Consultation <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-border/40 bg-card mt-auto">
      <div className="container mx-auto px-4 md:px-8 py-12 flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex flex-col items-center md:items-start gap-2">
          <span className="font-serif text-xl font-bold text-primary">TKD Studio.</span>
          <p className="text-sm text-muted-foreground text-center md:text-left max-w-sm">
            Independent consulting and crafted solutions for complex problems.
          </p>
        </div>
        
        <div className="flex flex-col items-center md:items-end gap-4">
          <div className="flex items-center gap-6 text-sm font-medium">
            <Link href="/contact" className="hover:text-primary transition-colors">Contact</Link>
            <Link href="/booking" className="hover:text-primary transition-colors">Book a Call</Link>
          </div>
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} TKD Services. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] flex flex-col bg-background selection:bg-primary/20">
      <Navbar />
      <main className="flex-1 flex flex-col">
        {children}
      </main>
      <Footer />
    </div>
  );
}
