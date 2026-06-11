#!/usr/bin/env python3
"""
Pull airport-owned parcel boundaries from Metro Nashville's ArcGIS service
and render them. Run anywhere with internet (your Parcel Party env, any terminal).

    pip install matplotlib        # only dependency beyond the stdlib
    python pull_mnaa_parcels.py

Outputs: mnaa_parcels.geojson, mnaa_parcels.csv, mnaa_parcels.png, mnaa_parcels.pdf
"""

import json, csv, urllib.parse, urllib.request

# ---- Metro Nashville / Davidson County parcel ownership layer ----
BASE = ("https://maps.nashville.gov/arcgis/rest/services/Cadastral/"
        "Cadastral_Layers/MapServer/4/query")

# Broad net first. After you see results, tighten to the exact stored string,
# e.g. "Owner LIKE 'METROPOLITAN NASHVILLE AIRPORT%'". Note: some holdings may be
# titled to MNAA Properties Corp, and ground-leased parcels still show MNAA as owner.
WHERE = "Owner LIKE '%AIRPORT%'"

OUT_FIELDS = "Owner,APN,PropAddr,OwnAddr1,OwnCity,OwnState,OwnZip"
PAGE = 2000  # server MaxRecordCount is 4000; page to be safe


def fetch_all():
    feats, offset = [], 0
    while True:
        params = {
            "where": WHERE, "outFields": OUT_FIELDS,
            "returnGeometry": "true", "outSR": "4326", "f": "geojson",
            "resultOffset": offset, "resultRecordCount": PAGE,
        }
        url = BASE + "?" + urllib.parse.urlencode(params)
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=60) as r:
            gj = json.load(r)
        batch = gj.get("features", [])
        feats.extend(batch)
        print(f"  fetched {len(batch)} (total {len(feats)})")
        if len(batch) < PAGE:
            break
        offset += PAGE
    return {"type": "FeatureCollection", "features": feats}


def coords_of(geom):
    """Yield each ring's (xs, ys) for Polygon / MultiPolygon (ignores any Z)."""
    if not geom:
        return
    t, c = geom.get("type"), geom.get("coordinates", [])
    polys = c if t == "MultiPolygon" else [c] if t == "Polygon" else []
    for poly in polys:
        for ring in poly:
            xs = [pt[0] for pt in ring]
            ys = [pt[1] for pt in ring]
            yield xs, ys


def main():
    print("Querying Metro Nashville ArcGIS ...")
    fc = fetch_all()
    n = len(fc["features"])
    print(f"Total parcels: {n}")
    if n == 0:
        print("No matches — widen/adjust the WHERE clause.")
        return

    with open("mnaa_parcels.geojson", "w") as f:
        json.dump(fc, f)

    # CSV of owners / addresses
    with open("mnaa_parcels.csv", "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["APN", "Owner", "PropAddr", "OwnAddr1", "OwnCity", "OwnState", "OwnZip"])
        for ft in fc["features"]:
            p = ft.get("properties", {})
            w.writerow([p.get(k, "") for k in
                        ["APN", "Owner", "PropAddr", "OwnAddr1", "OwnCity", "OwnState", "OwnZip"]])

    # Render
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    fig, ax = plt.subplots(figsize=(12, 12))
    for ft in fc["features"]:
        for xs, ys in coords_of(ft.get("geometry")):
            ax.fill(xs, ys, facecolor="#cfe3d4", edgecolor="#1F3A5F", lw=0.7, zorder=2)
    ax.set_aspect("equal")
    ax.set_title(f"Airport-owned parcels — Davidson County, TN  ({n} parcels)\n"
                 f"Source: Metro Nashville GIS (Cadastral_Layers/4)  ·  WHERE {WHERE}",
                 fontsize=11)
    ax.set_xlabel("Longitude"); ax.set_ylabel("Latitude")
    ax.ticklabel_format(useOffset=False, style="plain")
    fig.savefig("mnaa_parcels.png", dpi=200, bbox_inches="tight", facecolor="white")
    fig.savefig("mnaa_parcels.pdf", bbox_inches="tight", facecolor="white")
    print("Wrote mnaa_parcels.geojson / .csv / .png / .pdf")

    # Tip: to add an aerial basemap, reproject to 3857 and use contextily:
    #   import geopandas, contextily
    #   gdf = geopandas.read_file("mnaa_parcels.geojson").to_crs(3857)
    #   ax = gdf.plot(fc="none", ec="red", lw=1)
    #   contextily.add_basemap(ax, source=contextily.providers.Esri.WorldImagery)


if __name__ == "__main__":
    main()
