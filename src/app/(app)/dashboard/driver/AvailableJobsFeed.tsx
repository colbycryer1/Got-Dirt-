"use client";

import { useState, useEffect, useCallback } from "react";

interface Job {
  id: string;
  loads: number;
  haulRateCents: number;
  totalEstimatedCents: number;
  scheduledDate: string;
  expiresAt: string | null;
  notes: string | null;
  buyer:   { name: string | null; company: string | null };
  pit:     { name: string; state: string } | null;
  project: { name: string } | null;
}

export default function AvailableJobsFeed() {
  const [jobs,    setJobs]    = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [claimError, setClaimError] = useState<Record<string, string>>({});

  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch("/api/haul-orders/available");
      if (res.ok) {
        const data = await res.json();
        setJobs(data.orders ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJobs();
    const interval = setInterval(fetchJobs, 30_000); // refresh every 30s
    return () => clearInterval(interval);
  }, [fetchJobs]);

  async function claimJob(jobId: string) {
    setClaiming(jobId);
    setClaimError((prev) => ({ ...prev, [jobId]: "" }));
    try {
      const res = await fetch(`/api/haul-orders/${jobId}/claim`, { method: "PATCH" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to claim job");
      // Remove from list on success
      setJobs((prev) => prev.filter((j) => j.id !== jobId));
    } catch (err: unknown) {
      setClaimError((prev) => ({
        ...prev,
        [jobId]: err instanceof Error ? err.message : "Failed to claim job",
      }));
    } finally {
      setClaiming(null);
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-6 text-center text-gray-400 text-sm animate-pulse">
        Loading available jobs…
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-6 text-center text-gray-400">
        <p className="font-medium text-gray-600 mb-1">No open broadcast jobs right now</p>
        <p className="text-sm">Check back soon — buyers will post open haul jobs here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {jobs.map((job) => {
        const isClaiming = claiming === job.id;
        const timeLeft = job.expiresAt ? getTimeLeft(job.expiresAt) : null;
        return (
          <div key={job.id} className="bg-white rounded-2xl border border-amber-200 p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="font-bold text-gray-900">
                  {job.buyer.company ?? job.buyer.name ?? "Buyer"}
                </p>
                {job.pit && (
                  <p className="text-sm text-gray-500">{job.pit.name} · {job.pit.state}</p>
                )}
                {job.project && (
                  <p className="text-xs text-gray-400">{job.project.name}</p>
                )}
                <p className="text-xs text-gray-400 mt-1">
                  {new Date(job.scheduledDate).toLocaleDateString("en-US", {
                    weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
                  })}
                </p>
                {timeLeft && (
                  <p className="text-xs text-red-500 mt-0.5">Expires in {timeLeft}</p>
                )}
                {job.notes && (
                  <p className="text-xs text-gray-500 mt-1 italic">{job.notes}</p>
                )}
              </div>
              <div className="text-right shrink-0">
                <p className="font-bold text-gray-900">
                  ${(job.haulRateCents / 100).toFixed(2)}
                  <span className="text-xs font-normal text-gray-400">/load</span>
                </p>
                <p className="text-sm text-gray-500">{job.loads} load{job.loads !== 1 ? "s" : ""}</p>
                <p className="text-xs font-semibold text-amber-700 mt-0.5">
                  ~${(job.totalEstimatedCents / 100).toFixed(2)}
                </p>
              </div>
            </div>

            {claimError[job.id] && (
              <p className="text-xs text-red-600 mt-2">{claimError[job.id]}</p>
            )}

            <button
              onClick={() => claimJob(job.id)}
              disabled={isClaiming}
              className="mt-4 w-full bg-amber-600 text-white py-2 rounded-xl text-sm font-semibold hover:bg-amber-700 disabled:opacity-50 transition-colors"
            >
              {isClaiming ? "Claiming…" : "Claim Job"}
            </button>
          </div>
        );
      })}
    </div>
  );
}

function getTimeLeft(expiresAt: string): string {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return "expired";
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem > 0 ? `${hrs}h ${rem}m` : `${hrs}h`;
}
