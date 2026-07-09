// src/api/gbif.ts
import axios from 'axios';

export type GBIFRecord = {
  key: number;
  species?: string | null;
  scientificName?: string | null;
  genus?: string | null;
  family?: string | null;
  kingdom?: string | null;
  country?: string | null;
  decimalLatitude?: number | null;
  decimalLongitude?: number | null;
  eventDate?: string | null;
  occurrenceId?: string | null;
  media?: Array<any> | null;
};

export async function fetchGbifOccurrences(lat: number, lon: number, radiusKm = 5, limit = 30) {
  try {
    // GBIF occurrence search: use decimalLatitude/Longitude + radius
    // GBIF uses geometry param or lat/lon+radius: use 'geometry' (circle) isn't supported directly;
    // so use occurrence search with lat/lon + radius via 'geometry' approximate by bounding box:
    const r = radiusKm / 111; // approx degrees
    const minLat = lat - r;
    const maxLat = lat + r;
    const minLon = lon - r;
    const maxLon = lon + r;

    const url = `https://api.gbif.org/v1/occurrence/search?limit=${limit}&hasImage=true&decimalLatitude=${lat}&decimalLongitude=${lon}`;
    // Note: The above query tries exact lat/lon; GBIF API doesn't support radius param straightforwardly in this endpoint.
    // So instead use spatial search via geometry bbox:
    const bboxUrl = `https://api.gbif.org/v1/occurrence/search?limit=${limit}&hasImage=true&geometry=POLYGON((${minLon}%20${minLat},${maxLon}%20${minLat},${maxLon}%20${maxLat},${minLon}%20${maxLat},${minLon}%20${minLat}))`;
    const resp = await axios.get(bboxUrl, { timeout: 10000 });
    const results: GBIFRecord[] = resp.data.results ?? [];
    return results;
  } catch (err) {
    return [];
  }
}
