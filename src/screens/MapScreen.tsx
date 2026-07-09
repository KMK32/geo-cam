// src/screens/MapScreen.tsx
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Image, TouchableOpacity, Alert, Platform } from 'react-native';
import MapView, { Marker, Callout, PROVIDER_GOOGLE } from 'react-native-maps';
import { scaleSize, moderateScale } from '../utils/responsive';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getCache } from '../utils/cache';
import { GBIFRecord } from '../api/gbif';
import * as Location from 'expo-location';

type Cached = { records: GBIFRecord[] } | null;

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<GBIFRecord[]>([]);
  const [region, setRegion] = useState<any>(null);

  // using `any` for the ref avoids typing incompatibilities across react-native-maps versions
  const mapRef = useRef<any>(null);

  useEffect(() => {
    (async () => {
      try {
        const cached: Cached = await getCache('gbif_last_results');
        if (cached && cached.records && cached.records.length > 0) {
          setRecords(cached.records);
          // pick the first record with valid lat/lon to center map
          const first = cached.records.find((r) => r.decimalLatitude && r.decimalLongitude);
          if (first) {
            const lat = first.decimalLatitude!;
            const lon = first.decimalLongitude!;
            setRegion({
              latitude: lat,
              longitude: lon,
              latitudeDelta: 0.2,
              longitudeDelta: 0.2,
            });
          }
        } else {
          setRecords([]);
        }
      } catch (e) {
        setRecords([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const centerOn = (lat: number, lon: number, delta = 0.08) => {
    if (!mapRef.current) return;
    try {
      // try animateCamera if available
      if (typeof mapRef.current.animateCamera === 'function') {
        // animateCamera signature can vary by platform/version, use a safe object
        mapRef.current.animateCamera(
          {
            center: { latitude: lat, longitude: lon },
            pitch: 0,
            heading: 0,
            zoom: Platform.OS === 'android' ? 12 : undefined,
          },
          { duration: 700 }
        );
      } else {
        // fallback to animateToRegion
        mapRef.current.animateToRegion({ latitude: lat, longitude: lon, latitudeDelta: delta, longitudeDelta: delta }, 700);
      }
    } catch (e) {
      // last-resort fallback
      try {
        mapRef.current.animateToRegion({ latitude: lat, longitude: lon, latitudeDelta: delta, longitudeDelta: delta }, 700);
      } catch {
        // ignore
      }
    }
  };

  const goToMyLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Location permission is required to show your live location.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;
      centerOn(lat, lon, 0.02);
    } catch (e) {
      Alert.alert('Error', 'Could not determine your location: ' + (e as Error).message);
    }
  };

  if (loading) {
    return <ActivityIndicator style={{ marginTop: 60 }} size="large" />;
  }

  if (!region) {
    return (
      <View style={[styles.center, { paddingTop: Math.max(insets.top, scaleSize(12)) }]}>
        <Text style={{ color: '#666' }}>No recent biodiversity results to show on map. Fetch occurrences in Biodiversity first.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, scaleSize(6)) }]}>
      <MapView
        ref={(r) => { mapRef.current = r; }} // <- void-returning ref callback (fixes TS error)
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={region}
        showsUserLocation={true}
        showsMyLocationButton={false}
      >
        {records.map((r, idx) => {
          const lat = r.decimalLatitude ?? null;
          const lon = r.decimalLongitude ?? null;
          if (!lat || !lon) return null;
          const title = r.scientificName ?? r.species ?? 'Unknown';
          const thumbnail = r.media && r.media.length > 0 ? (r.media[0].identifier ?? null) : null;
          return (
            <Marker coordinate={{ latitude: lat, longitude: lon }} key={String(r.key ?? idx)}>
              <Callout tooltip>
                <View style={styles.callout}>
                  <Text style={styles.callTitle}>{title}</Text>
                  {thumbnail ? (
                    <Image source={{ uri: thumbnail }} style={styles.callImage} />
                  ) : (
                    <View style={[styles.callImage, styles.imagePlaceholder]}>
                      <Text>No image</Text>
                    </View>
                  )}
                  <Text style={styles.callText}>{r.country ?? ''} {r.eventDate ? `• ${r.eventDate.split('T')[0]}` : ''}</Text>
                </View>
              </Callout>
            </Marker>
          );
        })}
      </MapView>

      <TouchableOpacity style={[styles.floatingLeft]} onPress={goToMyLocation}>
        <Text style={{ color: '#fff', fontWeight: '700' }}>My Location</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.floating}
        onPress={() => {
          if (records.length > 0 && records[0].decimalLatitude && records[0].decimalLongitude) {
            centerOn(records[0].decimalLatitude!, records[0].decimalLongitude!, 0.1);
          }
        }}
      >
        <Text style={{ color: '#fff', fontWeight: '700' }}>Center</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  map: { flex: 1 },
  callout: { width: scaleSize(180), padding: scaleSize(8), backgroundColor: '#fff', borderRadius: 8, alignItems: 'center' },
  callTitle: { fontWeight: '700', marginBottom: 6, color: '#074b3b' },
  callImage: { width: scaleSize(140), height: scaleSize(90), borderRadius: 6, marginBottom: 6, backgroundColor: '#ddd' },
  imagePlaceholder: { justifyContent: 'center', alignItems: 'center', backgroundColor: '#8fb69a' },
  callText: { color: '#666', fontSize: moderateScale(12) },
  floating: { position: 'absolute', right: 16, bottom: 24, backgroundColor: '#0A8F6A', padding: 12, borderRadius: 10 },
  floatingLeft: { position: 'absolute', left: 16, bottom: 24, backgroundColor: '#0A8F6A', padding: 12, borderRadius: 10 },
});
