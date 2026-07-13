import { useState, useRef, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { useGetBlogPost, useCreateBlogPost, useUpdateBlogPost, getListBlogPostsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Save } from "lucide-react";
import { Link } from "wouter";

export default function BlogEditor() {
  const { id } = useParams();
  const isNew = !id || id === "new";
  const postId = isNew ? 0 : parseInt(id, 10);
  
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  
  // Load existing post if editing
  const { data: post, isLoading } = useGetBlogPost(postId, { 
    query: { 
      enabled: !isNew && !!postId,
      queryKey: ["getBlogPost", postId] 
    } 
  });
  
  const initializedForId = useRef<number | null>(null);
  
  // Set initial form state when post loads
  if (post && initializedForId.current !== post.id) {
    initializedForId.current = post.id;
    setTitle(post.title);
    setBody(post.body);
  }

  const createPost = useCreateBlogPost();
  const updatePost = useUpdateBlogPost();
  
  const isPending = createPost.isPending || updatePost.isPending;

  const handleSave = async () => {
    if (!title.trim() || !body.trim()) {
      toast({
        title: "Validation Error",
        description: "Title and body are required.",
        variant: "destructive"
      });
      return;
    }

    if (isNew) {
      createPost.mutate(
        { data: { title, body } },
        {
          onSuccess: (newPost) => {
            queryClient.invalidateQueries({ queryKey: getListBlogPostsQueryKey() });
            toast({ title: "Post published", description: "Your journal entry is now live." });
            setLocation(`/blog/${newPost.slug}`);
          },
          onError: (err) => {
            toast({
              title: "Error publishing post",
              description: (err as any).error || "An unknown error occurred.",
              variant: "destructive"
            });
          }
        }
      );
    } else {
      updatePost.mutate(
        { postId, data: { title, body } },
        {
          onSuccess: (updatedPost) => {
            queryClient.invalidateQueries({ queryKey: getListBlogPostsQueryKey() });
            queryClient.invalidateQueries({ queryKey: ["getBlogPost", postId] });
            toast({ title: "Post updated", description: "Your changes have been saved." });
            setLocation(`/blog/${updatedPost.slug}`);
          },
          onError: (err) => {
            toast({
              title: "Error updating post",
              description: (err as any).error || "An unknown error occurred.",
              variant: "destructive"
            });
          }
        }
      );
    }
  };

  if (!isNew && isLoading) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-24 animate-pulse">
        <div className="h-10 w-full bg-muted rounded mb-8"></div>
        <div className="h-96 w-full bg-muted rounded"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 py-12 animate-in fade-in duration-500">
      <div className="flex items-center justify-between mb-8">
        <Button variant="ghost" size="sm" asChild className="text-muted-foreground">
          <Link href="/blog">
            <ArrowLeft className="w-4 h-4 mr-2" /> Cancel
          </Link>
        </Button>
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-muted-foreground">
            {isNew ? "Draft" : "Editing published post"}
          </span>
          <Button onClick={handleSave} disabled={isPending} className="rounded-full px-6">
            {isPending ? "Saving..." : (
              <>
                <Save className="w-4 h-4 mr-2" />
                {isNew ? "Publish" : "Update"}
              </>
            )}
          </Button>
        </div>
      </div>
      
      <div className="space-y-8 bg-card border border-border p-6 md:p-12 rounded-2xl shadow-sm">
        <div>
          <Input
            placeholder="Post Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="text-4xl md:text-5xl font-serif font-bold h-auto py-4 px-0 border-0 border-b border-transparent hover:border-border focus-visible:border-primary focus-visible:ring-0 rounded-none bg-transparent shadow-none"
          />
        </div>
        
        <div>
          <Textarea
            placeholder="Write your entry here... (Markdown supported)"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="min-h-[500px] text-lg leading-relaxed resize-none border-0 focus-visible:ring-0 px-0 bg-transparent shadow-none"
          />
        </div>
      </div>
    </div>
  );
}
