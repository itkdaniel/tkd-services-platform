import { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { 
  useGetTable, 
  useListFields, 
  useCreateField, 
  useListEntries, 
  useCreateEntry,
  useDeleteTable,
  useGetCurrentSession,
  useDeleteEntry,
  FieldDataType,
  FeatureField
} from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { getListFieldsQueryKey, getListEntriesQueryKey, getListTablesQueryKey } from "@workspace/api-client-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Trash2, Plus, Database, Columns, FileJson, AlertCircle } from "lucide-react";
import { format } from "date-fns";

const fieldSchema = z.object({
  name: z.string().min(1, "Name is required").regex(/^[a-zA-Z0-9_]+$/, "Only alphanumeric and underscores"),
  dataType: z.enum(["string", "number", "boolean", "date", "json"]),
  description: z.string().optional(),
  required: z.boolean().default(false),
});

interface EntryFormProps {
  tableId: number;
  fields: FeatureField[];
  onSuccess: () => void;
}

function EntryForm({ tableId, fields, onSuccess }: EntryFormProps) {
  const [useRawJson, setUseRawJson] = useState(false);
  const [label, setLabel] = useState("");
  const [formData, setFormData] = useState<Record<string, string | number | boolean>>({});
  const [rawJson, setRawJson] = useState("{}");
  const createEntryMutation = useCreateEntry();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleFieldChange = (name: string, value: string | number | boolean) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim()) {
      toast({ title: "Validation Error", description: "Label is required", variant: "destructive" });
      return;
    }

    let payloadData: any = {};
    if (useRawJson) {
      try {
        payloadData = JSON.parse(rawJson);
      } catch (err) {
        toast({ title: "JSON Error", description: "Invalid JSON format", variant: "destructive" });
        return;
      }
    } else {
      payloadData = { ...formData };
      // basic type coercion
      fields.forEach(f => {
        if (f.dataType === "number" && payloadData[f.name]) {
          payloadData[f.name] = Number(payloadData[f.name]);
        }
        if (f.dataType === "boolean" && payloadData[f.name] === "true") payloadData[f.name] = true;
        if (f.dataType === "boolean" && payloadData[f.name] === "false") payloadData[f.name] = false;
        if (f.dataType === "json" && typeof payloadData[f.name] === "string") {
            try { payloadData[f.name] = JSON.parse(payloadData[f.name]); } catch(e){}
        }
      });
    }

    createEntryMutation.mutate({
      tableId,
      data: { label, data: payloadData }
    }, {
      onSuccess: () => {
        toast({ title: "Success", description: "Entry added successfully" });
        queryClient.invalidateQueries({ queryKey: getListEntriesQueryKey(tableId) });
        onSuccess();
      },
      onError: (err) => {
        toast({ title: "Error", description: err.message || "Failed to create entry", variant: "destructive" });
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-sm font-medium mb-1 block">Entry Label *</label>
        <Input required placeholder="Unique identifier or name" value={label} onChange={e => setLabel(e.target.value)} />
      </div>

      <div className="flex items-center space-x-2 py-2">
        <Switch id="raw-json" checked={useRawJson} onCheckedChange={setUseRawJson} />
        <label htmlFor="raw-json" className="text-sm font-medium cursor-pointer">Use raw JSON input</label>
      </div>

      {useRawJson ? (
        <div>
          <label className="text-sm font-medium mb-1 block">JSON Data</label>
          <Textarea 
            className="font-mono h-48 text-sm" 
            value={rawJson} 
            onChange={e => setRawJson(e.target.value)} 
          />
        </div>
      ) : (
        <div className="space-y-3 bg-muted/20 p-4 rounded-md border border-border">
          {fields.length === 0 ? (
            <p className="text-sm text-muted-foreground">No fields defined yet. Switch to JSON mode or add fields first.</p>
          ) : (
            fields.map(field => (
              <div key={field.id}>
                <label className="text-sm font-medium mb-1 flex items-center gap-1">
                  {field.name}
                  {field.required && <span className="text-destructive">*</span>}
                  <span className="text-xs text-muted-foreground font-mono ml-2 px-1 bg-muted rounded">{field.dataType}</span>
                </label>
                {field.dataType === "boolean" ? (
                  <Select onValueChange={(val) => handleFieldChange(field.name, val)} required={field.required}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select boolean" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">True</SelectItem>
                      <SelectItem value="false">False</SelectItem>
                    </SelectContent>
                  </Select>
                ) : field.dataType === "json" ? (
                  <Textarea 
                    placeholder="{}" 
                    className="font-mono text-sm"
                    required={field.required}
                    onChange={e => handleFieldChange(field.name, e.target.value)}
                  />
                ) : (
                  <Input 
                    type={field.dataType === "number" ? "number" : field.dataType === "date" ? "date" : "text"}
                    required={field.required}
                    onChange={e => handleFieldChange(field.name, e.target.value)}
                  />
                )}
                {field.description && <p className="text-xs text-muted-foreground mt-1">{field.description}</p>}
              </div>
            ))
          )}
        </div>
      )}

      <div className="flex justify-end pt-4">
        <Button type="submit" disabled={createEntryMutation.isPending}>
          {createEntryMutation.isPending ? "Adding..." : "Add Entry"}
        </Button>
      </div>
    </form>
  );
}

export default function TableWorkspace({ tableId }: { tableId: number }) {
  const [, setLocation] = useLocation();
  const { data: session } = useGetCurrentSession();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: table, isLoading: isTableLoading } = useGetTable(tableId);
  const { data: fields, isLoading: isFieldsLoading } = useListFields(tableId);
  const { data: entries, isLoading: isEntriesLoading } = useListEntries(tableId);
  
  const createFieldMutation = useCreateField();
  const deleteTableMutation = useDeleteTable();
  const deleteEntryMutation = useDeleteEntry();

  const [isFieldDialogOpen, setIsFieldDialogOpen] = useState(false);
  const [isEntryDialogOpen, setIsEntryDialogOpen] = useState(false);

  const fieldForm = useForm<z.infer<typeof fieldSchema>>({
    resolver: zodResolver(fieldSchema),
    defaultValues: {
      name: "",
      dataType: "string",
      description: "",
      required: false,
    },
  });

  const onFieldSubmit = (values: z.infer<typeof fieldSchema>) => {
    createFieldMutation.mutate(
      { tableId, data: values },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListFieldsQueryKey(tableId) });
          setIsFieldDialogOpen(false);
          fieldForm.reset();
          toast({ title: "Field added", description: "Schema updated successfully." });
        },
        onError: (err) => {
          toast({ title: "Error", description: err.message || "Failed to add field", variant: "destructive" });
        }
      }
    );
  };

  const handleDeleteTable = () => {
    if (!confirm("Are you sure you want to delete this entire feature database? This will permanently delete all fields, entries, and relations connecting to them. This cannot be undone.")) return;
    
    deleteTableMutation.mutate(
      { tableId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListTablesQueryKey() });
          toast({ title: "Table deleted" });
          setLocation("/tables");
        },
        onError: (err) => toast({ title: "Error", description: err.message || "Failed to delete table", variant: "destructive" })
      }
    );
  };

  const handleDeleteEntry = (entryId: number) => {
    if (!confirm("Delete this entry and its relations?")) return;
    deleteEntryMutation.mutate(
      { entryId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListEntriesQueryKey(tableId) });
          toast({ title: "Entry deleted" });
        },
        onError: (err) => toast({ title: "Error", description: err.message || "Failed to delete entry", variant: "destructive" })
      }
    );
  };

  if (isTableLoading) return <div className="p-6 animate-pulse">Loading workspace...</div>;
  if (!table) return <div className="p-6">Table not found</div>;

  const isAuthenticated = !!session?.user;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start gap-4 pb-4 border-b border-border">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => setLocation("/tables")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">{table.name}</h1>
              <span className="px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-semibold uppercase tracking-wider">
                {table.category}
              </span>
            </div>
            <p className="text-muted-foreground mt-1 text-sm">{table.description || "No description."}</p>
          </div>
        </div>
        
        {isAuthenticated && (
          <Button variant="outline" className="text-destructive border-destructive/20 hover:bg-destructive/10" onClick={handleDeleteTable} disabled={deleteTableMutation.isPending}>
            <Trash2 className="h-4 w-4 mr-2" /> Delete Table
          </Button>
        )}
      </div>

      <Tabs defaultValue="entries" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="entries"><Database className="h-4 w-4 mr-2" /> Entries ({entries?.length || 0})</TabsTrigger>
          <TabsTrigger value="schema"><Columns className="h-4 w-4 mr-2" /> Schema ({fields?.length || 0})</TabsTrigger>
        </TabsList>
        
        <TabsContent value="entries" className="pt-6 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Data Entries</h2>
            <Dialog open={isEntryDialogOpen} onOpenChange={setIsEntryDialogOpen}>
              <DialogTrigger asChild>
                <Button disabled={!isAuthenticated} title={!isAuthenticated ? "Log in to add entries" : undefined}>
                  <Plus className="mr-2 h-4 w-4" /> Add Node
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Add Entry to {table.name}</DialogTitle>
                  <DialogDescription>Create a new node in the knowledge graph for this table.</DialogDescription>
                </DialogHeader>
                <EntryForm tableId={tableId} fields={fields || []} onSuccess={() => setIsEntryDialogOpen(false)} />
              </DialogContent>
            </Dialog>
          </div>

          {isEntriesLoading ? (
            <div className="h-64 flex items-center justify-center bg-muted/10 rounded-lg">Loading entries...</div>
          ) : entries?.length === 0 ? (
            <div className="text-center py-20 border border-dashed rounded-xl bg-muted/10">
              <FileJson className="mx-auto h-12 w-12 text-muted-foreground opacity-20" />
              <h3 className="mt-4 text-lg font-medium">No entries yet</h3>
              <p className="text-muted-foreground mt-1 mb-6">Add nodes to start building your feature dataset.</p>
              {isAuthenticated && (
                <Button onClick={() => setIsEntryDialogOpen(true)}>Add First Entry</Button>
              )}
            </div>
          ) : (
            <div className="border rounded-md overflow-hidden bg-card">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="w-[200px]">Label</TableHead>
                    <TableHead>Data Preview</TableHead>
                    <TableHead className="w-[150px]">Created</TableHead>
                    {isAuthenticated && <TableHead className="w-[80px] text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries?.map(entry => (
                    <TableRow key={entry.id}>
                      <TableCell className="font-medium">{entry.label}</TableCell>
                      <TableCell>
                        <div className="max-w-md truncate text-sm text-muted-foreground font-mono bg-muted/30 px-2 py-1 rounded inline-block">
                          {JSON.stringify(entry.data)}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {format(new Date(entry.createdAt), "MMM d, yyyy")}
                      </TableCell>
                      {isAuthenticated && (
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteEntry(entry.id)} className="text-muted-foreground hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="schema" className="pt-6 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Field Definitions</h2>
            <Dialog open={isFieldDialogOpen} onOpenChange={setIsFieldDialogOpen}>
              <DialogTrigger asChild>
                <Button disabled={!isAuthenticated} title={!isAuthenticated ? "Log in to modify schema" : undefined}>
                  <Plus className="mr-2 h-4 w-4" /> Add Field
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Schema Field</DialogTitle>
                  <DialogDescription>Define a new property for entries in this table.</DialogDescription>
                </DialogHeader>
                <Form {...fieldForm}>
                  <form onSubmit={fieldForm.handleSubmit(onFieldSubmit)} className="space-y-4">
                    <FormField
                      control={fieldForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Field Key</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. user_id, price_usd" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={fieldForm.control}
                      name="dataType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Data Type</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select a type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {Object.values(FieldDataType).map(type => (
                                <SelectItem key={type} value={type}>{type}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={fieldForm.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description (Optional)</FormLabel>
                          <FormControl>
                            <Input placeholder="What does this represent?" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={fieldForm.control}
                      name="required"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 shadow-sm">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel>Required Field</FormLabel>
                            <p className="text-xs text-muted-foreground">Entries must include this field</p>
                          </div>
                        </FormItem>
                      )}
                    />
                    <div className="flex justify-end pt-4">
                      <Button type="submit" disabled={createFieldMutation.isPending}>
                        {createFieldMutation.isPending ? "Adding..." : "Add Field"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>

          {isFieldsLoading ? (
            <div className="h-64 flex items-center justify-center bg-muted/10 rounded-lg">Loading schema...</div>
          ) : fields?.length === 0 ? (
            <div className="bg-muted/10 border border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center">
              <AlertCircle className="h-8 w-8 text-muted-foreground mb-3" />
              <h3 className="font-medium">No strict schema defined</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-md">
                Entries can contain arbitrary JSON, but defining fields helps with validation and auto-generating input forms.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {fields?.map(field => (
                <Card key={field.id} className="shadow-sm">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-base font-mono">{field.name}</CardTitle>
                      <span className="text-xs font-mono bg-primary/10 text-primary px-2 py-0.5 rounded uppercase font-semibold">
                        {field.dataType}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground min-h-[40px]">
                      {field.description || "No description."}
                    </p>
                    <div className="mt-4 flex items-center text-xs font-medium">
                      {field.required ? (
                        <span className="text-destructive bg-destructive/10 px-2 py-1 rounded">Required</span>
                      ) : (
                        <span className="text-muted-foreground bg-muted px-2 py-1 rounded">Optional</span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
