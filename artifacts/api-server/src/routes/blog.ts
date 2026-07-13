import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import { db, blogPostsTable } from "@workspace/db";
import {
  CreateBlogPostBody,
  CreateBlogPostResponse,
  GetBlogPostParams,
  GetBlogPostResponse,
  UpdateBlogPostParams,
  UpdateBlogPostBody,
  UpdateBlogPostResponse,
  DeleteBlogPostParams,
  ListBlogPostsResponse,
} from "@workspace/api-zod";
import { requireRole } from "../middlewares/auth";
import { toPlain } from "../lib/serialize";

const router: IRouter = Router();

function slugify(title: string): string {
  const base = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base.length > 0 ? base : `post-${Date.now()}`;
}

async function uniqueSlug(title: string): Promise<string> {
  const base = slugify(title);
  let slug = base;
  let attempt = 1;
  while (true) {
    const existing = await db
      .select({ id: blogPostsTable.id })
      .from(blogPostsTable)
      .where(eq(blogPostsTable.slug, slug));
    if (existing.length === 0) return slug;
    attempt += 1;
    slug = `${base}-${attempt}`;
  }
}

router.get("/blog/posts", async (_req, res): Promise<void> => {
  const posts = await db.select().from(blogPostsTable).orderBy(desc(blogPostsTable.createdAt));
  res.json(ListBlogPostsResponse.parse(toPlain(posts)));
});

router.post("/blog/posts", requireRole("admin"), async (req, res): Promise<void> => {
  const parsed = CreateBlogPostBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const slug = await uniqueSlug(parsed.data.title);

  const [post] = await db
    .insert(blogPostsTable)
    .values({
      title: parsed.data.title,
      slug,
      body: parsed.data.body,
      authorUsername: req.currentUser?.username ?? null,
    })
    .returning();

  if (!post) {
    req.log.error("Insert returned no row for new blog post");
    res.status(500).json({ error: "Failed to create post" });
    return;
  }

  res.status(201).json(CreateBlogPostResponse.parse(toPlain(post)));
});

router.get("/blog/posts/:postId", async (req, res): Promise<void> => {
  const params = GetBlogPostParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [post] = await db.select().from(blogPostsTable).where(eq(blogPostsTable.id, params.data.postId));

  if (!post) {
    res.status(404).json({ error: "Post not found" });
    return;
  }

  res.json(GetBlogPostResponse.parse(toPlain(post)));
});

router.patch("/blog/posts/:postId", requireRole("admin"), async (req, res): Promise<void> => {
  const params = UpdateBlogPostParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateBlogPostBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [post] = await db
    .update(blogPostsTable)
    .set(parsed.data)
    .where(eq(blogPostsTable.id, params.data.postId))
    .returning();

  if (!post) {
    res.status(404).json({ error: "Post not found" });
    return;
  }

  res.json(UpdateBlogPostResponse.parse(toPlain(post)));
});

router.delete("/blog/posts/:postId", requireRole("admin"), async (req, res): Promise<void> => {
  const params = DeleteBlogPostParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [post] = await db.delete(blogPostsTable).where(eq(blogPostsTable.id, params.data.postId)).returning();

  if (!post) {
    res.status(404).json({ error: "Post not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
