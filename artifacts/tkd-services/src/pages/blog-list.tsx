import { useListBlogPosts } from "@workspace/api-client-react";
import { Link } from "wouter";
import { format } from "date-fns";
import { ArrowRight, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGetCurrentSession } from "@workspace/api-client-react";

export default function BlogList() {
  const { data: posts, isLoading } = useListBlogPosts();
  const { data: session } = useGetCurrentSession();
  const isAdmin = session?.user?.role === "admin";

  return (
    <div className="flex flex-col w-full animate-in fade-in duration-500">
      <section className="px-4 md:px-8 py-20 md:py-32 w-full bg-card border-b border-border">
        <div className="container mx-auto max-w-4xl">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
            <div>
              <h1 className="text-5xl md:text-7xl font-serif font-bold mb-6 text-foreground">
                Journal.
              </h1>
              <p className="text-xl md:text-2xl text-muted-foreground leading-relaxed max-w-2xl">
                Thoughts, technical essays, and field notes on engineering and consulting.
              </p>
            </div>
            
            {isAdmin && (
              <Button asChild className="rounded-full">
                <Link href="/blog/new">
                  <Pencil className="mr-2 h-4 w-4" />
                  New Post
                </Link>
              </Button>
            )}
          </div>
        </div>
      </section>

      <section className="px-4 md:px-8 py-16 w-full">
        <div className="container mx-auto max-w-4xl">
          {isLoading ? (
            <div className="space-y-12">
              {[1, 2, 3].map(i => (
                <div key={i} className="animate-pulse">
                  <div className="h-4 w-24 bg-muted rounded mb-4"></div>
                  <div className="h-10 w-3/4 bg-muted rounded mb-4"></div>
                  <div className="h-6 w-full bg-muted rounded"></div>
                </div>
              ))}
            </div>
          ) : posts?.length === 0 ? (
            <div className="text-center py-24 bg-card rounded-2xl border border-border border-dashed">
              <p className="text-lg text-muted-foreground">No entries published yet.</p>
              {isAdmin && (
                <Button asChild className="mt-6" variant="outline">
                  <Link href="/blog/new">Write the first post</Link>
                </Button>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-16">
              {posts?.map((post) => (
                <article key={post.id} className="group relative">
                  <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4 font-mono uppercase tracking-wider">
                    <time dateTime={post.createdAt}>
                      {format(new Date(post.createdAt), "MMM dd, yyyy")}
                    </time>
                    <span>—</span>
                    <span>{post.authorUsername || "Author"}</span>
                  </div>
                  
                  <h2 className="text-3xl md:text-4xl font-serif font-bold mb-4 text-foreground group-hover:text-primary transition-colors">
                    <Link href={`/blog/${post.slug}`}>
                      {post.title}
                      <span className="absolute inset-0"></span>
                    </Link>
                  </h2>
                  
                  <p className="text-lg text-muted-foreground leading-relaxed line-clamp-3 mb-6">
                    {post.body.replace(/[#*`_\[\]>]/g, '').slice(0, 200)}...
                  </p>
                  
                  <div className="flex items-center text-primary font-medium text-sm tracking-wide">
                    Read Entry <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-2" />
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
