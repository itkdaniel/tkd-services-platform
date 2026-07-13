import { useState } from "react";
import { useCreateContactMessage, useGetCurrentSession } from "@workspace/api-client-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { CheckCircle2, Send } from "lucide-react";
import { Link } from "wouter";

const contactSchema = z.object({
  name: z.string().min(1, "Name is required").max(120),
  email: z.string().email("Please enter a valid email address").max(254),
  message: z.string().min(10, "Please provide more detail").max(5000),
});

type ContactFormValues = z.infer<typeof contactSchema>;

export default function Contact() {
  const [isSuccess, setIsSuccess] = useState(false);
  const { data: session } = useGetCurrentSession();
  
  const form = useForm<ContactFormValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      name: session?.user?.username || "",
      email: "",
      message: "",
    },
  });

  const sendMessage = useCreateContactMessage();

  function onSubmit(data: ContactFormValues) {
    sendMessage.mutate(
      { data },
      {
        onSuccess: () => {
          setIsSuccess(true);
        },
      }
    );
  }

  return (
    <div className="flex flex-col w-full animate-in fade-in duration-500">
      <section className="px-4 md:px-8 py-20 md:py-32 max-w-5xl mx-auto w-full">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-16 md:gap-24">
          <div>
            <h1 className="text-5xl md:text-6xl font-serif font-bold mb-6 text-foreground">
              Let's Talk.
            </h1>
            <p className="text-xl text-muted-foreground mb-10 leading-relaxed">
              Whether you need strategic guidance on a new initiative or hands-on help rescuing a failing system, I'm here to help.
            </p>

            <div className="space-y-8 mt-12">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-2">Location</h3>
                <p className="text-lg">San Francisco, CA<br />Available globally remotely</p>
              </div>
              
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-2">Response Time</h3>
                <p className="text-lg">I reply to all serious inquiries within 48 hours.</p>
              </div>

              {!session?.user && (
                <div className="p-6 bg-primary/5 border border-primary/10 rounded-xl mt-8">
                  <p className="text-sm text-muted-foreground mb-3">
                    Have an account? Sign in to pre-fill your details and access client resources.
                  </p>
                  <Button variant="outline" size="sm" asChild className="rounded-full">
                    <Link href="/login">Sign In</Link>
                  </Button>
                </div>
              )}
            </div>
          </div>

          <div className="bg-card border border-border p-8 md:p-10 rounded-2xl shadow-sm">
            {isSuccess ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-12 animate-in zoom-in-95 duration-500">
                <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-6">
                  <CheckCircle2 className="w-10 h-10 text-primary" />
                </div>
                <h2 className="text-2xl font-serif font-bold mb-4">Message Received</h2>
                <p className="text-muted-foreground mb-8">
                  Thank you for reaching out. I've received your message and will be in touch shortly to discuss how we can work together.
                </p>
                <Button onClick={() => {
                  form.reset();
                  setIsSuccess(false);
                }} variant="outline" className="rounded-full">
                  Send Another Message
                </Button>
              </div>
            ) : (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base font-medium">Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Jane Doe" className="h-12 bg-background" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base font-medium">Email Address</FormLabel>
                        <FormControl>
                          <Input placeholder="jane@company.com" type="email" className="h-12 bg-background" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="message"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base font-medium">How can I help?</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Tell me a bit about your project, your timeline, and your biggest technical challenge right now." 
                            className="min-h-[150px] resize-y bg-background text-base" 
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <Button 
                    type="submit" 
                    className="w-full h-14 text-lg rounded-full mt-4 group" 
                    disabled={sendMessage.isPending}
                  >
                    {sendMessage.isPending ? "Sending..." : (
                      <>
                        Send Message 
                        <Send className="w-5 h-5 ml-2 transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" />
                      </>
                    )}
                  </Button>
                </form>
              </Form>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
