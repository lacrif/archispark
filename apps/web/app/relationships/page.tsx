"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import {
  fetchRelationshipTypes,
  fetchRelationships,
  fetchElements,
  createRelationship,
  updateRelationship,
  deleteRelationship,
  type RelationshipOut,
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
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@workspace/ui/components/dialog";
import { DataTable } from "@/components/data-table";
import { Plus, Pencil, Trash2 } from "lucide-react";

export default function RelationshipsPage() {
  const [types, setTypes] = useState<string[]>([]);
  const [relationships, setRelationships] = useState<RelationshipOut[]>([]);
  const [allElements, setAllElements] = useState<ElementOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const initialLoad = useRef(true);

  // Create
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("");
  const [newSource, setNewSource] = useState("");
  const [newTarget, setNewTarget] = useState("");
  const [newDoc, setNewDoc] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Edit
  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<RelationshipOut | null>(null);
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState("");
  const [editSource, setEditSource] = useState("");
  const [editTargetEl, setEditTargetEl] = useState("");
  const [editDoc, setEditDoc] = useState("");
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Delete
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [delTarget, setDelTarget] = useState<RelationshipOut | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const reload = useCallback(() => {
    setLoading(true);
    fetchRelationships(typeFilter, debouncedSearch || null)
      .then(setRelationships)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [typeFilter, debouncedSearch]);

  useEffect(() => {
    Promise.all([fetchRelationshipTypes(), fetchRelationships(), fetchElements()])
      .then(([t, r, e]) => {
        setTypes(t);
        setRelationships(r);
        setAllElements(e);
        initialLoad.current = false;
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (initialLoad.current) return;
    reload();
  }, [typeFilter, debouncedSearch, reload]);

  function elLabel(id: string) {
    const el = allElements.find((e) => e.identifier === id);
    return el ? `${el.name || el.identifier} (${el.type})` : id;
  }

  function openEdit(rel: RelationshipOut) {
    setEditTarget(rel);
    setEditName(rel.name ?? "");
    setEditType(rel.type);
    setEditSource(rel.source);
    setEditTargetEl(rel.target);
    setEditDoc(rel.documentation ?? "");
    setEditError(null);
    setEditOpen(true);
  }

  function openDelete(rel: RelationshipOut) {
    setDelTarget(rel);
    setDeleteError(null);
    setDeleteOpen(true);
  }

  async function handleCreate() {
    if (!newType || !newSource || !newTarget) return;
    setCreating(true);
    setCreateError(null);
    try {
      await createRelationship({ name: newName.trim() || null, type: newType, source: newSource, target: newTarget, documentation: newDoc.trim() || null });
      setCreateOpen(false);
      setNewName(""); setNewType(""); setNewSource(""); setNewTarget(""); setNewDoc("");
      reload();
    } catch (err) {
      setCreateError((err as Error).message);
    } finally {
      setCreating(false);
    }
  }

  async function handleEdit() {
    if (!editTarget || !editType || !editSource || !editTargetEl) return;
    setSaving(true);
    setEditError(null);
    try {
      await updateRelationship(editTarget.identifier, {
        name: editName.trim() || null,
        type: editType,
        source: editSource,
        target: editTargetEl,
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
    if (!delTarget) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteRelationship(delTarget.identifier);
      setDeleteOpen(false);
      reload();
    } catch (err) {
      setDeleteError((err as Error).message);
    } finally {
      setDeleting(false);
    }
  }

  const columns: ColumnDef<RelationshipOut>[] = useMemo(() => [
    {
      accessorKey: "name",
      header: "Nom",
      cell: ({ row }) => <span className="font-medium">{row.getValue("name") || "—"}</span>,
    },
    {
      accessorKey: "type",
      header: "Type",
      cell: ({ row }) => <Badge variant="secondary" className="font-mono text-xs">{row.getValue("type")}</Badge>,
    },
    {
      accessorKey: "source",
      header: "Source",
      cell: ({ row }) => (
        <span className="text-muted-foreground text-xs truncate block max-w-[160px]" title={row.getValue("source")}>
          {elLabel(row.getValue("source"))}
        </span>
      ),
    },
    {
      accessorKey: "target",
      header: "Cible",
      cell: ({ row }) => (
        <span className="text-muted-foreground text-xs truncate block max-w-[160px]" title={row.getValue("target")}>
          {elLabel(row.getValue("target"))}
        </span>
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
  ], [allElements]);

  if (error) {
    return (
      <div className="p-7">
        <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">Erreur : {error}</div>
      </div>
    );
  }

  const elementSelect = (value: string, onChange: (v: string) => void, placeholder: string) => (
    <Select value={value} onValueChange={(v) => onChange(v ?? "")}>
      <SelectTrigger><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>
        {allElements.map((el) => (
          <SelectItem key={el.identifier} value={el.identifier}>
            {el.name || el.identifier} ({el.type})
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <div className="p-7 space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold">Relations</h1>
          <p className="text-muted-foreground text-[13px] mt-0.5">Explorer les relations entre éléments ArchiMate</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger render={<Button size="sm" />}>
            <Plus className="size-4" /> Nouvelle relation
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Nouvelle relation</DialogTitle>
              <DialogDescription>Créer une relation entre deux éléments du modèle.</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-4 py-2">
              <div className="flex flex-col gap-1.5">
                <Label>Type *</Label>
                <Select value={newType} onValueChange={(v) => setNewType(v ?? "")}>
                  <SelectTrigger><SelectValue placeholder="Choisir un type" /></SelectTrigger>
                  <SelectContent>{types.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Source *</Label>
                {elementSelect(newSource, setNewSource, "Élément source")}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Cible *</Label>
                {elementSelect(newTarget, setNewTarget, "Élément cible")}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="rel-name">Nom</Label>
                <Input id="rel-name" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nom optionnel" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="rel-doc">Documentation</Label>
                <textarea id="rel-doc" value={newDoc} onChange={(e) => setNewDoc(e.target.value)} placeholder="Description optionnelle" className="bg-background border border-input rounded-md text-foreground text-sm px-3 py-2 outline-none focus:border-ring resize-vertical min-h-[72px]" />
              </div>
            </div>
            {createError && <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">{createError}</div>}
            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>Annuler</DialogClose>
              <Button onClick={handleCreate} disabled={creating || !newType || !newSource || !newTarget}>{creating ? "Création…" : "Créer"}</Button>
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
            {types.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <DataTable columns={columns} data={relationships} loading={loading} />

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Modifier la relation</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label>Type *</Label>
              <Select value={editType} onValueChange={(v) => setEditType(v ?? "")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{types.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Source *</Label>
              {elementSelect(editSource, setEditSource, "Élément source")}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Cible *</Label>
              {elementSelect(editTargetEl, setEditTargetEl, "Élément cible")}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-rel-name">Nom</Label>
              <Input id="edit-rel-name" value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-rel-doc">Documentation</Label>
              <textarea id="edit-rel-doc" value={editDoc} onChange={(e) => setEditDoc(e.target.value)} className="bg-background border border-input rounded-md text-foreground text-sm px-3 py-2 outline-none focus:border-ring resize-vertical min-h-[72px]" />
            </div>
          </div>
          {editError && <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">{editError}</div>}
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Annuler</DialogClose>
            <Button onClick={handleEdit} disabled={saving || !editType || !editSource || !editTargetEl}>{saving ? "Enregistrement…" : "Enregistrer"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Supprimer la relation</DialogTitle>
            <DialogDescription>
              Supprimer cette relation {delTarget?.type} ? Cette action est irréversible.
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
