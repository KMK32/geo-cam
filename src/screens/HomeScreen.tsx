// src/screens/HomeScreen.tsx
import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Alert,
  Image,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { scaleSize, moderateScale } from '../utils/responsive';
import { useLocationContext } from '../utils/LocationContext';
import CameraView from '../components/CameraView';
import { generateReportPDF } from '../utils/generateReport';
import { getCache } from '../utils/cache';
import { fetchWeatherAt } from '../api/weather';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { coords, setCoords } = useLocationContext();

  // Photo state
  const [photoUri, setPhotoUri] = useState<string | null>(null);

  // Camera modal visibility
  const [cameraVisible, setCameraVisible] = useState(false);

  // small loading states
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [autoDetectingAfterCapture, setAutoDetectingAfterCapture] = useState(false);

  const cameraRef = useRef<any>(null);

  // Standard button: Request and set location (foreground)
  const detectLocation = async () => {
    try {
      setDetectingLocation(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Location permission is required to detect coordinates.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const newCoords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      setCoords(newCoords);
      Alert.alert('Location detected', `Lat: ${newCoords.latitude.toFixed(5)}, Lon: ${newCoords.longitude.toFixed(5)}`);
    } catch (err) {
      Alert.alert('Error', 'Unable to detect location: ' + (err as Error).message);
    } finally {
      setDetectingLocation(false);
    }
  };

  // After capture: automatically request permission and capture location
  const autoDetectLocationAfterCapture = async () => {
    try {
      setAutoDetectingAfterCapture(true);

      // Request permission (this will not re-prompt if already denied permanently)
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== 'granted') {
        // user denied: show gentle message and bail out
        Alert.alert(
          'Location permission required',
          'To attach coordinates to the captured photo, allow location access. You can enable it in app settings or use "Detect Location" manually.'
        );
        return;
      }

      // Get position. Note: GPS may take time to get a fix — consider higher timeout for critical use.
      // We attempt a single getCurrentPositionAsync call with high accuracy.
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });

      if (!pos?.coords) {
        throw new Error('No position returned');
      }

      const newCoords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      setCoords(newCoords);
      // small confirmation
      // We do NOT show an alert to avoid interrupting flow; instead you will see coords in UI
    } catch (err) {
      console.warn('autoDetectLocationAfterCapture error', err);
      // Do not aggressively alert; give user option to manually detect
      Alert.alert(
        'Location not captured',
        'Photo saved but coordinates could not be obtained automatically. Try the Detect Location button or ensure GPS is enabled and try again.'
      );
    } finally {
      setAutoDetectingAfterCapture(false);
    }
  };

  // Called when CameraView returns a captured photo
  const onCapture = async (uri: string | null) => {
    setPhotoUri(uri);
    setCameraVisible(false);

    // Immediately try to auto-detect location (non-blocking to UI)
    // But await here so we can show spinner state if desired
    if (uri) {
      // Start auto-detection, but don't block the UI for long — it's okay if it fails, user can re-run detect manually
      await autoDetectLocationAfterCapture();
    }
  };

  // Generate PDF handler
  const handleGenerateReport = async () => {
    if (generatingReport) return;
    if (!coords && !photoUri) {
      Alert.alert('Missing data', 'You should capture a photo or detect a location before generating a report.');
      return;
    }

    setGeneratingReport(true);

    try {
      // 1) Biodiversity: try to get cached last results (set by Biodiversity screen)
      const bioCache = await getCache<{ records: any[] }>('gbif_last_results');

      // Build species snippet
      const species = (bioCache?.records ?? []).slice(0, 3).map((r) => ({
        name: r.scientificName ?? r.species ?? r.genus ?? 'Unknown',
        image: Array.isArray(r.media) && r.media.length > 0 ? r.media[0].identifier ?? null : null,
      }));

      // 2) Weather: try cache first
      let weatherData = await getCache<any>('last_weather');
      if (!weatherData && coords) {
        // fetch fresh
        weatherData = await fetchWeatherAt(coords.latitude, coords.longitude);
      }

      // 3) Indices: try to get cached indices (you should save them to 'last_indices' when computing)
      const indices = (await getCache<any>('last_indices')) ?? {};

      // Build coordinates object for report
      const coordsForReport = coords ? { latitude: coords.latitude, longitude: coords.longitude } : null;

      // Finally call the PDF generator util
      await generateReportPDF({
        photoUri,
        coords: coordsForReport,
        weather: weatherData ?? {},
        indices,
        species,
      });

      // optionally notify user
    } catch (err) {
      console.log('Report generation error:', err);
      Alert.alert('Error', 'Could not generate report: ' + (err as Error).message);
    } finally {
      setGeneratingReport(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={[styles.container, { paddingTop: Math.max(insets.top, scaleSize(12)) }]}>
      <Text style={styles.title}>Welcome to Advanced Geo Cam</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Quick actions</Text>

        <View style={styles.row}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => setCameraVisible(true)}
          >
            <Text style={styles.actionText}>📷 Take Photo</Text>
            {autoDetectingAfterCapture && <ActivityIndicator style={{ marginTop: 6 }} />}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: '#0A8F6A' }]}
            onPress={detectLocation}
            disabled={detectingLocation}
          >
            {detectingLocation ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={[styles.actionText, { color: '#fff' }]}>🧭 Detect Location</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={{ marginTop: scaleSize(12), alignItems: 'center' }}>
          <Text style={styles.smallLabel}>Current Coordinates</Text>
          <Text style={styles.coordsText}>
            {coords ? `${coords.latitude.toFixed(5)} , ${coords.longitude.toFixed(5)}` : 'Not detected yet'}
          </Text>
        </View>

        <View style={{ marginTop: scaleSize(12), alignItems: 'center' }}>
          <Text style={styles.smallLabel}>Captured Photo</Text>
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={styles.previewImage} />
          ) : (
            <Text style={{ color: '#666', marginTop: scaleSize(6) }}>No photo yet</Text>
          )}
        </View>

        <TouchableOpacity
          style={styles.reportBtn}
          onPress={handleGenerateReport}
          disabled={generatingReport}
        >
          {generatingReport ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.reportText}>Generate Report PDF</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.footerSpace} />

      {/* Camera modal */}
      <Modal visible={cameraVisible} animationType="slide" onRequestClose={() => setCameraVisible(false)}>
        <CameraView
          onClose={() => setCameraVisible(false)}
          onCapture={(uri: string | null) => onCapture(uri)}
        />
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: scaleSize(16),
    paddingBottom: 80,
    backgroundColor: '#f2fdf8',
    minHeight: '100%',
  },
  title: {
    fontSize: moderateScale(22),
    fontWeight: '700',
    color: '#074b3b',
    marginBottom: scaleSize(12),
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: scaleSize(12),
    padding: scaleSize(14),
    shadowColor: '#000',
    shadowOpacity: 0.05,
    elevation: 2,
  },
  cardTitle: {
    fontSize: moderateScale(16),
    fontWeight: '700',
    color: '#0b845f',
    marginBottom: scaleSize(10),
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: scaleSize(10),
  },
  actionBtn: {
    flex: 1,
    backgroundColor: '#e8f6f1',
    padding: scaleSize(12),
    borderRadius: scaleSize(10),
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: {
    color: '#074b3b',
    fontWeight: '700',
  },
  smallLabel: {
    color: '#666',
    fontSize: moderateScale(12),
  },
  coordsText: {
    color: '#0b845f',
    fontWeight: '700',
    marginTop: scaleSize(6),
  },
  previewImage: {
    width: scaleSize(220),
    height: scaleSize(140),
    borderRadius: scaleSize(8),
    marginTop: scaleSize(8),
    resizeMode: 'cover',
  },
  reportBtn: {
    marginTop: scaleSize(16),
    backgroundColor: '#1A7F72',
    padding: scaleSize(14),
    borderRadius: scaleSize(10),
    width: '70%',
    alignItems: 'center',
    alignSelf: 'center',
  },
  reportText: {
    color: '#fff',
    fontSize: moderateScale(16),
    fontWeight: '700',
  },
  footerSpace: {
    height: 60,
  },
});
