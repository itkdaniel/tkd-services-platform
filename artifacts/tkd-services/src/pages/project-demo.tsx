import { useParams, Link } from "wouter";
import { useGetProject, getGetProjectQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Github, ExternalLink } from "lucide-react";

export default function ProjectDemo() {
  const { projectId } = useParams();
  const id = Number(projectId);

  const { data: project, isLoading } = useGetProject(id, {
    query: { enabled: Number.isInteger(id), queryKey: getGetProjectQueryKey(id) },
  });

  const demoSrc =
    project?.demoType === "subapp"
      ? `/api/projects/${project.id}/subapp/`
      : project?.demoType === "external"
        ? project.demoUrl ?? undefined
        : undefined;

  return (
    <div className="flex flex-col w-full min-h-[80vh] animate-in fade-in duration-500">
      <div className="border-b border-border bg-card px-4 md:px-8 py-4 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4 min-w-0">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/portfolio">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Portfolio
            </Link>
          </Button>
          {project && <h1 className="text-lg font-serif font-bold truncate">{project.name}</h1>}
        </div>
        <div className="flex items-center gap-2">
          {project?.githubUrl && (
            <Button variant="outline" size="sm" asChild>
              <a href={project.githubUrl} target="_blank" rel="noreferrer">
                <Github className="w-4 h-4 mr-2" />
                View code
              </a>
            </Button>
          )}
          {demoSrc && (
            <Button variant="outline" size="sm" asChild>
              <a href={demoSrc} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-4 h-4 mr-2" />
                Open in new tab
              </a>
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 bg-muted/30">
        {isLoading ? (
          <Skeleton className="w-full h-[80vh]" />
        ) : !project ? (
          <div className="flex items-center justify-center h-[60vh] text-muted-foreground">Project not found.</div>
        ) : !demoSrc ? (
          <div className="flex items-center justify-center h-[60vh] text-muted-foreground text-center px-4">
            No live demo is available for this project yet.
          </div>
        ) : (
          <iframe
            key={demoSrc}
            src={demoSrc}
            title={`${project.name} demo`}
            className="w-full h-[80vh] border-0"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            referrerPolicy="no-referrer"
          />
        )}
      </div>
    </div>
  );
}
