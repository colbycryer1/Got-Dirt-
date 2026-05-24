export type UserRole = "ADMIN" | "PIT_OWNER" | "BUYER" | "CONTRACTOR" | "DRIVER";

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  company: string | null;
}

export interface Pit {
  id: string;
  name: string;
  address: string | null;
  state: string;
  latitude: number;
  longitude: number;
  pitType: "WASTE" | "BORROW" | "WASTE_BORROW";
  accepting: boolean;
  dumpRateCents: number | null;
  borrowRateCents: number | null;
  hasTopsoil: boolean;
  topsoilRateCents: number | null;
  operatorProvided: boolean;
  equipmentProvided: boolean;
  equipmentNotes: string | null;
  hoursOpen: string | null;
  hoursClose: string | null;
  geofenceRadiusMeters: number;
  notes: string | null;
  materialTypes: string[];
}

export interface Project {
  id: string;
  name: string;
  location: string | null;
  description: string | null;
}

export interface Order {
  id: string;
  pitId: string;
  projectId: string;
  status: "ACTIVE" | "COMPLETED" | "CANCELLED";
  estimatedLoads: number | null;
  date: string;
  pit: { name: string; address: string | null };
  project: { name: string };
}

export interface Settlement {
  id: string;
  date: string;
  verifiedLoadCount: number;
  grossAmountCents: number;
  netToPitCents: number;
  status: "PENDING" | "PROCESSED" | "FAILED";
}
