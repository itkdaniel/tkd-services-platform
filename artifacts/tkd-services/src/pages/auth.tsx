import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLoginUser, useRegisterUser } from "@workspace/api-client-react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft } from "lucide-react";

const authSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters").max(40),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type AuthValues = z.infer<typeof authSchema>;

export function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const login = useLoginUser();

  const form = useForm<AuthValues>({
    resolver: zodResolver(authSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const onSubmit = (data: AuthValues) => {
    login.mutate(
      { data },
      {
        onSuccess: () => {
          toast({ title: "Welcome back", description: "Successfully signed in." });
          setLocation("/");
          window.location.reload(); // Hard reload to refresh auth state in provider
        },
        onError: (err) => {
          toast({
            title: "Authentication Failed",
            description: (err as any).error || "Invalid username or password.",
            variant: "destructive",
          });
        },
      }
    );
  };

  return <AuthLayout title="Sign In" subtitle="Welcome back to TKD Studio." form={form} onSubmit={onSubmit} isPending={login.isPending} isLogin={true} />;
}

export function Register() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const register = useRegisterUser();

  const form = useForm<AuthValues>({
    resolver: zodResolver(authSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const onSubmit = (data: AuthValues) => {
    register.mutate(
      { data },
      {
        onSuccess: () => {
          toast({ title: "Account created", description: "You are now registered and signed in." });
          setLocation("/");
          window.location.reload(); // Hard reload to refresh auth state
        },
        onError: (err) => {
          toast({
            title: "Registration Failed",
            description: (err as any).error || "Could not create account.",
            variant: "destructive",
          });
        },
      }
    );
  };

  return <AuthLayout title="Create Account" subtitle="Join to access client resources." form={form} onSubmit={onSubmit} isPending={register.isPending} isLogin={false} />;
}

function AuthLayout({ 
  title, 
  subtitle, 
  form, 
  onSubmit, 
  isPending, 
  isLogin 
}: { 
  title: string;
  subtitle: string;
  form: any;
  onSubmit: (data: any) => void;
  isPending: boolean;
  isLogin: boolean;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      {/* Background flourish */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl h-[500px] bg-primary/5 blur-[100px] rounded-full pointer-events-none"></div>
      
      <div className="w-full max-w-md bg-card border border-border p-8 sm:p-12 rounded-3xl shadow-xl relative z-10 animate-in fade-in zoom-in-95 duration-500">
        <Link href="/" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-primary mb-8 transition-colors">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Home
        </Link>
        
        <div className="mb-10 text-center">
          <div className="font-serif text-2xl font-bold text-primary mb-6">TKD Studio.</div>
          <h1 className="text-3xl font-bold mb-2">{title}</h1>
          <p className="text-muted-foreground">{subtitle}</p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Username</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter your username" className="h-12 bg-background" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="••••••••" className="h-12 bg-background" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <Button type="submit" className="w-full h-12 rounded-full text-base font-medium mt-2" disabled={isPending}>
              {isPending ? "Please wait..." : title}
            </Button>
          </form>
        </Form>
        
        <div className="mt-10 text-center text-sm text-muted-foreground border-t border-border pt-6">
          {isLogin ? (
            <p>
              Don't have an account? <Link href="/register" className="text-primary font-medium hover:underline">Sign up</Link>
            </p>
          ) : (
            <p>
              Already have an account? <Link href="/login" className="text-primary font-medium hover:underline">Sign in</Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
