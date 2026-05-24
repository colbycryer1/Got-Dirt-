"use client";

import { useState, useRef } from "react";

type DocType = "gdot_license" | "insurance" | "additional";

interface Doc {
  label:   string;
  docType: DocType;
  url:     string | null;
}

interface Props {
  gdotUrl:        string | null;
  insuranceUrl:   string | null;
  additionalUrls: string[];
}

export default function DocumentUploader({ gdotUrl, insuranceUrl, additionalUrls }: Props) {
  const [docs, setDocs] = useState<Doc[]>([
    { label: "GDOT License",          docType: "gdot_license", url: gdotUrl },
    { label: "Insurance Certificate", docType: "insurance",    url: insuranceUrl },
    ...additionalUrls.map((url, i) => ({ label: `Additional Document ${i + 1}`, docType: "additional" as DocType, url })),
  ]);
  const [uploading, setUploading] = useState<DocType | null>(null);
  const [error,     setError]     = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const pendingType = useRef<DocType>("gdot_license");

  async function handleFile(file: File, docType: DocType) {
    setUploading(docType);
    setError("");
    try {
      // 1. Get signed upload URL
      const signRes = await fetch("/api/driver/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, contentType: file.type, docType }),
      });
      if (!signRes.ok) throw new Error("Failed to get upload URL");
      const { signedUrl, publicUrl } = await signRes.json();

      // 2. Upload directly to Supabase Storage
      const uploadRes = await fetch(signedUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });
      if (!uploadRes.ok) throw new Error("Upload failed");

      // 3. Save URL back to profile
      const field = docType === "gdot_license" ? "gdotLicenseUrl" : docType === "insurance" ? "insuranceUrl" : null;
      if (field) {
        await fetch("/api/driver/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ [field]: publicUrl }),
        });
      } else {
        // Additional doc — append to array
        const existing = docs.filter((d) => d.docType === "additional").map((d) => d.url).filter(Boolean) as string[];
        await fetch("/api/driver/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ additionalDocUrls: [...existing, publicUrl] }),
        });
      }

      // 4. Update local state
      setDocs((prev) => {
        if (docType !== "additional") {
          return prev.map((d) => d.docType === docType ? { ...d, url: publicUrl } : d);
        }
        return [...prev, { label: `Additional Document ${prev.filter((d) => d.docType === "additional").length + 1}`, docType: "additional", url: publicUrl }];
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Upload failed. Please try again.");
    } finally {
      setUploading(null);
    }
  }

  function triggerUpload(docType: DocType) {
    pendingType.current = docType;
    fileRef.current?.click();
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file, pendingType.current);
    e.target.value = "";
  }

  return (
    <div className="space-y-3">
      <input ref={fileRef} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={onFileChange} />

      {docs.map((doc, idx) => (
        <div key={idx} className="flex items-center justify-between gap-4 py-3 border-b border-gray-100 last:border-0">
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-800">{doc.label}</p>
            {doc.url
              ? <a href={doc.url} target="_blank" rel="noopener noreferrer" className="text-xs text-amber-600 hover:underline">View uploaded file ↗</a>
              : <p className="text-xs text-gray-400">Not uploaded</p>}
          </div>
          <button
            type="button"
            onClick={() => triggerUpload(doc.docType)}
            disabled={uploading === doc.docType}
            className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg border border-gray-200 hover:border-amber-400 text-gray-600 hover:text-amber-700 disabled:opacity-50 transition-colors"
          >
            {uploading === doc.docType ? "Uploading…" : doc.url ? "Replace" : "Upload"}
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={() => triggerUpload("additional")}
        disabled={uploading !== null}
        className="text-sm text-amber-600 hover:underline disabled:opacity-50"
      >
        + Add additional document
      </button>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <p className="text-xs text-gray-400 pt-2">
        Accepted: PDF, JPG, PNG · Max 10MB per file. Documents are reviewed by Got Dirt? before your profile goes live.
      </p>
    </div>
  );
}
