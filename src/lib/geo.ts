import { prisma } from "./prisma";
import { PitType, PitStatus, Prisma } from "@prisma/client";

export interface PitSearchParams {
  lat: number;
  lng: number;
  radiusMeters?: number;
  pitType?: PitType;
  accepting?: boolean;
  state?: string;
  materialType?: string;
  operatorProvided?: boolean;
  equipmentProvided?: boolean;
  limit?: number;
  offset?: number;
}

export async function searchPitsNear(params: PitSearchParams) {
  const {
    lat,
    lng,
    radiusMeters = 80467, // 50 miles default
    pitType,
    accepting,
    state,
    materialType,
    operatorProvided,
    equipmentProvided,
    limit = 200,
    offset = 0,
  } = params;

  // Use Haversine approximation query when PostGIS is not available,
  // or raw query with PostGIS when available. We use a bounding-box
  // pre-filter + Haversine for simplicity without requiring PostGIS
  // to be enabled on the database connection string.
  const latDelta = radiusMeters / 111320;
  const lngDelta = radiusMeters / (111320 * Math.cos((lat * Math.PI) / 180));

  const where: Prisma.PitWhereInput = {
    status: PitStatus.ACTIVE,
    latitude: { gte: lat - latDelta, lte: lat + latDelta },
    longitude: { gte: lng - lngDelta, lte: lng + lngDelta },
  };

  if (pitType) where.pitType = pitType;
  if (accepting !== undefined) where.accepting = accepting;
  if (state) where.state = state;
  // materialTypes is a String[] field added via migration; cast needed until prisma generate runs
  if (materialType) (where as Record<string, unknown>).materialTypes = { has: materialType };
  if (operatorProvided !== undefined) (where as Record<string, unknown>).operatorProvided = operatorProvided;
  if (equipmentProvided !== undefined) (where as Record<string, unknown>).equipmentProvided = equipmentProvided;

  const pits = await prisma.pit.findMany({
    where,
    take: limit,
    skip: offset,
    orderBy: { name: "asc" },
  });

  // Filter by actual Haversine distance
  return pits.filter((pit: { latitude: number; longitude: number }) => {
    const d = haversineMeters(lat, lng, pit.latitude, pit.longitude);
    return d <= radiusMeters;
  }) as typeof pits;
}

function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
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
