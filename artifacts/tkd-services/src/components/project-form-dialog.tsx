import { useEffect, useRef, useState } from "react";
import type { Project } from "@workspace/api-client-react";
import {
  useCreateProject,
  useUpdateProject,
  useRegisterProjectSubapp,
  useRemoveProjectSubapp,
  useGetProjectSubappStorageUsage,
  getGetProjectSubappStorageUsageQueryKey,
} from "@workspace/api-client-react";
import { useDirectUpload } from "@/hooks/use-direct-upload";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { ImagePlus, Loader2, UploadCloud, PackageX } from "lucide-react";

const MAX_THUMBNAIL_BYTES = 5 * 1024 * 1024;
const ALLOWED_THUMBNAIL_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const MAX_ARCHIVE_BYTES = 25 * 1024 * 1024;

function formatMB(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(0);
}

export function ProjectFormDialog({
  open,
  onOpenChange,
  project,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: Project | null;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const isEditing = !!project;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [githubUrl, setGithubUrl] = useState("");
  const [demoUrl, setDemoUrl] = useState("");
  const [thumbnailObjectPath, setThumbnailObjectPath] = useState<string | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { upload, isUploading } = useDirectUpload();

  useEffect(() => {
    if (open) {
      setName(project?.name ?? "");
      setDescription(project?.description ?? "");
      setGithubUrl(project?.githubUrl ?? "");
      setDemoUrl(project?.demoUrl ?? "");
      setThumbnailObjectPath(project?.thumbnailObjectPath ?? null);
      setThumbnailPreview(project?.thumbnailObjectPath ? `/api/storage${project.thumbnailObjectPath}` : null);
    }
  }, [open, project]);

  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const isSaving = createProject.isPending || updateProject.isPending;

  const archiveUpload = useDirectUpload();
  const registerSubapp = useRegisterProjectSubapp();
  const removeSubapp = useRemoveProjectSubapp();
  const archiveInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // Only fetched while the dialog is open and editing, since it's admin-only
  // and there's no point polling it from the create-project form.
  const storageUsage = useGetProjectSubappStorageUsage({
    query: { enabled: open && isEditing, queryKey: getGetProjectSubappStorageUsageQueryKey() },
  });
  const usagePercent = storageUsage.data
    ? Math.min(100, Math.round((storageUsage.data.usedBytes / storageUsage.data.quotaBytes) * 100))
    : null;

  const handleArchiveFile = async (file: File | undefined) => {
    if (!file || !project) return;
    if (!file.name.toLowerCase().endsWith(".zip")) {
      toast({ title: "Unsupported file", description: "Only .zip archives are accepted.", variant: "destructive" });
      return;
    }
    if (file.size > MAX_ARCHIVE_BYTES) {
      toast({ title: "Archive too large", description: "Archives must be under 25MB.", variant: "destructive" });
      return;
    }
    try {
      const meta = await archiveUpload.upload(file);
      await registerSubapp.mutateAsync({ projectId: project.id, data: meta });
      toast({ title: "Sub-app deployed", description: "The archive was extracted and is now live as this project's demo." });
      onSaved();
    } catch (err) {
      toast({
        title: "Sub-app upload failed",
        description: err instanceof Error ? err.message : (err as any)?.message || "Please check the archive and try again.",
        variant: "destructive",
      });
    }
  };

  const handleRemoveSubapp = async () => {
    if (!project) return;
    try {
      await removeSubapp.mutateAsync({ projectId: project.id });
      toast({ title: "Sub-app removed" });
      onSaved();
    } catch (err) {
      toast({ title: "Failed to remove sub-app", description: (err as any)?.message, variant: "destructive" });
    }
  };

  const handleThumbnailPick = async (file: File | undefined) => {
    if (!file) return;
    if (!ALLOWED_THUMBNAIL_TYPES.has(file.type)) {
      toast({ title: "Unsupported image type", description: "Use PNG, JPEG, WEBP, or GIF.", variant: "destructive" });
      return;
    }
    if (file.size > MAX_THUMBNAIL_BYTES) {
      toast({ title: "Image too large", description: "Thumbnails must be under 5MB.", variant: "destructive" });
      return;
    }
    setThumbnailPreview(URL.createObjectURL(file));
    try {
      const meta = await upload(file);
      setThumbnailObjectPath(meta.objectPath);
    } catch (err) {
      toast({
        title: "Thumbnail upload failed",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async () => {
    if (!name.trim() || !description.trim()) {
      toast({ title: "Missing fields", description: "Name and description are required.", variant: "destructive" });
      return;
    }

    const data = {
      name: name.trim(),
      description: description.trim(),
      githubUrl: githubUrl.trim() || null,
      demoUrl: demoUrl.trim() || null,
      thumbnailObjectPath,
    };

    try {
      if (isEditing) {
        await updateProject.mutateAsync({ projectId: project.id, data });
        toast({ title: "Project updated" });
      } else {
        await createProject.mutateAsync({ data: { ...data, thumbnailObjectPath: thumbnailObjectPath ?? undefined, githubUrl: githubUrl.trim() || undefined, demoUrl: demoUrl.trim() || undefined } });
        toast({ title: "Project created" });
      }
      onOpenChange(false);
      onSaved();
    } catch (err) {
      toast({
        title: "Save failed",
        description: (err as any)?.message || "An unknown error occurred.",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit project" : "Add a project"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update this project's showcase details."
              : "Add a new entry to the portfolio grid. You can attach a live sub-app afterward."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="relative w-24 h-24 rounded-xl border border-dashed border-border bg-muted flex items-center justify-center overflow-hidden shrink-0"
            >
              {thumbnailPreview ? (
                <img src={thumbnailPreview} alt="Thumbnail preview" className="w-full h-full object-cover" />
              ) : (
                <ImagePlus className="w-6 h-6 text-muted-foreground" />
              )}
              {isUploading && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <Loader2 className="w-5 h-5 text-white animate-spin" />
                </div>
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={(e) => handleThumbnailPick(e.target.files?.[0])}
            />
            <div className="text-sm text-muted-foreground">
              Click to upload a thumbnail. PNG, JPEG, WEBP, or GIF, up to 5MB.
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="project-name">Name</Label>
            <Input id="project-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Project name" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="project-description">Description</Label>
            <Textarea
              id="project-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="A short summary of what this project is and does."
              className="min-h-24"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="project-github">GitHub URL</Label>
            <Input
              id="project-github"
              value={githubUrl}
              onChange={(e) => setGithubUrl(e.target.value)}
              placeholder="https://github.com/username/repo"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="project-demo">External demo URL (optional)</Label>
            <Input
              id="project-demo"
              value={demoUrl}
              onChange={(e) => setDemoUrl(e.target.value)}
              placeholder="https://example.com"
            />
            <p className="text-xs text-muted-foreground">
              Shown embedded on the demo page. Leave blank if you'll upload a sub-app archive instead, after saving.
            </p>
          </div>

          {isEditing && (
            <div className="space-y-2 pt-2 border-t border-border">
              <Label>Live sub-app archive</Label>
              {storageUsage.data && usagePercent !== null && (
                <div className="space-y-1">
                  <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full ${usagePercent >= 90 ? "bg-destructive" : "bg-primary"}`}
                      style={{ width: `${usagePercent}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Shared sub-app storage: {formatMB(storageUsage.data.usedBytes)}MB of{" "}
                    {formatMB(storageUsage.data.quotaBytes)}MB used across all projects ({usagePercent}%).
                  </p>
                </div>
              )}
              {project!.demoType === "subapp" ? (
                <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 p-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Badge variant="secondary">Deployed</Badge>
                    <span className="text-muted-foreground">This project's demo is served from an uploaded archive.</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRemoveSubapp}
                    disabled={removeSubapp.isPending}
                  >
                    <PackageX className="w-4 h-4 mr-2" />
                    Remove
                  </Button>
                </div>
              ) : (
                <div
                  className={`rounded-lg border-2 border-dashed p-4 text-center text-sm transition-colors ${
                    isDragOver ? "border-primary bg-primary/5" : "border-border"
                  }`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragOver(true);
                  }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragOver(false);
                    handleArchiveFile(e.dataTransfer.files?.[0]);
                  }}
                >
                  <UploadCloud className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-muted-foreground mb-2">
                    Drag and drop a .zip build here to host it as this project's live demo.
                  </p>
                  <input
                    ref={archiveInputRef}
                    type="file"
                    accept=".zip"
                    className="hidden"
                    onChange={(e) => handleArchiveFile(e.target.files?.[0])}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={archiveUpload.isUploading || registerSubapp.isPending}
                    onClick={() => archiveInputRef.current?.click()}
                  >
                    {archiveUpload.isUploading
                      ? `Uploading… ${archiveUpload.progress}%`
                      : registerSubapp.isPending
                        ? "Extracting…"
                        : "Choose .zip"}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSaving || isUploading}>
            {isSaving ? "Saving..." : isEditing ? "Save changes" : "Create project"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
