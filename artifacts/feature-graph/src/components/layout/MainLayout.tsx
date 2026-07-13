import { Link, useLocation } from "wouter";
import { useGetCurrentSession, useLogoutUser } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Database, Network, LogOut, User, LogIn, UserPlus, Menu } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetCurrentSessionQueryKey } from "@workspace/api-client-react";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { useState } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { data: session } = useGetCurrentSession();
  const logoutMutation = useLogoutUser();
  const queryClient = useQueryClient();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetCurrentSessionQueryKey() });
        setLocation("/login");
      }
    });
  };

  const NavLinks = () => (
    <>
      <Link href="/" className={`flex items-center gap-2 px-3 py-2 rounded-md transition-colors ${location === '/' ? 'bg-primary text-primary-foreground font-medium' : 'hover:bg-muted text-foreground'}`}>
        <Network size={18} />
        <span>Knowledge Graph</span>
      </Link>
      <Link href="/tables" className={`flex items-center gap-2 px-3 py-2 rounded-md transition-colors ${location.startsWith('/tables') ? 'bg-primary text-primary-foreground font-medium' : 'hover:bg-muted text-foreground'}`}>
        <Database size={18} />
        <span>Feature Databases</span>
      </Link>
    </>
  );

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-r border-border bg-card">
        <div className="p-4 border-b border-border flex items-center gap-3">
          <div className="w-8 h-8 bg-primary text-primary-foreground flex items-center justify-center rounded-lg font-bold">
            FG
          </div>
          <span className="font-bold text-lg tracking-tight">Feature Graph</span>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          <NavLinks />
        </nav>
        
        <div className="p-4 border-t border-border">
          {session?.user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="w-full justify-start gap-2 px-2 hover:bg-muted">
                  <div className="w-6 h-6 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center text-xs font-medium">
                    {session.user.username.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 text-left truncate">
                    <div className="text-sm font-medium leading-none">{session.user.username}</div>
                    <div className="text-xs text-muted-foreground capitalize mt-1">{session.user.role}</div>
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground px-2 mb-2 flex items-center gap-2">
                <User size={14} /> Guest Mode
              </div>
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link href="/login"><LogIn className="mr-2 h-4 w-4" /> Sign In</Link>
              </Button>
              <Button variant="default" className="w-full justify-start" asChild>
                <Link href="/register"><UserPlus className="mr-2 h-4 w-4" /> Register</Link>
              </Button>
            </div>
          )}
        </div>
      </aside>

      {/* Mobile Header & Content */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <header className="md:hidden flex items-center justify-between p-4 border-b border-border bg-card">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary text-primary-foreground flex items-center justify-center rounded-lg font-bold">
              FG
            </div>
            <span className="font-bold text-lg">Feature Graph</span>
          </div>
          
          <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0 flex flex-col">
              <div className="p-4 border-b border-border flex items-center gap-3">
                <div className="w-8 h-8 bg-primary text-primary-foreground flex items-center justify-center rounded-lg font-bold">
                  FG
                </div>
                <span className="font-bold text-lg tracking-tight">Feature Graph</span>
              </div>
              <nav className="flex-1 p-4 space-y-2" onClick={() => setIsMobileMenuOpen(false)}>
                <NavLinks />
              </nav>
              <div className="p-4 border-t border-border">
                {session?.user ? (
                  <Button variant="destructive" className="w-full" onClick={() => { handleLogout(); setIsMobileMenuOpen(false); }}>
                    <LogOut className="mr-2 h-4 w-4" /> Log out
                  </Button>
                ) : (
                  <div className="space-y-2 flex flex-col" onClick={() => setIsMobileMenuOpen(false)}>
                    <Button variant="outline" asChild><Link href="/login">Sign In</Link></Button>
                    <Button asChild><Link href="/register">Register</Link></Button>
                  </div>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </header>

        <main className="flex-1 overflow-auto bg-background">
          {children}
        </main>
      </div>
    </div>
  );
}
