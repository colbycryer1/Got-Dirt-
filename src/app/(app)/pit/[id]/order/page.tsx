"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

interface Pit {
  id: string;
  name: string;
  address: string | null;
  state: string;
  materialTypes: string[];
  operatorProvided: boolean;
  equipmentProvided: boolean;
  equipmentNotes: string | null;
  dumpRateCents: number | null;
  borrowRateCents: number | null;
  topsoilRateCents: number | null;
}

interface Project {
  id: string;
  name: string;
  location: string | null;
}

export default function PlaceOrderPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const pitId = params.id as string;

  const [pit, setPit] = useState<Pit | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [projectId, setProjectId] = useState("");
  const [materialType, setMaterialType] = useState("");
  const [estimatedLoads, setEstimatedLoads] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push(`/login?redirect=/pit/${pitId}/order`);
      return;
    }
    if (status !== "authenticated") return;

    Promise.all([
      fetch(`/api/pits/${pitId}`).then((r) => r.json()),
      fetch("/api/projects").then((r) => r.json()),
    ]).then(([pitData, projectData]) => {
      setPit(pitData.pit ?? null);
      setProjects(projectData.projects ?? []);
      if (pitData.pit?.materialTypes?.length > 0) {
        setMaterialType(pitData.pit.materialTypes[0]);
      }
    }).finally(() => setLoading(false));
  }, [status, pitId, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!projectId || !materialType || !date) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          pitId,
          materialType,
          estimatedLoads: estimatedLoads ? parseInt(estimatedLoads) : undefined,
          date,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Failed to place order");
        return;
      }
      router.push(`/dashboard/buyer/projects/${projectId}`);
    } finally {
      setSaving(false);
    }
  }

  if (loading || status === "loading") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!pit) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Pit not found.</p>
      </div>
    );
  }

  const inputClass = "w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500";
  const labelClass = "block text-sm font-semibold text-gray-700 mb-1";

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-4 flex items-center gap-4">
        <Link href={`/pit/${pitId}`} className="text-amber-600 text-sm font-medium">← {pit.name}</Link>
        <span className="font-black text-black text-lg">Got Dirt?</span>
      </nav>

      <div className="max-w-lg mx-auto px-6 py-10">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Place Order</h1>
        <p className="text-gray-500 text-sm mb-8">Order from <span className="font-medium text-gray-700">{pit.name}</span></p>

        {/* Pit confirmation badges */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className={`rounded-xl p-3 text-center text-xs font-semibold ${pit.operatorProvided ? "bg-sky-50 text-sky-700 border border-sky-200" : "bg-gray-50 text-gray-400 border border-gray-200"}`}>
            Operator {pit.operatorProvided ? "✓ Provided" : "Not Provided"}
          </div>
          <div className={`rounded-xl p-3 text-center text-xs font-semibold ${pit.equipmentProvided ? "bg-sky-50 text-sky-700 border border-sky-200" : "bg-gray-50 text-gray-400 border border-gray-200"}`}>
            Equipment {pit.equipmentProvided ? "✓ Provided" : "Not Provided"}
          </div>
        </div>
        {pit.equipmentNotes && (
          <p className="text-xs text-gray-500 mb-6 -mt-2 px-1">{pit.equipmentNotes}</p>
        )}

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
          {/* Project */}
          <div>
            <label className={labelClass}>Project *</label>
            {projects.length === 0 ? (
              <div className="border border-dashed border-gray-300 rounded-xl p-4 text-center">
                <p className="text-sm text-gray-500 mb-2">No projects yet</p>
                <Link href="/dashboard/buyer/projects/new" className="text-amber-600 text-sm font-medium hover:underline">
                  Create a project first →
                </Link>
              </div>
            ) : (
              <select
                required
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className={inputClass}
              >
                <option value="">Select a project…</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}{p.location ? ` — ${p.location}` : ""}</option>
                ))}
              </select>
            )}
          </div>

          {/* Material */}
          <div>
            <label className={labelClass}>Material *</label>
            <select
              required
              value={materialType}
              onChange={(e) => setMaterialType(e.target.value)}
              className={inputClass}
            >
              {pit.materialTypes.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          {/* Date */}
          <div>
            <label className={labelClass}>Hauling Date *</label>
            <input
              type="date"
              required
              value={date}
              min={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setDate(e.target.value)}
              className={inputClass}
            />
          </div>

          {/* Estimated loads */}
          <div>
            <label className={labelClass}>Estimated Loads <span className="text-gray-400 font-normal">(optional)</span></label>
            <input
              type="number"
              min="1"
              value={estimatedLoads}
              onChange={(e) => setEstimatedLoads(e.target.value)}
              className={inputClass}
              placeholder="e.g. 20"
            />
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={saving || !projectId || !materialType}
            className="w-full bg-amber-600 text-white py-3 rounded-xl font-semibold hover:bg-amber-700 disabled:opacity-50 transition-colors"
          >
            {saving ? "Placing Order…" : "Place Order"}
          </button>
        </form>
      </div>
    </div>
  );
}
