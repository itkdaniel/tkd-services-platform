import { Link } from "wouter";
import type { Project } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Github, PlayCircle, Pencil, Trash2, Boxes, GripVertical } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

/** Drag-handle-only sortable card — works on mouse and touch. */
export function SortableProjectCard(props: Omit<ProjectCardProps, "dragHandleProps">) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props.project.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <ProjectCard
        {...props}
        isDragging={isDragging}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}

type DragHandleProps = React.HTMLAttributes<HTMLElement> & {
  "aria-describedby"?: string;
  "aria-disabled"?: boolean | "false" | "true";
  "aria-pressed"?: boolean | "false" | "true" | "mixed";
  "aria-roledescription"?: string;
  role?: string;
  tabIndex?: number;
};

interface ProjectCardProps {
  project: Project;
  isAdmin: boolean;
  onEdit: () => void;
  onDelete: () => void;
  /** When true, renders a drag handle. Admin only. */
  reorderable?: boolean;
  isDragging?: boolean;
  isDropTarget?: boolean;
  /** Props to spread onto the drag handle element (from dnd-kit useSortable). */
  dragHandleProps?: DragHandleProps;
  /** The currently active tag filter, if any. */
  activeTag?: string | null;
  /** Called when a tag badge is clicked. */
  onTagClick?: (tag: string) => void;
}

export function ProjectCard({
  project,
  isAdmin,
  onEdit,
  onDelete,
  reorderable,
  isDragging,
  isDropTarget,
  dragHandleProps,
  activeTag,
  onTagClick,
}: ProjectCardProps) {
  const thumbnailUrl = project.thumbnailObjectPath ? `/api/storage${project.thumbnailObjectPath}` : null;
  const hasDemo = project.demoType !== "none";
  const tags = project.tags ?? [];

  return (
    <div
      className={cn(
        "group relative flex flex-col rounded-2xl border border-border bg-card overflow-hidden shadow-sm hover:shadow-md transition-shadow",
        isDragging && "opacity-40 shadow-xl",
        isDropTarget && "ring-2 ring-primary",
      )}
    >
      {reorderable && (
        <div
          {...dragHandleProps}
          className="absolute top-3 right-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-background/80 border border-border cursor-grab active:cursor-grabbing text-muted-foreground touch-none"
          aria-label="Drag to reorder"
        >
          <GripVertical className="w-4 h-4" />
        </div>
      )}
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

        {/* Tags */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {tags.map((tag: string) => (
              <button
                key={tag}
                type="button"
                onClick={() => onTagClick?.(tag)}
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
                  activeTag === tag
                    ? "bg-foreground text-background"
                    : "bg-muted text-muted-foreground hover:bg-muted/70",
                  !onTagClick && "cursor-default",
                )}
              >
                {tag}
              </button>
            ))}
          </div>
        )}

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
