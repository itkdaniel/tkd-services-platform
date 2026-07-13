import { useParams, Link, useLocation } from "wouter";
import { useListBlogPosts, useDeleteBlogPost, useGetCurrentSession } from "@workspace/api-client-react";
import { format } from "date-fns";
import { ArrowLeft, Edit, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
// ReactMarkdown removed as it's not in the dependencies

export default function BlogDetail() {
  const { slug } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  // Since we only have list and get-by-id, we'll fetch the list and find by slug client-side
  // for the public view. This is acceptable for a small professional blog.
  const { data: posts, isLoading } = useListBlogPosts();
  const post = posts?.find(p => p.slug === slug);
  
  const { data: session } = useGetCurrentSession();
  const isAdmin = session?.user?.role === "admin";
  
  const deletePost = useDeleteBlogPost();

  const handleDelete = () => {
    if (!post) return;
    
    deletePost.mutate(
      { postId: post.id },
      {
        onSuccess: () => {
          toast({
            title: "Post deleted",
            description: "The journal entry has been removed.",
          });
          setLocation("/blog");
        },
        onError: (err) => {
          toast({
            title: "Error",
            description: (err as any).error || "Failed to delete post.",
            variant: "destructive",
          });
        }
      }
    );
  };

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-3xl px-4 py-24 animate-pulse">
        <div className="h-4 w-32 bg-muted rounded mb-8"></div>
        <div className="h-12 w-full bg-muted rounded mb-6"></div>
        <div className="h-6 w-1/3 bg-muted rounded mb-12"></div>
        <div className="space-y-4">
          <div className="h-4 w-full bg-muted rounded"></div>
          <div className="h-4 w-full bg-muted rounded"></div>
          <div className="h-4 w-5/6 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="container mx-auto max-w-3xl px-4 py-32 text-center">
        <h1 className="text-4xl font-serif font-bold mb-4">Entry Not Found</h1>
        <p className="text-lg text-muted-foreground mb-8">The journal entry you're looking for does not exist or has been removed.</p>
        <Button asChild variant="outline">
          <Link href="/blog">Return to Journal</Link>
        </Button>
      </div>
    );
  }

  return (
    <article className="w-full animate-in fade-in duration-500 pb-24">
      <header className="bg-card px-4 md:px-8 py-16 md:py-24 border-b border-border">
        <div className="container mx-auto max-w-3xl">
          <Link href="/blog" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-primary mb-12 transition-colors">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Journal
          </Link>
          
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-serif font-bold text-foreground mb-8 leading-tight">
            {post.title}
          </h1>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 text-sm font-mono uppercase tracking-wider text-muted-foreground">
              <time dateTime={post.createdAt}>
                {format(new Date(post.createdAt), "MMMM dd, yyyy")}
              </time>
              <span>—</span>
              <span>{post.authorUsername || "Author"}</span>
            </div>
            
            {isAdmin && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/blog/${post.id}/edit`}>
                    <Edit className="w-4 h-4 mr-2" /> Edit
                  </Link>
                </Button>
                
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm">
                      <Trash2 className="w-4 h-4 mr-2" /> Delete
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete the post
                        "{post.title}" and remove it from our servers.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        Delete Post
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
          </div>
        </div>
      </header>
      
      <div className="container mx-auto max-w-3xl px-4 mt-16">
        <div className="prose prose-lg dark:prose-invert prose-headings:font-serif prose-headings:font-bold max-w-none">
          {/* Since we don't have react-markdown installed, we render text with preserved newlines */}
          <div className="whitespace-pre-wrap">{post.body}</div>
        </div>
      </div>
    </article>
  );
}
