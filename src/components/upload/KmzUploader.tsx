"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";

interface UploadResult {
  created: number;
  skipped: number;
  uploadId: string;
}

export function KmzUploader() {
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState("");

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setUploading(true);
    setError("");
    setResult(null);

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/pits/upload", {
      method: "POST",
      body: formData,
    });

    const data = await res.json();
    setUploading(false);

    if (!res.ok) {
      setError(data.error ?? "Upload failed");
      return;
    }

    setResult(data);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/vnd.google-earth.kmz": [".kmz"] },
    maxFiles: 1,
    disabled: uploading,
  });

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-colors ${
          isDragActive
            ? "border-green-500 bg-green-50"
            : "border-gray-300 hover:border-green-400 hover:bg-gray-50"
        } ${uploading ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        <input {...getInputProps()} />
        <div className="text-4xl mb-4">📂</div>
        {uploading ? (
          <p className="text-gray-600 font-medium">Uploading and parsing KMZ file…</p>
        ) : isDragActive ? (
          <p className="text-green-600 font-semibold">Drop the KMZ file here</p>
        ) : (
          <>
            <p className="text-gray-700 font-semibold mb-1">Drag & drop a .kmz file here</p>
            <p className="text-gray-400 text-sm">or click to browse — max 10MB</p>
          </>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
          {error}
        </div>
      )}

      {result && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-2">
            <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="font-semibold text-green-800">Import Complete</span>
          </div>
          <div className="text-sm text-green-700 space-y-1">
            <p><span className="font-bold">{result.created}</span> pits imported successfully</p>
            {result.skipped > 0 && <p><span className="font-bold">{result.skipped}</span> skipped (duplicates or errors)</p>}
          </div>
          <p className="text-xs text-green-600 mt-3">
            Pits are now visible on the map. You can edit rates and details from the admin pits table.
          </p>
        </div>
      )}

      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-700">
        <p className="font-semibold mb-1">How to export from Google Earth</p>
        <ol className="list-decimal list-inside space-y-1 text-blue-600">
          <li>Open Google Earth Pro (desktop app)</li>
          <li>Add placemarks for each dirt pit</li>
          <li>Right-click a folder containing the placemarks</li>
          <li>Click &quot;Save Place As…&quot; and choose KMZ format</li>
          <li>Upload that file here</li>
        </ol>
      </div>
    </div>
  );
}
