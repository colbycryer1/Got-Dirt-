"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Project {
  id:          string;
  name:        string;
  location:    string | null;
  description: string | null;
}

export default function EditProjectForm({ project }: { project: Project }) {
  const router = useRouter();
  const [name, setName]               = useState(project.name);
  const [location, setLocation]       = useState(project.location ?? "");
  const [description, setDescription] = useState(project.description ?? "");
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !location.trim()) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name:        name.trim(),
          location:    location.trim(),
          description: description.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? "Failed to save");
        return;
      }
      router.push(`/dashboard/buyer/projects/${project.id}`);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-4 flex items-center gap-4">
        <Link
          href={`/dashboard/buyer/projects/${project.id}`}
          className="text-amber-600 text-sm font-medium"
        >
          ← Project
        </Link>
        <span className="font-black text-black text-lg">Got Dirt?</span>
      </nav>

      <div className="max-w-lg mx-auto px-6 py-10">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Edit Project</h1>
        <p className="text-gray-500 text-sm mb-8">Update project details and job site location.</p>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Project Name *</label>
            <input
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              placeholder="e.g. Highway 20 Widening"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Job Site Address *</label>
            <input
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              placeholder="e.g. 1234 Hwy 20, Macon, GA 31201"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              required
            />
            <p className="text-xs text-gray-400 mt-1">Drivers tap this address for turn-by-turn navigation.</p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Description</label>
            <textarea
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
              rows={3}
              placeholder="Optional project notes"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <div className="flex gap-3">
            <Link
              href={`/dashboard/buyer/projects/${project.id}`}
              className="flex-1 text-center border border-gray-300 text-gray-600 py-3 rounded-xl font-semibold hover:bg-gray-50 transition-colors text-sm"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving || !name.trim() || !location.trim()}
              className="flex-1 bg-amber-600 text-white py-3 rounded-xl font-semibold hover:bg-amber-700 disabled:opacity-50 transition-colors text-sm"
            >
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
