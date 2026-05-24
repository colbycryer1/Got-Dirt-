import { prisma } from "./prisma";
import { PitType, PitStatus, Prisma } from "@prisma/client";

interface CommonFilters {
  pitType?: PitType;
  accepting?: boolean;
  state?: string;
  materialType?: string;
  operatorProvided?: boolean;
  equipmentProvided?: boolean;
}

export interface PitSearchParams extends CommonFilters {
  lat: number;
  lng: number;
  radiusMeters?: number;
  limit?: number;
  offset?: number;
}

export interface PitBoundsParams extends CommonFilters {
  neLat: number;
  neLng: number;
  swLat: number;
  swLng: number;
}

function applyFilters(where: Prisma.PitWhereInput, f: CommonFilters) {
  if (f.pitType) where.pitType = f.pitType;
  if (f.accepting !== undefined) where.accepting = f.accepting;
  if (f.state) where.state = f.state;
  if (f.materialType) (where as Record<string, unknown>).materialTypes = { has: f.materialType };
  if (f.operatorProvided !== undefined) (where as Record<string, unknown>).operatorProvided = f.operatorProvided;
  if (f.equipmentProvided !== undefined) (where as Record<string, unknown>).equipmentProvided = f.equipmentProvided;
}

export async function searchPitsInBounds(params: PitBoundsParams) {
  const { neLat, neLng, swLat, swLng, ...filters } = params;

  const where: Prisma.PitWhereInput = {
    status: PitStatus.ACTIVE,
    latitude:  { gte: swLat, lte: neLat },
    longitude: { gte: swLng, lte: neLng },
  };
  applyFilters(where, filters);

  return prisma.pit.findMany({ where, orderBy: { name: "asc" } });
}

export async function searchPitsNear(params: PitSearchParams) {
  const {
    lat,
    lng,
    radiusMeters = 80467,
    limit = 200,
    offset = 0,
    ...filters
  } = params;

  const latDelta = radiusMeters / 111320;
  const lngDelta = radiusMeters / (111320 * Math.cos((lat * Math.PI) / 180));

  const where: Prisma.PitWhereInput = {
    status: PitStatus.ACTIVE,
    latitude:  { gte: lat - latDelta, lte: lat + latDelta },
    longitude: { gte: lng - lngDelta, lte: lng + lngDelta },
  };
  applyFilters(where, filters);

  const pits = await prisma.pit.findMany({ where, take: limit, skip: offset, orderBy: { name: "asc" } });

  return pits.filter((pit: { latitude: number; longitude: number }) => {
    const d = haversineMeters(lat, lng, pit.latitude, pit.longitude);
    return d <= radiusMeters;
  }) as typeof pits;
}

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
