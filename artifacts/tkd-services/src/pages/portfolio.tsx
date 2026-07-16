import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetCurrentSession,
  useListProjects,
  useDeleteProject,
  useReorderProjects,
  getListProjectsQueryKey,
  type Project,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { SortableProjectCard, ProjectCard } from "@/components/project-card";
import { ProjectFormDialog } from "@/components/project-form-dialog";
import { Plus, Briefcase } from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy } from "@dnd-kit/sortable";

export default function Portfolio() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: session } = useGetCurrentSession();
  const isAdmin = session?.user?.role === "admin";

  const { data: projects, isLoading } = useListProjects();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });

  const [formOpen, setFormOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [deletingProject, setDeletingProject] = useState<Project | null>(null);
  const [activeTag, setActiveTag] = useState<string | null>(null);

  const deleteProject = useDeleteProject();
  const reorderProjects = useReorderProjects();

  // Local optimistic ordering the admin can drag around. Kept in sync with
  // the server list whenever it changes and we're not mid-drag.
  const [orderedProjects, setOrderedProjects] = useState<Project[] | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (isDragging) return; // don't clobber an in-progress drag
    setOrderedProjects(projects ?? null);
  }, [projects, isDragging]);

  // All unique tags across all projects, in the order they first appear.
  const allTags = useMemo(() => {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const p of projects ?? []) {
      for (const t of p.tags ?? []) {
        if (!seen.has(t)) {
          seen.add(t);
          result.push(t);
        }
      }
    }
    return result;
  }, [projects]);

  // When the tag list changes (e.g. a tag is removed from all projects),
  // clear the active filter if it no longer exists.
  useEffect(() => {
    if (activeTag && !allTags.includes(activeTag)) {
      setActiveTag(null);
    }
  }, [allTags, activeTag]);

  const baseProjects = orderedProjects ?? projects ?? [];

  const displayProjects = useMemo(() => {
    if (!activeTag) return baseProjects;
    return baseProjects.filter((p) => (p.tags ?? []).includes(activeTag));
  }, [baseProjects, activeTag]);

  // dnd-kit sensors — PointerSensor covers mouse + stylus; TouchSensor covers
  // finger touch. activationConstraint on touch prevents accidental drags
  // while scrolling (requires 250 ms press or 5 px movement before activating).
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 5 },
    }),
  );

  const handleDragStart = () => setIsDragging(true);

  const handleDragEnd = async (event: DragEndEvent) => {
    setIsDragging(false);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setOrderedProjects((current) => {
      if (!current) return current;
      const oldIndex = current.findIndex((p) => p.id === active.id);
      const newIndex = current.findIndex((p) => p.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return current;
      return arrayMove(current, oldIndex, newIndex);
    });

    // Persist — read the freshly reordered list from state after the setState
    // has been applied. We capture ids before the async gap.
    const reordered = (() => {
      const current = orderedProjects ?? [];
      const oldIndex = current.findIndex((p) => p.id === active.id);
      const newIndex = current.findIndex((p) => p.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return current;
      return arrayMove(current, oldIndex, newIndex);
    })();

    try {
      await reorderProjects.mutateAsync({ data: { ids: reordered.map((p) => p.id) } });
      invalidate();
    } catch (err) {
      toast({ title: "Reorder failed", description: (err as any)?.message, variant: "destructive" });
      invalidate();
    }
  };

  const openCreate = () => {
    setEditingProject(null);
    setFormOpen(true);
  };

  const openEdit = (project: Project) => {
    setEditingProject(project);
    setFormOpen(true);
  };

  const confirmDelete = async () => {
    if (!deletingProject) return;
    try {
      await deleteProject.mutateAsync({ projectId: deletingProject.id });
      toast({ title: "Project deleted" });
      invalidate();
    } catch (err) {
      toast({ title: "Delete failed", description: (err as any)?.message, variant: "destructive" });
    } finally {
      setDeletingProject(null);
    }
  };

  const hasProjects = (projects ?? []).length > 0;
  // Reordering via drag is disabled while a tag filter is active, because the
  // displayed list is a subset of the full order — moving within it would
  // produce an ambiguous result.
  const reorderable = isAdmin && !activeTag;

  return (
    <div className="flex flex-col w-full animate-in fade-in duration-500">
      <section className="px-4 md:px-8 py-20 md:py-32 w-full bg-card border-b border-border">
        <div className="container mx-auto max-w-6xl">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <h1 className="text-5xl md:text-7xl font-serif font-bold mb-6 text-foreground">Selected Works.</h1>
              <p className="text-xl md:text-2xl text-muted-foreground leading-relaxed max-w-2xl">
                A running collection of shipped projects, with live demos where available.
              </p>
            </div>
            {isAdmin && (
              <Button className="rounded-full" onClick={openCreate}>
                <Plus className="mr-2 h-4 w-4" />
                Add Project
              </Button>
            )}
          </div>
        </div>
      </section>

      <section className="px-4 md:px-8 py-16 w-full">
        <div className="container mx-auto max-w-6xl">
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-80 w-full rounded-2xl" />
              ))}
            </div>
          ) : !hasProjects ? (
            <div className="text-center py-24 bg-card rounded-2xl border border-border border-dashed">
              <Briefcase className="w-10 h-10 mx-auto mb-4 text-muted-foreground/50" />
              <p className="text-lg text-muted-foreground">No projects have been added yet.</p>
              {isAdmin && (
                <Button className="mt-6" variant="outline" onClick={openCreate}>
                  Add the first project
                </Button>
              )}
            </div>
          ) : (
            <>
              {/* Tag filter strip — only shown when there are tags to filter by */}
              {allTags.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-6">
                  <button
                    onClick={() => setActiveTag(null)}
                    className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                      activeTag === null
                        ? "bg-foreground text-background"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    All
                  </button>
                  {allTags.map((tag) => (
                    <button
                      key={tag}
                      onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                      className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                        activeTag === tag
                          ? "bg-foreground text-background"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              )}

              {isAdmin && (
                <p className="text-sm text-muted-foreground mb-4">
                  {reorderable
                    ? "Press and hold a card's handle to reorder — works on touch screens too."
                    : "Clear the tag filter to reorder cards."}
                </p>
              )}

              {displayProjects.length === 0 ? (
                <div className="text-center py-24 bg-card rounded-2xl border border-border border-dashed">
                  <Briefcase className="w-10 h-10 mx-auto mb-4 text-muted-foreground/50" />
                  <p className="text-lg text-muted-foreground">No projects match this filter.</p>
                  <Button className="mt-6" variant="outline" onClick={() => setActiveTag(null)}>
                    Show all
                  </Button>
                </div>
              ) : reorderable ? (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext items={displayProjects.map((p) => p.id)} strategy={rectSortingStrategy}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                      {displayProjects.map((project) => (
                        <SortableProjectCard
                          key={project.id}
                          project={project}
                          isAdmin={isAdmin}
                          onEdit={() => openEdit(project)}
                          onDelete={() => setDeletingProject(project)}
                          reorderable={true}
                          activeTag={activeTag}
                          onTagClick={(tag) => setActiveTag(activeTag === tag ? null : tag)}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {displayProjects.map((project) => (
                    <ProjectCard
                      key={project.id}
                      project={project}
                      isAdmin={isAdmin}
                      onEdit={() => openEdit(project)}
                      onDelete={() => setDeletingProject(project)}
                      reorderable={false}
                      activeTag={activeTag}
                      onTagClick={(tag) => setActiveTag(activeTag === tag ? null : tag)}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </section>

      <ProjectFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        project={editingProject}
        onSaved={invalidate}
      />

      <AlertDialog open={!!deletingProject} onOpenChange={(open) => !open && setDeletingProject(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deletingProject?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the project, its thumbnail, and any hosted sub-app files. This cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
