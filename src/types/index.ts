import { PitType, PitStatus, TransactionType, TransactionStatus, UserRole } from "@prisma/client";

export type { PitType, PitStatus, TransactionType, TransactionStatus, UserRole };

export interface PitSummary {
  id: string;
  name: string;
  address: string | null;
  state: string;
  latitude: number;
  longitude: number;
  pitType: PitType;
  status: PitStatus;
  accepting: boolean;
  dumpRateCents: number | null;
  borrowRateCents: number | null;
  hasTopsoil: boolean;
  topsoilRateCents: number | null;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  notes: string | null;
  ownerId: string | null;
}

export interface TransactionCalculation {
  ratePerLoadCents: number;
  subtotalCents: number;
  platformFeeCents: number;
  ownerPayoutCents: number;
  totalChargeCents: number;
  platformFeePercent: number;
}

export function calculateTransaction(
  ratePerLoadCents: number,
  loads: number,
  feePercent: number
): TransactionCalculation {
  const subtotalCents = ratePerLoadCents * loads;
  const platformFeeCents = Math.round(subtotalCents * (feePercent / 100));
  const ownerPayoutCents = subtotalCents - platformFeeCents;
  return {
    ratePerLoadCents,
    subtotalCents,
    platformFeeCents,
    ownerPayoutCents,
    totalChargeCents: subtotalCents,
    platformFeePercent: feePercent,
  };
}

export function centsToDisplay(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function pitTypeLabel(type: PitType): string {
  switch (type) {
    case "WASTE": return "Waste Pit";
    case "BORROW": return "Borrow Pit";
    case "WASTE_BORROW": return "Waste & Borrow Pit";
    default: return type;
  }
}
