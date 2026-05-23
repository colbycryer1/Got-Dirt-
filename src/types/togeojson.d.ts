declare module "@mapbox/togeojson" {
  function kml(doc: Document): GeoJSON.FeatureCollection;
  function gpx(doc: Document): GeoJSON.FeatureCollection;
}
