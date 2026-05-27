"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { fetchViews, createView, updateView, deleteView, type ViewOut } from "@/lib/api";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
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
import { Plus, Pencil, Trash2 } from "lucide-react";

const VIEWPOINTS = [
  "Organization", "Application Platform", "Application Structure",
  "Information Structure", "Technology", "Layered", "Physical",
  "Product", "Application Usage", "Technology Usage",
  "Business Process Cooperation", "Application Cooperation",
  "Service Realization", "Implementation and Deployment",
  "Goal Realization", "Goal Contribution", "Principles",
  "Requirements Realization", "Motivation", "Strategy",
  "Capability Map", "Outcome Realization", "Resource Map", "Value Stream",
  "Project", "Migration", "Implementation and Migration", "Stakeholder",
];

export default function ViewsPage() {
  const [views, setViews] = useState<ViewOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newViewpoint, setNewViewpoint] = useState("");
  const [newDoc, setNewDoc] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Edit
  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ViewOut | null>(null);
  const [editName, setEditName] = useState("");
  const [editViewpoint, setEditViewpoint] = useState("");
  const [editDoc, setEditDoc] = useState("");
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Delete
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [delTarget, setDelTarget] = useState<ViewOut | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const reload = useCallback(() => {
    setLoading(true);
    fetchViews()
      .then(setViews)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { reload(); }, [reload]);

  function openEdit(view: ViewOut, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setEditTarget(view);
    setEditName(view.name);
    setEditViewpoint("");
    setEditDoc(view.documentation ?? "");
    setEditError(null);
    setEditOpen(true);
  }

  function openDelete(view: ViewOut, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDelTarget(view);
    setDeleteError(null);
    setDeleteOpen(true);
  }

  async function handleCreate() {
    if (!newName.trim()) return;
    setCreating(true);
    setCreateError(null);
    try {
      await createView({ name: newName.trim(), viewpoint: newViewpoint || null, documentation: newDoc.trim() || null });
      setCreateOpen(false);
      setNewName(""); setNewViewpoint(""); setNewDoc("");
      reload();
    } catch (err) {
      setCreateError((err as Error).message);
    } finally {
      setCreating(false);
    }
  }

  async function handleEdit() {
    if (!editTarget || !editName.trim()) return;
    setSaving(true);
    setEditError(null);
    try {
      await updateView(editTarget.identifier, {
        name: editName.trim(),
        viewpoint: editViewpoint || null,
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
      await deleteView(delTarget.identifier);
      setDeleteOpen(false);
      reload();
    } catch (err) {
      setDeleteError((err as Error).message);
    } finally {
      setDeleting(false);
    }
  }

  if (loading && views.length === 0) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground p-8">
        <div className="size-4 rounded-full border-2 border-border border-t-primary animate-spin shrink-0" />
        Chargement…
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-7">
        <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">Erreur : {error}</div>
      </div>
    );
  }

  return (
    <div className="p-7 space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold">Vues</h1>
          <p className="text-muted-foreground text-[13px] mt-0.5">{views.length} diagramme{views.length !== 1 ? "s" : ""} dans le modèle</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger render={<Button size="sm" />}>
            <Plus className="size-4" /> Nouvelle vue
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Nouvelle vue</DialogTitle>
              <DialogDescription>Créer une nouvelle vue (diagramme) dans le modèle.</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-4 py-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="view-name">Nom *</Label>
                <Input id="view-name" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ma vue" onKeyDown={(e) => e.key === "Enter" && handleCreate()} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Viewpoint</Label>
                <Select value={newViewpoint} onValueChange={(v) => setNewViewpoint(v ?? "")}>
                  <SelectTrigger><SelectValue placeholder="Aucun (vue libre)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Aucun</SelectItem>
                    {VIEWPOINTS.map((vp) => <SelectItem key={vp} value={vp}>{vp}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="view-doc">Documentation</Label>
                <textarea id="view-doc" value={newDoc} onChange={(e) => setNewDoc(e.target.value)} placeholder="Description optionnelle" className="bg-background border border-input rounded-md text-foreground text-sm px-3 py-2 outline-none focus:border-ring resize-vertical min-h-[72px]" />
              </div>
            </div>
            {createError && <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">{createError}</div>}
            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>Annuler</DialogClose>
              <Button onClick={handleCreate} disabled={creating || !newName.trim()}>{creating ? "Création…" : "Créer"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {views.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <div className="text-[40px] mb-3.5">📭</div>
          <p className="text-sm">Aucune vue dans le modèle.</p>
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-3">
          {views.map((view) => (
            <Link
              key={view.identifier}
              href={`/views/${encodeURIComponent(view.identifier)}`}
              className="group bg-card border border-border rounded-lg p-5 no-underline transition-all hover:border-primary hover:-translate-y-px flex flex-col gap-2 relative"
            >
              <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button variant="ghost" size="icon-xs" onClick={(e) => openEdit(view, e)} aria-label="Modifier">
                  <Pencil className="size-3.5" />
                </Button>
                <Button variant="ghost" size="icon-xs" onClick={(e) => openDelete(view, e)} aria-label="Supprimer">
                  <Trash2 className="size-3.5 text-destructive" />
                </Button>
              </div>
              <h2 className="text-[14px] font-semibold text-foreground pr-16">{view.name || "Sans nom"}</h2>
              <div className="text-muted-foreground text-[13px] leading-relaxed flex-1">{view.documentation || "Pas de description"}</div>
            </Link>
          ))}
        </div>
      )}

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Modifier la vue</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-view-name">Nom *</Label>
              <Input id="edit-view-name" value={editName} onChange={(e) => setEditName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleEdit()} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Viewpoint</Label>
              <Select value={editViewpoint} onValueChange={(v) => setEditViewpoint(v ?? "")}>
                <SelectTrigger><SelectValue placeholder="Aucun" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Aucun</SelectItem>
                  {VIEWPOINTS.map((vp) => <SelectItem key={vp} value={vp}>{vp}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-view-doc">Documentation</Label>
              <textarea id="edit-view-doc" value={editDoc} onChange={(e) => setEditDoc(e.target.value)} className="bg-background border border-input rounded-md text-foreground text-sm px-3 py-2 outline-none focus:border-ring resize-vertical min-h-[72px]" />
            </div>
          </div>
          {editError && <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">{editError}</div>}
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Annuler</DialogClose>
            <Button onClick={handleEdit} disabled={saving || !editName.trim()}>{saving ? "Enregistrement…" : "Enregistrer"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Supprimer la vue</DialogTitle>
            <DialogDescription>
              Supprimer <strong>{delTarget?.name || "cette vue"}</strong> ? Cette action est irréversible.
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
