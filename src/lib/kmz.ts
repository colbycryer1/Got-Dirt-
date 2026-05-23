import JSZip from "jszip";
import { DOMParser } from "@xmldom/xmldom";
import toGeoJSON from "@mapbox/togeojson";

export interface ParsedPit {
  name: string;
  latitude: number;
  longitude: number;
  description?: string;
}

export async function parseKmzBuffer(buffer: Buffer): Promise<ParsedPit[]> {
  const zip = await JSZip.loadAsync(buffer);

  // Find the first .kml file inside the zip
  const kmlEntry = Object.values(zip.files).find(
    (f) => !f.dir && f.name.toLowerCase().endsWith(".kml")
  );

  if (!kmlEntry) throw new Error("No KML file found inside KMZ archive");

  const kmlText = await kmlEntry.async("text");
  const parser = new DOMParser();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const kmlDoc = parser.parseFromString(kmlText, "text/xml") as any;
  const geoJson = toGeoJSON.kml(kmlDoc);

  const pits: ParsedPit[] = [];

  for (const feature of geoJson.features) {
    if (feature.geometry?.type !== "Point") continue;

    const [longitude, latitude] = feature.geometry.coordinates as [number, number];
    if (!isFinite(latitude) || !isFinite(longitude)) continue;

    pits.push({
      name: feature.properties?.name || "Unnamed Pit",
      latitude,
      longitude,
      description: feature.properties?.description,
    });
  }

  return pits;
}
