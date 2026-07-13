import { useListTables, useCreateTable, useGetCurrentSession } from "@workspace/api-client-react";
import { Link } from "wouter";
import { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { getListTablesQueryKey } from "@workspace/api-client-react";

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Database, Plus, Search, Table2, Layers, Clock } from "lucide-react";
import { format } from "date-fns";

const createTableSchema = z.object({
  name: z.string().min(1, "Name is required"),
  category: z.string().min(1, "Category is required"),
  description: z.string().optional(),
});

export default function TablesDirectory() {
  const { data: session } = useGetCurrentSession();
  const { data: tables, isLoading } = useListTables();
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createTableMutation = useCreateTable();

  const form = useForm<z.infer<typeof createTableSchema>>({
    resolver: zodResolver(createTableSchema),
    defaultValues: {
      name: "",
      category: "",
      description: "",
    },
  });

  const onSubmit = (values: z.infer<typeof createTableSchema>) => {
    createTableMutation.mutate(
      { data: values },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListTablesQueryKey() });
          setIsDialogOpen(false);
          form.reset();
          toast({ title: "Table created", description: "Successfully created feature database." });
        },
        onError: (error) => {
          toast({ title: "Error", description: error.message || "Failed to create table", variant: "destructive" });
        }
      }
    );
  };

  const filteredTables = tables?.filter(t => 
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    t.category.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const isAuthenticated = !!session?.user;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Feature Databases</h1>
          <p className="text-muted-foreground mt-1">Manage and spin up new tables for feature engineering</p>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search tables..." 
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button disabled={!isAuthenticated} title={!isAuthenticated ? "Log in to create tables" : undefined}>
                <Plus className="mr-2 h-4 w-4" /> New Table
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Feature Database</DialogTitle>
                <DialogDescription>
                  Spin up a new table to store feature entries. Each table defines its own schema.
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Table Name</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. User Behaviors" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. Analytics, Core, Taxonomy" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description (Optional)</FormLabel>
                        <FormControl>
                          <Textarea placeholder="What kind of data lives here?" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex justify-end pt-4">
                    <Button type="submit" disabled={createTableMutation.isPending}>
                      {createTableMutation.isPending ? "Creating..." : "Create Table"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {!isAuthenticated && (
        <div className="bg-muted/50 border border-border p-4 rounded-lg flex items-center justify-between">
          <p className="text-sm text-muted-foreground">You are browsing in Guest Mode. Sign in to create tables and manage data.</p>
          <Button variant="outline" size="sm" asChild><Link href="/login">Sign In</Link></Button>
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Card key={i} className="h-48 animate-pulse bg-muted/20" />
          ))}
        </div>
      ) : filteredTables.length === 0 ? (
        <div className="text-center py-20 border border-dashed rounded-xl bg-muted/10">
          <Database className="mx-auto h-12 w-12 text-muted-foreground opacity-20" />
          <h3 className="mt-4 text-lg font-medium">No tables found</h3>
          <p className="text-muted-foreground mt-1 mb-6">
            {searchTerm ? "No tables match your search." : "Get started by creating your first feature database."}
          </p>
          {!searchTerm && isAuthenticated && (
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Create First Table
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTables.map((table, i) => (
            <Link key={table.id} href={`/tables/${table.id}`}>
              <Card className="h-full hover:shadow-md hover:border-primary/50 transition-all cursor-pointer group flex flex-col hover:-translate-y-1 duration-200">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2 text-primary">
                      <Table2 className="h-5 w-5" />
                      <CardTitle className="text-xl group-hover:text-primary transition-colors">{table.name}</CardTitle>
                    </div>
                  </div>
                  <CardDescription className="line-clamp-2 mt-2 min-h-10 text-sm">
                    {table.description || "No description provided."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 w-fit px-2 py-1 rounded-md">
                    <Layers className="h-3 w-3" />
                    <span className="font-medium text-foreground">{table.category}</span>
                  </div>
                </CardContent>
                <CardFooter className="pt-0 pb-4 text-xs text-muted-foreground border-t mt-4 flex justify-between items-center bg-muted/5 p-4">
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    <span>Created {format(new Date(table.createdAt), "MMM d, yyyy")}</span>
                  </div>
                </CardFooter>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
