"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { fetchView, viewImageUrl, type ViewDetail } from "@/lib/api";
import { Button } from "@workspace/ui/components/button";

export default function ViewDetailPage() {
  const params = useParams<{ id: string }>();
  const id = decodeURIComponent(params.id);
  const [view, setView] = useState<ViewDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [format, setFormat] = useState<"svg" | "png">("svg");

  useEffect(() => {
    fetchView(id)
      .then(setView)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
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
          <h1 className="text-lg font-semibold">{view?.name || "Sans nom"}</h1>
          {view?.documentation && (
            <p className="text-muted-foreground text-[13px] mt-0.5">{view.documentation}</p>
          )}
          <div className="text-muted-foreground text-[12px] mt-1">
            {view?.nodes.length ?? 0} nœuds · {view?.connections.length ?? 0} connexions
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            variant={format === "svg" ? "default" : "outline"}
            size="sm"
            onClick={() => setFormat("svg")}
          >
            SVG
          </Button>
          <Button
            variant={format === "png" ? "default" : "outline"}
            size="sm"
            onClick={() => setFormat("png")}
          >
            PNG
          </Button>
        </div>
      </div>

      <div className="border border-border rounded-lg bg-card overflow-auto p-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={`${id}-${format}`}
          src={viewImageUrl(id, format)}
          alt={view?.name || "View"}
          className="max-w-full h-auto"
        />
      </div>
    </div>
  );
}
