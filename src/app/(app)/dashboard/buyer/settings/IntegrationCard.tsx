"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  platform: string;
  name: string;
  description: string;
  logo: string;
  connected: boolean;
  connectedAt: Date | null;
  lastSyncAt: Date | null;
  lastSyncError: string | null;
  connectHref: string;
  disconnectEndpoint: string;
}

export default function IntegrationCard(props: Props) {
  const router = useRouter();
  const [disconnecting, setDisconnecting] = useState(false);

  async function handleDisconnect() {
    if (!confirm(`Disconnect ${props.name}? Your project IDs will remain on projects but syncing will stop.`)) return;
    setDisconnecting(true);
    await fetch(props.disconnectEndpoint, { method: "DELETE" });
    router.refresh();
    setDisconnecting(false);
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 flex items-start justify-between gap-4">
      <div className="flex items-start gap-4">
        <div className="text-3xl w-10 text-center">{props.logo}</div>
        <div>
          <div className="font-semibold text-gray-900">{props.name}</div>
          <div className="text-sm text-gray-500 mt-0.5">{props.description}</div>

          {props.connected && (
            <div className="mt-2 text-xs text-gray-400 space-y-0.5">
              {props.connectedAt && (
                <div>Connected {new Date(props.connectedAt).toLocaleDateString()}</div>
              )}
              {props.lastSyncAt && (
                <div>Last sync: {new Date(props.lastSyncAt).toLocaleString()}</div>
              )}
              {props.lastSyncError && (
                <div className="text-red-500 max-w-sm truncate">⚠ {props.lastSyncError}</div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="shrink-0">
        {props.connected ? (
          <div className="flex flex-col items-end gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-50 text-green-700 border border-green-200 rounded-full text-xs font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              Connected
            </span>
            <button
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="text-xs text-gray-400 hover:text-red-500 underline disabled:opacity-50"
            >
              {disconnecting ? "Disconnecting…" : "Disconnect"}
            </button>
          </div>
        ) : (
          <a
            href={props.connectHref}
            className="inline-block px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-700 font-medium"
          >
            Connect
          </a>
        )}
      </div>
    </div>
  );
}
