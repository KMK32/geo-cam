// src/screens/WeatherScreen.tsx
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  ScrollView,
} from 'react-native';
import { useLocationContext } from '../utils/LocationContext';
import { fetchWeatherAt, WeatherNow } from '../api/weather';
import { scaleSize, moderateScale } from '../utils/responsive';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Converts ISO → "DD-MM-YYYY HH:MM"
function formatDateTime(iso?: string | null): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${dd}-${mm}-${yyyy}  ${hh}:${min}`;
  } catch {
    return String(iso);
  }
}

export default function WeatherScreen() {
  const insets = useSafeAreaInsets();
  const { coords } = useLocationContext();
  const [weather, setWeather] = useState<WeatherNow | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (!coords) {
      Alert.alert('No location', 'Please detect or capture a location on the Home screen first.');
      return;
    }
    try {
      setLoading(true);
      const w = await fetchWeatherAt(coords.latitude, coords.longitude);
      setWeather(w);
    } catch (err) {
      Alert.alert('Error', 'Could not fetch weather: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (coords) load();
  }, [coords]);

  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        { paddingTop: Math.max(insets.top, scaleSize(12)) },
      ]}
    >
      <Text style={styles.title}>Weather</Text>

      <View style={styles.card}>
        {!coords && (
          <Text style={styles.hint}>
            No coordinates available. Go to Home and detect a location.
          </Text>
        )}

        {loading && <ActivityIndicator size="large" />}

        {weather && !loading && (
          <>
            {/* Temperature */}
            <View style={styles.row}>
              <Text style={styles.label}>Temperature</Text>
              <Text style={styles.value}>
                {weather.temperature !== null ? `${weather.temperature} °C` : '—'}
              </Text>
            </View>

            {/* Humidity */}
            <View style={styles.row}>
              <Text style={styles.label}>Feels like / Humidity</Text>
              <Text style={styles.value}>
                {weather.humidity !== null ? `${weather.humidity} %` : '—'}
              </Text>
            </View>

            {/* Pressure */}
            <View style={styles.row}>
              <Text style={styles.label}>Pressure</Text>
              <Text style={styles.value}>
                {weather.pressure !== null ? `${weather.pressure} hPa` : '—'}
              </Text>
            </View>

            {/* Wind */}
            <View style={styles.row}>
              <Text style={styles.label}>Wind</Text>
              <Text style={styles.value}>
                {weather.windspeed !== null ? `${weather.windspeed} m/s` : '—'}{' '}
                {weather.winddirection !== null
                  ? ` @ ${weather.winddirection}°`
                  : ''}
              </Text>
            </View>

            {/* Precipitation */}
            <View style={styles.row}>
              <Text style={styles.label}>Precipitation</Text>
              <Text style={styles.value}>
                {weather.precipitation !== null ? `${weather.precipitation} mm` : '—'}
              </Text>
            </View>

            {/* Precipitation probability */}
            <View style={styles.row}>
              <Text style={styles.label}>Precip. Prob.</Text>
              <Text style={styles.value}>
                {(weather as any).precipitation_probability !== undefined
                  ? `${(weather as any).precipitation_probability} %`
                  : '—'}
              </Text>
            </View>

            {/* Cloud cover */}
            <View style={styles.row}>
              <Text style={styles.label}>Cloud cover</Text>
              <Text style={styles.value}>
                {weather.cloudcover !== null ? `${weather.cloudcover} %` : '—'}
              </Text>
            </View>

            {/* Visibility */}
            <View style={styles.row}>
              <Text style={styles.label}>Visibility</Text>
              <Text style={styles.value}>
                {weather.visibility !== null ? `${weather.visibility} m` : '—'}
              </Text>
            </View>

            {/* UV Index */}
            <View style={styles.row}>
              <Text style={styles.label}>UV Index</Text>
              <Text style={styles.value}>
                {weather.uv_index !== null ? `${weather.uv_index}` : '—'}
              </Text>
            </View>

            {/* Sunrise/Sunset */}
            <View
              style={[
                styles.row,
                { alignItems: 'flex-start', paddingVertical: scaleSize(14) },
              ]}
            >
              <Text style={[styles.label, { paddingTop: scaleSize(2) }]}>
                Sunrise / Sunset
              </Text>

              <View style={{ flex: 1, alignItems: 'flex-end' }}>
                <Text style={styles.valueWrap}>
                  {formatDateTime(weather.sunrise)}
                </Text>
                <Text style={[styles.valueWrap, { marginTop: scaleSize(4) }]}>
                  {formatDateTime(weather.sunset)}
                </Text>
              </View>
            </View>
          </>
        )}

        <TouchableOpacity style={styles.button} onPress={load}>
          <Text style={styles.buttonText}>Refresh Data</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: scaleSize(18),
    paddingBottom: 80,
    backgroundColor: '#f2fdf8',
  },
  title: {
    fontSize: moderateScale(22),
    fontWeight: '700',
    color: '#0b845f',
    marginBottom: scaleSize(12),
  },
  card: {
    backgroundColor: '#fff',
    padding: scaleSize(16),
    borderRadius: scaleSize(12),
    shadowColor: '#000',
    shadowOpacity: 0.05,
    elevation: 2,
  },
  hint: { color: '#666', marginBottom: scaleSize(12) },

  // Table rows
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: scaleSize(10),
    borderBottomWidth: 0.5,
    borderBottomColor: '#eee',
  },

  label: { fontSize: moderateScale(15), color: '#333', width: '55%' },

  value: {
    fontSize: moderateScale(15),
    fontWeight: '700',
    color: '#0b845f',
    flex: 1,
    textAlign: 'right',
  },

  // Multi-line wrapping value (used for sunrise/sunset)
  valueWrap: {
    fontSize: moderateScale(14),
    fontWeight: '700',
    color: '#0b845f',
    textAlign: 'right',
    flexWrap: 'wrap',
    width: '100%',
  },

  button: {
    marginTop: scaleSize(14),
    backgroundColor: '#0A8F6A',
    padding: scaleSize(12),
    borderRadius: scaleSize(8),
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontWeight: '600' },
});
