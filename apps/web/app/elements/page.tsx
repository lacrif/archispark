"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import {
  fetchElementTypes,
  fetchElements,
  createElement,
  updateElement,
  deleteElement,
  type ElementOut,
} from "@/lib/api";
import { Input } from "@workspace/ui/components/input";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Label } from "@workspace/ui/components/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@workspace/ui/components/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
  DialogTrigger,
} from "@workspace/ui/components/dialog";
import { DataTable } from "@/components/data-table";
import { Plus, Pencil, Trash2 } from "lucide-react";

const LAYER_COLORS: Record<string, string> = {
  Business: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
  Application: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  Technology: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  Physical: "bg-green-200 text-green-900 dark:bg-green-800/40 dark:text-green-200",
  Motivation: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
  Strategy: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  Implementation: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
  Composite: "bg-gray-100 text-gray-800 dark:bg-gray-800/40 dark:text-gray-300",
};

function getLayer(type: string): string {
  if (type.startsWith("Business") || ["Contract", "Representation", "Product"].includes(type))
    return "Business";
  if (type.startsWith("Application") || type === "DataObject") return "Application";
  if (
    type.startsWith("Technology") ||
    ["Node", "Device", "SystemSoftware", "Path", "CommunicationNetwork", "Artifact"].includes(type)
  )
    return "Technology";
  if (["Equipment", "Facility", "DistributionNetwork", "Material"].includes(type)) return "Physical";
  if (
    ["Stakeholder", "Driver", "Assessment", "Goal", "Outcome", "Principle", "Requirement", "Constraint", "Meaning", "Value"].includes(type)
  )
    return "Motivation";
  if (["Resource", "Capability", "CourseOfAction", "ValueStream"].includes(type)) return "Strategy";
  if (["WorkPackage", "Deliverable", "ImplementationEvent", "Plateau", "Gap"].includes(type))
    return "Implementation";
  return "Composite";
}

export default function ElementsPage() {
  const [types, setTypes] = useState<string[]>([]);
  const [elements, setElements] = useState<ElementOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const initialLoad = useRef(true);

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("");
  const [newDoc, setNewDoc] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ElementOut | null>(null);
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState("");
  const [editDoc, setEditDoc] = useState("");
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Delete dialog
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ElementOut | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const reload = useCallback(() => {
    setLoading(true);
    fetchElements(typeFilter, debouncedSearch || null)
      .then(setElements)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [typeFilter, debouncedSearch]);

  useEffect(() => {
    Promise.all([fetchElementTypes(), fetchElements()])
      .then(([t, e]) => {
        setTypes(t);
        setElements(e);
        initialLoad.current = false;
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (initialLoad.current) return;
    reload();
  }, [typeFilter, debouncedSearch, reload]);

  const grouped = useMemo(() => {
    const groups: Record<string, string[]> = {};
    for (const t of types) {
      const layer = getLayer(t);
      (groups[layer] ??= []).push(t);
    }
    return groups;
  }, [types]);

  function openEdit(el: ElementOut) {
    setEditTarget(el);
    setEditName(el.name);
    setEditType(el.type);
    setEditDoc(el.documentation ?? "");
    setEditError(null);
    setEditOpen(true);
  }

  function openDelete(el: ElementOut) {
    setDeleteTarget(el);
    setDeleteError(null);
    setDeleteOpen(true);
  }

  async function handleCreate() {
    if (!newName.trim() || !newType) return;
    setCreating(true);
    setCreateError(null);
    try {
      await createElement({ name: newName.trim(), type: newType, documentation: newDoc.trim() || null });
      setCreateOpen(false);
      setNewName(""); setNewType(""); setNewDoc("");
      reload();
    } catch (err) {
      setCreateError((err as Error).message);
    } finally {
      setCreating(false);
    }
  }

  async function handleEdit() {
    if (!editTarget || !editName.trim() || !editType) return;
    setSaving(true);
    setEditError(null);
    try {
      await updateElement(editTarget.identifier, {
        name: editName.trim(),
        type: editType,
        documentation: editDoc.trim() || null,
      });
      setEditOpen(false);
      reload();
    } catch (err) {
      setEditError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteElement(deleteTarget.identifier);
      setDeleteOpen(false);
      reload();
    } catch (err) {
      setDeleteError((err as Error).message);
    } finally {
      setDeleting(false);
    }
  }

  const columns: ColumnDef<ElementOut>[] = useMemo(() => [
    {
      accessorKey: "name",
      header: "Nom",
      cell: ({ row }) => <span className="font-medium">{row.getValue("name") || "—"}</span>,
    },
    {
      accessorKey: "type",
      header: "Type",
      cell: ({ row }) => (
        <Badge variant="secondary" className="font-mono text-xs">{row.getValue("type")}</Badge>
      ),
    },
    {
      id: "layer",
      header: "Layer",
      accessorFn: (row) => getLayer(row.type),
      cell: ({ getValue }) => {
        const layer = getValue<string>();
        return (
          <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${LAYER_COLORS[layer] ?? ""}`}>
            {layer}
          </span>
        );
      },
    },
    {
      accessorKey: "documentation",
      header: "Documentation",
      enableSorting: false,
      cell: ({ row }) => (
        <span className="max-w-xs truncate block text-muted-foreground">{row.getValue("documentation") || "—"}</span>
      ),
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex items-center gap-1 justify-end">
          <Button variant="ghost" size="icon-xs" onClick={() => openEdit(row.original)} aria-label="Modifier">
            <Pencil className="size-3.5" />
          </Button>
          <Button variant="ghost" size="icon-xs" onClick={() => openDelete(row.original)} aria-label="Supprimer">
            <Trash2 className="size-3.5 text-destructive" />
          </Button>
        </div>
      ),
    },
  ], []);

  if (error) {
    return (
      <div className="p-7">
        <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
          Erreur : {error}
        </div>
      </div>
    );
  }

  return (
    <div className="p-7 space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold">Éléments</h1>
          <p className="text-muted-foreground text-[13px] mt-0.5">Parcourir tous les éléments ArchiMate du modèle</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger render={<Button size="sm" />}>
            <Plus className="size-4" /> Nouvel élément
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Nouvel élément</DialogTitle>
              <DialogDescription>Créer un nouvel élément ArchiMate dans le modèle.</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-4 py-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="el-name">Nom *</Label>
                <Input id="el-name" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Mon élément" onKeyDown={(e) => e.key === "Enter" && handleCreate()} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Type *</Label>
                <Select value={newType} onValueChange={(v) => setNewType(v ?? "")}>
                  <SelectTrigger><SelectValue placeholder="Choisir un type" /></SelectTrigger>
                  <SelectContent>
                    {Object.values(grouped).flat().map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="el-doc">Documentation</Label>
                <textarea id="el-doc" value={newDoc} onChange={(e) => setNewDoc(e.target.value)} placeholder="Description optionnelle" className="bg-background border border-input rounded-md text-foreground text-sm px-3 py-2 outline-none focus:border-ring resize-vertical min-h-[72px]" />
              </div>
            </div>
            {createError && <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">{createError}</div>}
            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>Annuler</DialogClose>
              <Button onClick={handleCreate} disabled={creating || !newName.trim() || !newType}>{creating ? "Création…" : "Créer"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Input placeholder="Rechercher par nom..." className="max-w-xs" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Select value={typeFilter ?? ""} onValueChange={(val) => setTypeFilter(val || null)}>
          <SelectTrigger className="min-w-[180px]"><SelectValue placeholder="Tous les types" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">Tous les types</SelectItem>
            {Object.values(grouped).flat().map((t) => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataTable columns={columns} data={elements} loading={loading} />

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Modifier l&apos;élément</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-name">Nom *</Label>
              <Input id="edit-name" value={editName} onChange={(e) => setEditName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleEdit()} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Type *</Label>
              <Select value={editType} onValueChange={(v) => setEditType(v ?? "")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.values(grouped).flat().map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-doc">Documentation</Label>
              <textarea id="edit-doc" value={editDoc} onChange={(e) => setEditDoc(e.target.value)} className="bg-background border border-input rounded-md text-foreground text-sm px-3 py-2 outline-none focus:border-ring resize-vertical min-h-[72px]" />
            </div>
          </div>
          {editError && <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">{editError}</div>}
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Annuler</DialogClose>
            <Button onClick={handleEdit} disabled={saving || !editName.trim() || !editType}>{saving ? "Enregistrement…" : "Enregistrer"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Supprimer l&apos;élément</DialogTitle>
            <DialogDescription>
              Supprimer <strong>{deleteTarget?.name || "cet élément"}</strong> ? Les relations associées seront aussi supprimées. Cette action est irréversible.
            </DialogDescription>
          </DialogHeader>
          {deleteError && <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">{deleteError}</div>}
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Annuler</DialogClose>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>{deleting ? "Suppression…" : "Supprimer"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
