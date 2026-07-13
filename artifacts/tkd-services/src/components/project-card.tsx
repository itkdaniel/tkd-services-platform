import { Link } from "wouter";
import type { Project } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Github, PlayCircle, Pencil, Trash2, Boxes } from "lucide-react";

export function ProjectCard({
  project,
  isAdmin,
  onEdit,
  onDelete,
}: {
  project: Project;
  isAdmin: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const thumbnailUrl = project.thumbnailObjectPath ? `/api/storage${project.thumbnailObjectPath}` : null;
  const hasDemo = project.demoType !== "none";

  return (
    <div className="group relative flex flex-col rounded-2xl border border-border bg-card overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      <Link
        href={`/portfolio/${project.id}/demo`}
        className={`relative block aspect-video bg-muted overflow-hidden ${hasDemo ? "cursor-pointer" : "pointer-events-none"}`}
        aria-disabled={!hasDemo}
        onClick={(e) => {
          if (!hasDemo) e.preventDefault();
        }}
      >
        {thumbnailUrl ? (
          <img src={thumbnailUrl} alt={project.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Boxes className="w-10 h-10 text-muted-foreground/40" />
          </div>
        )}
        {hasDemo && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/40 transition-colors">
            <PlayCircle className="w-12 h-12 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
          </div>
        )}
        {project.demoType === "subapp" && (
          <Badge className="absolute top-3 left-3 gap-1" variant="secondary">
            Live sub-app
          </Badge>
        )}
      </Link>

      <div className="flex-1 flex flex-col p-5 gap-2">
        <h3 className="text-xl font-serif font-bold text-foreground">{project.name}</h3>
        <p className="text-sm text-muted-foreground line-clamp-3 flex-1">{project.description}</p>

        <div className="flex items-center justify-between pt-3 mt-1 border-t border-border/60 gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            {project.githubUrl && (
              <Button variant="outline" size="sm" asChild>
                <a href={project.githubUrl} target="_blank" rel="noreferrer">
                  <Github className="w-4 h-4 mr-2" />
                  Code
                </a>
              </Button>
            )}
            {hasDemo && (
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/portfolio/${project.id}/demo`}>
                  <PlayCircle className="w-4 h-4 mr-2" />
                  Demo
                </Link>
              </Button>
            )}
          </div>

          {isAdmin && (
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit} aria-label="Edit project">
                <Pencil className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={onDelete}
                aria-label="Delete project"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
