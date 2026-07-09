// src/screens/BiodiversityScreen.tsx
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  Image,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { useLocationContext } from '../utils/LocationContext';
import { fetchGbifOccurrences, GBIFRecord } from '../api/gbif';
import { fetchINatImagesByLocation, fetchINatImageByTaxonName } from '../api/inaturalist';
import { scaleSize, moderateScale } from '../utils/responsive';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { setCache, getCache } from '../utils/cache';
import { useIsFocused, useNavigation } from '@react-navigation/native';

const CACHE_PREFIX = 'gbif_cache_'; // key: gbif_cache_{lat}_{lon}_{radius}
const LATEST_KEY = 'gbif_last_results'; // key to store latest result for map

function SpeciesCard({ item, imageUrl }: { item: GBIFRecord; imageUrl: string | null }) {
  const thumb = imageUrl;
  return (
    <View style={styles.card}>
      {thumb ? (
        <Image source={{ uri: thumb }} style={styles.cardImage} />
      ) : (
        <View style={[styles.cardImage, styles.cardImagePlaceholder]}>
          <Text style={{ color: '#fff' }}>No image</Text>
        </View>
      )}
      <View style={styles.cardContent}>
        <Text style={styles.scientific}>{item.scientificName ?? item.species ?? 'Unknown'}</Text>
        <Text style={styles.meta}>
          {item.genus ? `Genus: ${item.genus}` : ''} {item.family ? ` • ${item.family}` : ''}
        </Text>
        <Text style={styles.metaSmall}>{item.country ?? ''} {item.eventDate ? ` • ${item.eventDate?.split('T')[0]}` : ''}</Text>
      </View>
    </View>
  );
}

export default function BiodiversityScreen() {
  const insets = useSafeAreaInsets();
  const { coords } = useLocationContext();
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState<GBIFRecord[]>([]);
  const [imageMap, setImageMap] = useState<Record<string, string | null>>({});
  const [radiusKm, setRadiusKm] = useState<number>(5); // default
  const [selectedPreset, setSelectedPreset] = useState<number | null>(5);
  const isFocused = useIsFocused();
  const navigation = useNavigation();

  const presets = [1, 5, 10, 20, 50];

  const cacheKeyFor = (lat: number, lon: number, r: number) => {
    const k = `${CACHE_PREFIX}${lat.toFixed(4)}_${lon.toFixed(4)}_${r}`;
    return k;
  };

  // load cached or fresh data
  const load = async (radius = radiusKm, useCache = true) => {
    if (!coords) {
      Alert.alert('No location', 'Please capture a photo or detect location on the Home screen first.');
      return;
    }
    try {
      setLoading(true);
      const key = cacheKeyFor(coords.latitude, coords.longitude, radius);

      // try cache first
      if (useCache) {
        const cached = await getCache<{ records: GBIFRecord[]; imageMap: Record<string, string | null> }>(key);
        if (cached) {
          setRecords(cached.records);
          setImageMap(cached.imageMap ?? {});
          setLoading(false);
          return;
        }
      }

      // fresh fetch
      const res = await fetchGbifOccurrences(coords.latitude, coords.longitude, radius, 120);
      setRecords(res);

      // build set of candidate names
      const names = new Set<string>();
      for (const r of res) {
        const n = r.scientificName ?? r.species ?? r.genus ?? null;
        if (n) names.add(n);
      }

      // bulk iNaturalist by location
      const inatMap = await fetchINatImagesByLocation(coords.latitude, coords.longitude, radius, 200);

      const merged: Record<string, string | null> = { ...inatMap };

      // small name-based lookups for missing names
      for (const name of Array.from(names)) {
        if (!merged[name]) {
          const byName = await fetchINatImageByTaxonName(name, 6);
          if (byName) merged[name] = byName;
        }
      }

      setImageMap(merged);

      // cache results for 24h (86400s)
      await setCache(key, { records: res, imageMap: merged }, 86400);

      // store last results (for MapScreen)
      await setCache(LATEST_KEY, { records: res }, 86400);
    } catch (err) {
      Alert.alert('Error', 'Could not fetch biodiversity data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // reload when focused (keeps UI fresh if user returned)
    if (isFocused && coords) {
      load(radiusKm, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFocused]);

  const onPresetPress = (p: number) => {
    setRadiusKm(p);
    setSelectedPreset(p);
    load(p, false);
  };

  const openMap = async () => {
    // save latest results again to ensure MapScreen reads them
    try {
      await setCache(LATEST_KEY, { records }, 86400);
      // navigate to Map screen
      navigation.navigate('Map' as never);
    } catch (e) {
      navigation.navigate('Map' as never);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, scaleSize(12)) }]}>
      <Text style={styles.title}>Biodiversity</Text>

      <View style={styles.controls}>
        <Text style={styles.controlLabel}>Search radius: {radiusKm} km</Text>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: scaleSize(8) }}>
          {presets.map((p) => (
            <TouchableOpacity
              key={p}
              style={[styles.presetBtn, selectedPreset === p ? styles.presetSelected : null]}
              onPress={() => onPresetPress(p)}
            >
              <Text style={[styles.presetText, selectedPreset === p ? { color: '#fff' } : {}]}>{p} km</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Slider
          style={{ width: '100%', height: 40 }}
          minimumValue={1}
          maximumValue={50}
          step={1}
          value={radiusKm}
          onValueChange={(v) => { setRadiusKm(Math.round(v)); setSelectedPreset(null); }}
          onSlidingComplete={(v) => load(Math.round(v), false)}
          minimumTrackTintColor="#0A8F6A"
          maximumTrackTintColor="#ddd"
        />

        <View style={{ flexDirection: 'row', marginTop: scaleSize(8), justifyContent: 'space-between' }}>
          <TouchableOpacity style={styles.refreshBtn} onPress={() => load(radiusKm, false)}>
            <Text style={styles.refreshText}>Refresh</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.refreshBtn, { backgroundColor: '#0b6b4f' }]} onPress={openMap}>
            <Text style={styles.refreshText}>Open Map</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading && <ActivityIndicator size="large" />}

      {!loading && records.length === 0 && <Text style={styles.hint}>No species found nearby (try expanding radius or capture location).</Text>}

      <FlatList
        data={records}
        keyExtractor={(i) => String(i.key ?? i.occurrenceId ?? Math.random())}
        renderItem={({ item }) => {
          let imageUrl: string | null = null;
          if (Array.isArray(item.media) && item.media.length > 0) {
            const m = item.media[0];
            imageUrl = m.identifier ?? (m.type ? String(m.type) : null) ?? null;
          }
          const name = item.scientificName ?? item.species ?? item.genus ?? null;
          if (!imageUrl && name && imageMap[name]) imageUrl = imageMap[name];

          return <SpeciesCard item={item} imageUrl={imageUrl ?? null} />;
        }}
        contentContainerStyle={{ paddingBottom: 60 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: scaleSize(14), backgroundColor: '#f2fdf8' },
  title: { fontSize: moderateScale(22), fontWeight: '700', color: '#0b845f', marginBottom: scaleSize(10) },
  hint: { color: '#666', marginTop: scaleSize(6) },
  controls: { backgroundColor: '#fff', padding: scaleSize(10), borderRadius: scaleSize(10), marginBottom: scaleSize(10) },
  controlLabel: { fontSize: moderateScale(14), marginBottom: scaleSize(6) },
  presetBtn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, backgroundColor: '#f0f5f0' },
  presetSelected: { backgroundColor: '#0A8F6A' },
  presetText: { color: '#1c3a2f', fontWeight: '600' },
  refreshBtn: { marginTop: scaleSize(8), backgroundColor: '#0A8F6A', padding: scaleSize(10), borderRadius: scaleSize(8), alignItems: 'center', width: '48%' },
  refreshText: { color: '#fff', fontWeight: '600' },
  card: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: scaleSize(10), padding: scaleSize(10), marginVertical: scaleSize(8), elevation: 1 },
  cardImage: { width: scaleSize(86), height: scaleSize(86), borderRadius: scaleSize(8), backgroundColor: '#ddd' },
  cardImagePlaceholder: { justifyContent: 'center', alignItems: 'center', backgroundColor: '#8fb69a' },
  cardContent: { marginLeft: scaleSize(10), flex: 1, justifyContent: 'center' },
  scientific: { fontSize: moderateScale(16), fontWeight: '700', color: '#074b3b' },
  meta: { fontSize: moderateScale(13), color: '#4b5a52', marginTop: scaleSize(4) },
  metaSmall: { fontSize: moderateScale(12), color: '#7b8b82', marginTop: scaleSize(4) },
});
