import { useState, useMemo, useRef, useCallback } from "react";
import { useGetGraph, useGetEntry, useCreateRelation, useGetCurrentSession } from "@workspace/api-client-react";
import { getGetGraphQueryKey, getGetEntryQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import ForceGraph2D from "react-force-graph-2d";
import { Search, X, Link as LinkIcon, ArrowRight, ArrowLeft, Info, Plus } from "lucide-react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import { getColorForCategory } from "@/lib/utils";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const relationSchema = z.object({
  toEntryId: z.number({ required_error: "Target entry is required" }),
  relationType: z.string().min(1, "Relation type is required"),
  weight: z.number().min(0).max(1).optional(),
  justification: z.string().optional(),
});

function EntryDetailPanel({ entryId, onClose, graphNodes }: { entryId: number | null, onClose: () => void, graphNodes: any[] }) {
  const { data: session } = useGetCurrentSession();
  const { data: detail, isLoading } = useGetEntry(entryId || 0, { query: { enabled: !!entryId, queryKey: getGetEntryQueryKey(entryId || 0) } });
  const createRelationMutation = useCreateRelation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isRelDialogOpen, setIsRelDialogOpen] = useState(false);

  const form = useForm<z.infer<typeof relationSchema>>({
    resolver: zodResolver(relationSchema),
    defaultValues: {
      relationType: "",
      justification: "",
    },
  });

  const onSubmit = (values: z.infer<typeof relationSchema>) => {
    if (!entryId) return;
    createRelationMutation.mutate(
      { data: { fromEntryId: entryId, ...values } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetGraphQueryKey({}) });
          queryClient.invalidateQueries({ queryKey: getGetEntryQueryKey(entryId) });
          toast({ title: "Relation created" });
          setIsRelDialogOpen(false);
          form.reset();
        },
        onError: (err) => {
          toast({ title: "Error", description: err.message || "Failed to create relation", variant: "destructive" });
        }
      }
    );
  };

  const isAuthenticated = !!session?.user;

  // For the target entry selection, we can just use the graphNodes to avoid making another huge API call
  // Filter out the current entry
  const availableTargets = graphNodes.filter(n => n.id !== entryId);

  return (
    <Sheet open={!!entryId} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto" side="right">
        {isLoading ? (
          <div className="flex justify-center items-center h-48 animate-pulse text-muted-foreground">Loading details...</div>
        ) : detail ? (
          <>
            <SheetHeader className="mb-6">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="outline" style={{ borderColor: getColorForCategory(detail.table.category), color: getColorForCategory(detail.table.category) }}>
                  {detail.table.category}
                </Badge>
                <span className="text-xs text-muted-foreground">{detail.table.name}</span>
              </div>
              <SheetTitle className="text-2xl">{detail.entry.label}</SheetTitle>
              {detail.table.description && <SheetDescription>{detail.table.description}</SheetDescription>}
            </SheetHeader>

            <div className="space-y-6">
              <section>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                  <Info className="h-4 w-4" /> Data Payload
                </h3>
                <Card className="bg-muted/20 border-border">
                  <CardContent className="p-4 space-y-3">
                    {Object.keys(detail.entry.data).length === 0 ? (
                      <p className="text-sm text-muted-foreground">No data properties</p>
                    ) : (
                      Object.entries(detail.entry.data).map(([k, v]) => (
                        <div key={k}>
                          <span className="text-xs font-mono text-muted-foreground block mb-0.5">{k}</span>
                          <span className="text-sm font-medium">
                            {typeof v === "object" ? JSON.stringify(v) : String(v)}
                          </span>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </section>

              <section>
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <LinkIcon className="h-4 w-4" /> Relations
                  </h3>
                  
                  <Dialog open={isRelDialogOpen} onOpenChange={setIsRelDialogOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="outline" className="h-8 text-xs" disabled={!isAuthenticated} title={!isAuthenticated ? "Sign in to add relations" : undefined}>
                        <Plus className="h-3 w-3 mr-1" /> New
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Create Relation</DialogTitle>
                        <DialogDescription>Link "{detail.entry.label}" to another node.</DialogDescription>
                      </DialogHeader>
                      <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                          <FormField
                            control={form.control}
                            name="toEntryId"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Target Node</FormLabel>
                                <Select onValueChange={(v) => field.onChange(Number(v))} value={field.value ? String(field.value) : undefined}>
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select target node" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent className="max-h-64">
                                    {availableTargets.map(n => (
                                      <SelectItem key={n.id} value={String(n.id)}>
                                        {n.label} <span className="text-muted-foreground text-xs ml-2">({n.tableName})</span>
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="relationType"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Relation Type</FormLabel>
                                <FormControl>
                                  <Input placeholder="e.g. causes, implies, is_related_to" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="weight"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Weight (0.0 to 1.0) - Optional</FormLabel>
                                <FormControl>
                                  <Input type="number" step="0.01" min="0" max="1" placeholder="e.g. 0.85" 
                                    onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)} 
                                    value={field.value !== undefined ? field.value : ""} 
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="justification"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Justification - Optional</FormLabel>
                                <FormControl>
                                  <Textarea placeholder="Why does this relation exist?" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <div className="flex justify-end pt-2">
                            <Button type="submit" disabled={createRelationMutation.isPending}>
                              {createRelationMutation.isPending ? "Creating..." : "Create Edge"}
                            </Button>
                          </div>
                        </form>
                      </Form>
                    </DialogContent>
                  </Dialog>
                </div>

                <div className="space-y-4">
                  {detail.outgoing.length === 0 && detail.incoming.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4 bg-muted/10 rounded-md border border-dashed">No relations yet</p>
                  ) : (
                    <>
                      {detail.outgoing.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                            <ArrowRight className="h-3 w-3" /> Outgoing
                          </h4>
                          {detail.outgoing.map(rel => {
                            const target = graphNodes.find(n => n.id === rel.toEntryId);
                            return (
                              <div key={rel.id} className="text-sm p-3 rounded-md border bg-card shadow-sm">
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                  <span className="font-semibold text-primary">{rel.relationType}</span>
                                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                  <span className="font-medium">{target?.label || `Node #${rel.toEntryId}`}</span>
                                  {rel.weight != null && (
                                    <Badge variant="secondary" className="text-[10px] h-4 ml-auto">
                                      {Math.round(rel.weight * 100)}%
                                    </Badge>
                                  )}
                                </div>
                                {rel.justification && (
                                  <p className="text-xs text-muted-foreground mt-2 italic border-l-2 pl-2">"{rel.justification}"</p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                      
                      {detail.incoming.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                            <ArrowLeft className="h-3 w-3" /> Incoming
                          </h4>
                          {detail.incoming.map(rel => {
                            const source = graphNodes.find(n => n.id === rel.fromEntryId);
                            return (
                              <div key={rel.id} className="text-sm p-3 rounded-md border bg-card shadow-sm">
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                  <span className="font-medium">{source?.label || `Node #${rel.fromEntryId}`}</span>
                                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                  <span className="font-semibold text-primary">{rel.relationType}</span>
                                  {rel.weight != null && (
                                    <Badge variant="secondary" className="text-[10px] h-4 ml-auto">
                                      {Math.round(rel.weight * 100)}%
                                    </Badge>
                                  )}
                                </div>
                                {rel.justification && (
                                  <p className="text-xs text-muted-foreground mt-2 italic border-l-2 pl-2">"{rel.justification}"</p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </section>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

export default function GraphExplorer() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedEntryId, setSelectedEntryId] = useState<number | null>(null);
  const fgRef = useRef<any>(null);
  
  const { data: graphData, isLoading } = useGetGraph({});

  // Transform data for react-force-graph
  const { nodes, links } = useMemo(() => {
    if (!graphData) return { nodes: [], links: [] };
    
    // Add visual properties to nodes
    const graphNodes = graphData.nodes.map(n => {
      const match = searchTerm && n.label.toLowerCase().includes(searchTerm.toLowerCase());
      return {
        ...n,
        color: getColorForCategory(n.category),
        val: 1.5, // size
        _isSearchMatch: match,
        _isDimmed: searchTerm.length > 0 && !match
      };
    });

    // We only want links between nodes that actually exist in our graph data
    const validNodeIds = new Set(graphNodes.map(n => n.id));
    const graphLinks = graphData.edges
      .filter(e => validNodeIds.has(e.source) && validNodeIds.has(e.target))
      .map(e => ({
        ...e,
        source: e.source,
        target: e.target,
        name: e.relationType,
        color: 'rgba(150, 150, 150, 0.4)'
      }));

    return { nodes: graphNodes, links: graphLinks };
  }, [graphData, searchTerm]);

  // Focus node on click
  const handleNodeClick = useCallback((node: any) => {
    setSelectedEntryId(node.id);
    if (fgRef.current) {
      // Aim at node from outside it
      const distance = 40;
      const distRatio = 1 + distance/Math.hypot(node.x, node.y, node.z || 0);
      fgRef.current.centerAt(node.x, node.y, 1000);
      fgRef.current.zoom(8, 1000);
    }
  }, []);

  const drawNode = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const label = node.label;
    const fontSize = 12/globalScale;
    
    // Node circle
    ctx.beginPath();
    ctx.arc(node.x, node.y, node.val, 0, 2 * Math.PI, false);
    
    if (node._isSearchMatch) {
      ctx.fillStyle = node.color;
      ctx.shadowColor = node.color;
      ctx.shadowBlur = 10;
      ctx.fill();
      ctx.shadowBlur = 0; // reset
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1/globalScale;
      ctx.stroke();
    } else if (node._isDimmed) {
      ctx.fillStyle = `${node.color}40`; // 25% opacity
      ctx.fill();
    } else {
      ctx.fillStyle = node.color;
      ctx.fill();
    }
    
    // Label
    if (!node._isDimmed || node._isSearchMatch) {
      ctx.font = `${fontSize}px "Plus Jakarta Sans", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      // Label background for legibility
      const textWidth = ctx.measureText(label).width;
      const bckgDimensions = [textWidth, fontSize].map(n => n + fontSize * 0.2); 
      
      const isDark = document.documentElement.classList.contains('dark');
      ctx.fillStyle = isDark ? 'rgba(10, 10, 10, 0.85)' : 'rgba(255, 255, 255, 0.85)';
      
      const textY = node.y + node.val + fontSize;
      ctx.fillRect(node.x - bckgDimensions[0] / 2, textY - bckgDimensions[1] / 2, bckgDimensions[0], bckgDimensions[1]);
      
      ctx.fillStyle = node._isSearchMatch ? '#0A369D' : (isDark ? '#e5e7eb' : '#1a1a1a');
      ctx.fillText(label, node.x, textY);
    }
  }, []);

  const drawLink = useCallback((link: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const start = link.source;
    const end = link.target;
    
    if (!start.x || !start.y || !end.x || !end.y) return;

    // Draw link line
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.strokeStyle = link.color;
    ctx.lineWidth = Math.max(0.5, link.weight ? link.weight * 2 : 1) / globalScale;
    ctx.stroke();

    // Draw relation type if zoomed in enough
    if (globalScale > 3) {
      const midX = (start.x + end.x) / 2;
      const midY = (start.y + end.y) / 2;
      
      const fontSize = 8/globalScale;
      ctx.font = `${fontSize}px "Spline Sans Mono", monospace`;
      
      const label = link.name;
      const textWidth = ctx.measureText(label).width;
      
      const isDark = document.documentElement.classList.contains('dark');
      ctx.fillStyle = isDark ? 'rgba(10, 10, 10, 0.75)' : 'rgba(255, 255, 255, 0.75)';
      ctx.fillRect(midX - textWidth / 2 - 2/globalScale, midY - fontSize / 2 - 2/globalScale, textWidth + 4/globalScale, fontSize + 4/globalScale);
      
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#888';
      ctx.fillText(label, midX, midY);
    }
  }, []);

  return (
    <div className="relative w-full h-full flex flex-col bg-background/50">
      {/* Top overlay controls */}
      <div className="absolute top-4 left-4 right-4 z-10 flex justify-between items-start pointer-events-none">
        <div className="bg-card/90 backdrop-blur border shadow-sm p-3 rounded-lg pointer-events-auto max-w-sm w-full animate-in fade-in slide-in-from-top-4">
          <h1 className="text-xl font-bold tracking-tight mb-2">Knowledge Graph</h1>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search nodes by label..." 
              className="pl-9 h-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm("")}
                className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="mt-3 text-xs text-muted-foreground flex gap-3 flex-wrap">
            <span className="font-medium">Stats:</span>
            <span>{nodes.length} Nodes</span>
            <span>{links.length} Edges</span>
          </div>
        </div>

        {/* Legend */}
        {nodes.length > 0 && (
          <div className="hidden lg:block bg-card/90 backdrop-blur border shadow-sm p-3 rounded-lg pointer-events-auto">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Categories</h3>
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
              {Array.from(new Set(nodes.map(n => n.category))).map(cat => (
                <div key={cat} className="flex items-center gap-2 text-sm">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: getColorForCategory(cat) }} />
                  <span className="truncate max-w-[120px]" title={cat}>{cat}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Graph Area */}
      <div className="flex-1 w-full h-full cursor-grab active:cursor-grabbing">
        {isLoading ? (
          <div className="w-full h-full flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : nodes.length === 0 ? (
          <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground">
            <Network className="h-16 w-16 opacity-20 mb-4" />
            <h2 className="text-xl font-medium text-foreground">Graph is empty</h2>
            <p className="mt-2 text-sm max-w-md text-center">Create feature databases and add entries to start building your knowledge graph.</p>
          </div>
        ) : (
          <ForceGraph2D
            ref={fgRef}
            graphData={{ nodes, links }}
            nodeLabel="label"
            nodeRelSize={4}
            nodeCanvasObject={drawNode}
            nodeCanvasObjectMode={() => "replace"}
            linkColor={() => "rgba(150,150,150,0.3)"}
            linkCanvasObject={drawLink}
            linkCanvasObjectMode={() => "replace"}
            onNodeClick={handleNodeClick}
            d3AlphaDecay={0.01}
            d3VelocityDecay={0.08}
            cooldownTicks={100}
            warmupTicks={50}
          />
        )}
      </div>

      <EntryDetailPanel 
        entryId={selectedEntryId} 
        onClose={() => setSelectedEntryId(null)} 
        graphNodes={graphData?.nodes || []} 
      />
    </div>
  );
}

// Dummy icon for empty state
function Network(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="16" y="16" width="6" height="6" rx="1" />
      <rect x="2" y="16" width="6" height="6" rx="1" />
      <rect x="9" y="2" width="6" height="6" rx="1" />
      <path d="M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3" />
      <path d="M12 12V8" />
    </svg>
  );
}
