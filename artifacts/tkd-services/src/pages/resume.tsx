import { useCallback, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetCurrentSession,
  useGetCurrentResume,
  useListResumeVersions,
  useUpdateResumeVersion,
  useBulkDeleteResumeVersions,
  getGetCurrentResumeQueryKey,
  getListResumeVersionsQueryKey,
} from "@workspace/api-client-react";
import { useResumeUpload } from "@/hooks/use-resume-upload";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  UploadCloud,
  FileText,
  Trash2,
  Pencil,
  Save,
  X,
  Star,
  Download,
} from "lucide-react";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function ResumePage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: session } = useGetCurrentSession();
  const currentUser = session?.user ?? null;
  const isSignedIn = !!currentUser;
  const isAdmin = currentUser?.role === "admin";

  const { data: currentData, isLoading: isLoadingCurrent } = useGetCurrentResume();
  const { data: versions, isLoading: isLoadingVersions } = useListResumeVersions({
    query: { enabled: isSignedIn, queryKey: getListResumeVersionsQueryKey() },
  });

  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: getGetCurrentResumeQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListResumeVersionsQueryKey() });
  }, [queryClient]);

  const { upload, isUploading, progress, error: uploadError } = useResumeUpload(() => {
    invalidateAll();
    toast({ title: "Résumé uploaded", description: "Your file has been added to the history." });
  });

  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    (file: File | undefined) => {
      if (!file) return;
      void upload(file);
    },
    [upload],
  );

  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const bulkDelete = useBulkDeleteResumeVersions();

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleBulkDelete = () => {
    if (selectedIds.length === 0) return;
    bulkDelete.mutate(
      { data: { ids: selectedIds } },
      {
        onSuccess: () => {
          setSelectedIds([]);
          invalidateAll();
          toast({ title: "Deleted", description: "Selected versions were removed." });
        },
        onError: (err) => {
          toast({
            title: "Delete failed",
            description: (err as any).message || "You may not have permission to delete all selected files.",
            variant: "destructive",
          });
        },
      },
    );
  };

  // Admin edit mode: staged local changes, explicit Save/Discard
  const [isEditMode, setIsEditMode] = useState(false);
  const [stagedCurrentId, setStagedCurrentId] = useState<number | null>(null);
  const [stagedLabels, setStagedLabels] = useState<Record<number, string>>({});
  const updateVersion = useUpdateResumeVersion();

  const enterEditMode = () => {
    setStagedCurrentId(currentData?.current?.id ?? null);
    setStagedLabels(
      Object.fromEntries((versions ?? []).map((v) => [v.id, v.label ?? ""])),
    );
    setIsEditMode(true);
  };

  const discardEdits = () => {
    setIsEditMode(false);
    setStagedCurrentId(null);
    setStagedLabels({});
  };

  const saveEdits = async () => {
    const patches: Array<{ versionId: number; data: { label?: string; isCurrent?: boolean } }> = [];

    for (const v of versions ?? []) {
      const data: { label?: string; isCurrent?: boolean } = {};
      const stagedLabel = stagedLabels[v.id] ?? "";
      if (stagedLabel !== (v.label ?? "")) data.label = stagedLabel;
      if (stagedCurrentId === v.id && !v.isCurrent) data.isCurrent = true;
      if (Object.keys(data).length > 0) patches.push({ versionId: v.id, data });
    }

    if (patches.length === 0) {
      setIsEditMode(false);
      return;
    }

    try {
      await Promise.all(patches.map((p) => updateVersion.mutateAsync(p)));
      invalidateAll();
      toast({ title: "Changes saved", description: "Résumé metadata has been updated." });
      setIsEditMode(false);
    } catch (err) {
      toast({
        title: "Save failed",
        description: (err as any).message || "Some changes could not be saved.",
        variant: "destructive",
      });
    }
  };

  const currentResume = currentData?.current ?? null;
  const viewerUrl = useMemo(
    () => (currentResume ? `/api/storage${currentResume.objectPath}` : null),
    [currentResume],
  );

  return (
    <div className="container mx-auto max-w-5xl px-4 py-12 md:py-20 animate-in fade-in duration-500">
      <div className="mb-10 text-center space-y-3">
        <h1 className="text-4xl md:text-5xl font-serif font-bold text-foreground">Résumé</h1>
        <p className="text-lg text-muted-foreground">
          The latest version of my professional history, always available for review.
        </p>
      </div>

      {/* Public inline viewer */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm mb-10">
        {isLoadingCurrent ? (
          <Skeleton className="h-[70vh] w-full" />
        ) : viewerUrl ? (
          <div className="relative">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <FileText className="w-4 h-4" />
                <span>{currentResume?.filename}</span>
                {currentResume?.label && <Badge variant="secondary">{currentResume.label}</Badge>}
              </div>
              <Button variant="outline" size="sm" asChild>
                <a href={viewerUrl} download={currentResume?.filename}>
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </a>
              </Button>
            </div>
            <object data={viewerUrl} type="application/pdf" className="w-full h-[70vh]">
              <div className="flex items-center justify-center h-[70vh] text-muted-foreground">
                <p>
                  Unable to preview this PDF inline.{" "}
                  <a href={viewerUrl} className="underline" target="_blank" rel="noreferrer">
                    Open it directly
                  </a>
                  .
                </p>
              </div>
            </object>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-64 text-center px-4 gap-2 text-muted-foreground">
            <FileText className="w-10 h-10" />
            <p>No résumé has been uploaded yet.</p>
          </div>
        )}
      </div>

      {/* Upload control — any signed-in user */}
      {isSignedIn && (
        <div
          className={`rounded-2xl border-2 border-dashed p-8 text-center mb-10 transition-colors ${
            isDragOver ? "border-primary bg-primary/5" : "border-border bg-card"
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragOver(false);
            handleFile(e.dataTransfer.files?.[0]);
          }}
        >
          <UploadCloud className="w-8 h-8 mx-auto mb-3 text-muted-foreground" />
          <p className="mb-3 text-sm text-muted-foreground">
            Drag and drop a PDF here, or choose a file to upload a new version.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
          <Button
            variant="outline"
            className="rounded-full"
            disabled={isUploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {isUploading ? `Uploading… ${progress}%` : "Choose PDF"}
          </Button>
          {uploadError && <p className="mt-3 text-sm text-destructive">{uploadError}</p>}
        </div>
      )}

      {/* History — signed-in users only */}
      {isSignedIn && (
        <div className="rounded-2xl border border-border bg-card p-6 md:p-8">
          <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
            <h2 className="text-xl font-serif font-bold">Upload History</h2>
            <div className="flex items-center gap-2">
              {selectedIds.length > 0 && !isEditMode && (
                <Button variant="destructive" size="sm" onClick={handleBulkDelete} disabled={bulkDelete.isPending}>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete ({selectedIds.length})
                </Button>
              )}
              {isAdmin && !isEditMode && (
                <Button variant="outline" size="sm" onClick={enterEditMode}>
                  <Pencil className="w-4 h-4 mr-2" />
                  Edit
                </Button>
              )}
              {isAdmin && isEditMode && (
                <>
                  <Button variant="ghost" size="sm" onClick={discardEdits}>
                    <X className="w-4 h-4 mr-2" />
                    Discard
                  </Button>
                  <Button size="sm" onClick={saveEdits} disabled={updateVersion.isPending}>
                    <Save className="w-4 h-4 mr-2" />
                    Save
                  </Button>
                </>
              )}
            </div>
          </div>

          {isLoadingVersions ? (
            <div className="space-y-3">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ) : !versions || versions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No uploads yet.</p>
          ) : (
            <div className="space-y-3">
              {versions.map((v) => {
                const canDelete = isAdmin || v.uploaderId === currentUser?.id;
                const isStagedCurrent = isEditMode ? stagedCurrentId === v.id : v.isCurrent;
                return (
                  <div
                    key={v.id}
                    className="flex items-center gap-4 p-4 rounded-xl border border-border bg-background/50"
                  >
                    {canDelete && !isEditMode && (
                      <Checkbox
                        checked={selectedIds.includes(v.id)}
                        onCheckedChange={() => toggleSelect(v.id)}
                        aria-label={`Select ${v.filename}`}
                      />
                    )}
                    {isEditMode && isAdmin && (
                      <input
                        type="radio"
                        name="current-version"
                        checked={stagedCurrentId === v.id}
                        onChange={() => setStagedCurrentId(v.id)}
                        aria-label={`Set ${v.filename} as current`}
                        className="w-4 h-4"
                      />
                    )}
                    <FileText className="w-5 h-5 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium truncate">{v.filename}</span>
                        {isStagedCurrent && (
                          <Badge className="gap-1">
                            <Star className="w-3 h-3" /> Current
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(v.createdAt)} • {formatBytes(v.sizeBytes)} • Uploaded by{" "}
                        {v.uploaderUsername}
                      </p>
                      {isEditMode && isAdmin ? (
                        <Input
                          className="mt-2 h-8 text-sm"
                          placeholder="Label (e.g. 2026 Update)"
                          value={stagedLabels[v.id] ?? ""}
                          onChange={(e) =>
                            setStagedLabels((prev) => ({ ...prev, [v.id]: e.target.value }))
                          }
                        />
                      ) : (
                        v.label && (
                          <Badge variant="secondary" className="mt-1">
                            {v.label}
                          </Badge>
                        )
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
