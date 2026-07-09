// src/api/inaturalist.ts
import axios from 'axios';

/**
 * Query iNaturalist observations near a lat/lon and return a map:
 *   scientific_name (or common key) -> thumbnail URL (or null)
 *
 * We return the first good photo for each taxon.
 *
 * No API key required.
 */

export async function fetchINatImagesByLocation(
  lat: number,
  lon: number,
  radiusKm = 5,
  perPage = 50
): Promise<Record<string, string | null>> {
  try {
    // iNaturalist expects radius in km and lat/lng params
    const url = `https://api.inaturalist.org/v1/observations?lat=${encodeURIComponent(
      lat
    )}&lng=${encodeURIComponent(lon)}&radius=${encodeURIComponent(radiusKm)}&order=desc&order_by=observed_on&per_page=${perPage}&photos=true`;

    const resp = await axios.get(url, { timeout: 10000 });
    const results = resp.data.results ?? [];

    const map: Record<string, string | null> = {};

    for (const obs of results) {
      // prefer taxon.name (scientific name) if available
      const name =
        (obs.taxon && (obs.taxon.name || obs.taxon.preferred_common_name)) ||
        obs.species_guess ||
        null;
      if (!name) continue;

      if (!map[name]) {
        // find first photo url
        if (Array.isArray(obs.photos) && obs.photos.length > 0) {
          // obs.photos[n].url typically contains templated size like ".../12345.jpg"
          // iNaturalist often gives 'url' which is already a usable link; but sometimes use photo.photo.url
          const p = obs.photos[0];
          // prefer 'url' if present, else 'photo.url'
          let photoUrl: string | null = null;
          if (p.url) photoUrl = p.url;
          else if (p.photo && p.photo.url) photoUrl = p.photo.url;

          if (photoUrl) {
            // try to normalize to a larger size by replacing 'square' with 'large' if present
            photoUrl = photoUrl.replace('square', 'large');
            map[name] = photoUrl;
            continue;
          }
        }
        // no photo found
        map[name] = null;
      }
    }

    return map;
  } catch (e) {
    // on any error return empty map
    return {};
  }
}

/**
 * Also provide a helper to query by scientific name (useful if we want direct lookups)
 */
export async function fetchINatImageByTaxonName(scientificName: string, perPage = 10): Promise<string | null> {
  try {
    const url = `https://api.inaturalist.org/v1/observations?taxon_name=${encodeURIComponent(
      scientificName
    )}&photos=true&per_page=${perPage}`;
    const resp = await axios.get(url, { timeout: 10000 });
    const results = resp.data.results ?? [];
    for (const obs of results) {
      if (Array.isArray(obs.photos) && obs.photos.length > 0) {
        let photoUrl = obs.photos[0].url ?? (obs.photos[0].photo && obs.photos[0].photo.url) ?? null;
        if (photoUrl) {
          photoUrl = photoUrl.replace('square', 'large');
          return photoUrl;
        }
      }
    }
    return null;
  } catch (e) {
    return null;
  }
}
