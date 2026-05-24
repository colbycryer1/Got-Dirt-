import * as SecureStore from "expo-secure-store";

const BASE = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";
const TOKEN_KEY = "got_dirt_token";

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string> ?? {}),
  };

  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error ?? `Request failed: ${res.status}`);
  }
  return res.json();
}

export const api = {
  // Auth
  login: (email: string, password: string) =>
    request<{ token: string; user: import("../types").AuthUser }>("/api/mobile/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  register: (data: { email: string; password: string; name: string; role: string; company?: string }) =>
    request<{ token: string; user: import("../types").AuthUser }>("/api/mobile/register", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  me: () => request<{ user: import("../types").AuthUser }>("/api/mobile/me"),

  // Pits
  searchPits: (params: {
    lat: number; lng: number; radius?: number;
    type?: string; accepting?: boolean; material?: string;
    operatorProvided?: boolean; equipmentProvided?: boolean;
  }) => {
    const q = new URLSearchParams({
      lat: String(params.lat),
      lng: String(params.lng),
      radius: String(params.radius ?? 50),
      ...(params.type ? { type: params.type } : {}),
      ...(params.accepting !== undefined ? { accepting: String(params.accepting) } : {}),
      ...(params.material ? { material: params.material } : {}),
      ...(params.operatorProvided ? { operatorProvided: "true" } : {}),
      ...(params.equipmentProvided ? { equipmentProvided: "true" } : {}),
    });
    return request<{ pits: import("../types").Pit[] }>(`/api/pits?${q}`);
  },

  getPit: (id: string) => request<{ pit: import("../types").Pit }>(`/api/pits/${id}`),

  // Orders
  getOrders: (projectId?: string) => {
    const q = projectId ? `?projectId=${projectId}` : "";
    return request<{ orders: import("../types").Order[] }>(`/api/orders${q}`);
  },

  createOrder: (data: { projectId: string; pitId: string; date: string; estimatedLoads?: number }) =>
    request<{ order: import("../types").Order }>("/api/orders", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Projects
  getProjects: () => request<{ projects: import("../types").Project[] }>("/api/projects"),

  createProject: (data: { name: string; location?: string; description?: string }) =>
    request<{ project: import("../types").Project }>("/api/projects", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Loads (operator)
  getOperatorOrders: () => request<{ orders: import("../types").Order[] }>("/api/operator/orders"),

  logLoad: (data: { orderId: string; pitId: string; materialType: string; notes?: string }) =>
    request<{ loadEvent: { id: string } }>("/api/loads/manual", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  undoLoad: (orderId: string) =>
    request<{ ok: boolean }>("/api/loads/manual", {
      method: "DELETE",
      body: JSON.stringify({ orderId }),
    }),

  // Settlements
  getSettlements: () =>
    request<{ settlements: import("../types").Settlement[] }>("/api/invoices"),
};
