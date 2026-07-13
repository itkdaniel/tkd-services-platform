import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetCurrentSession,
  useListProjects,
  useDeleteProject,
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
import { ProjectCard } from "@/components/project-card";
import { ProjectFormDialog } from "@/components/project-form-dialog";
import { Plus, Briefcase } from "lucide-react";

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

  const deleteProject = useDeleteProject();

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
          ) : !projects || projects.length === 0 ? (
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {projects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  isAdmin={isAdmin}
                  onEdit={() => openEdit(project)}
                  onDelete={() => setDeletingProject(project)}
                />
              ))}
            </div>
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
