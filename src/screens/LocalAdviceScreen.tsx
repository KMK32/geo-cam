// src/screens/LocalAdviceScreen.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, ScrollView, Image } from 'react-native';
import { useLocationContext } from '../utils/LocationContext';
import { fetchWeatherAt, WeatherNow } from '../api/weather';
import { scaleSize, moderateScale } from '../utils/responsive';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function clothingSuggestion(tempC: number | null) {
  if (tempC === null) return 'No data';
  if (tempC <= 0) return 'Heavy winter clothing, insulated jacket, gloves, hat';
  if (tempC <= 10) return 'Warm jacket, layers, closed shoes';
  if (tempC <= 20) return 'Light sweater or jacket, long pants';
  if (tempC <= 28) return 'T-shirt, light pants or shorts';
  return 'Very hot — light cotton clothing, hat, stay hydrated';
}

function foodSuggestion(tempC: number | null, precipProb: number | null) {
  if (tempC === null) return 'No data';
  if (precipProb && precipProb > 50) return 'Carry a waterproof snack; consider warm soups or hot drinks';
  if (tempC <= 10) return 'Warm meals, soups, hot beverages';
  if (tempC <= 20) return 'Comfort foods and warm drinks';
  return 'Fresh fruits, salads, light meals and lots of fluids';
}

export default function LocalAdviceScreen() {
  const insets = useSafeAreaInsets();
  const { coords } = useLocationContext();
  const [loading, setLoading] = useState(false);
  const [weather, setWeather] = useState<WeatherNow | null>(null);

  useEffect(() => {
    if (coords) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coords]);

  const load = async () => {
    if (!coords) return;
    setLoading(true);
    try {
      const w = await fetchWeatherAt(coords.latitude, coords.longitude);
      setWeather(w);
    } catch (e) {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const temp = weather?.temperature ?? null;
  const precipProb = (weather as any)?.precipitation_probability ?? null;

  return (
    <ScrollView contentContainerStyle={[styles.container, { paddingTop: Math.max(insets.top, scaleSize(12)) }]}>
      <Text style={styles.title}>Local Advice</Text>

      {!coords && <Text style={styles.hint}>No coordinates set — go to Home and capture/detect location first.</Text>}

      {loading && <ActivityIndicator size="large" />}

      {!loading && weather && (
        <>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Clothing</Text>
            <Text style={styles.cardText}>{clothingSuggestion(temp)}</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Food</Text>
            <Text style={styles.cardText}>{foodSuggestion(temp, precipProb)}</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Weather summary</Text>
            <Text style={styles.cardText}>Temperature: {weather.temperature ?? '—'} °C</Text>
            <Text style={styles.cardText}>Wind speed: {weather.windspeed ?? '—'} m/s</Text>
            <Text style={styles.cardText}>Humidity: {weather.humidity ?? '—'} %</Text>
            <Text style={styles.cardText}>Pressure: {weather.pressure ?? '—'} hPa</Text>
            {typeof (weather as any).precipitation_probability !== 'undefined' && (
              <Text style={styles.cardText}>Precipitation prob.: {(weather as any).precipitation_probability ?? '—'} %</Text>
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Safety tips</Text>
            <Text style={styles.cardText}>
              {temp !== null && temp >= 35 ? 'Heat risk — stay hydrated, avoid direct sun during midday.' : 'Normal conditions — stay aware of weather updates.'}
            </Text>
          </View>

          <TouchableOpacity style={styles.refreshBtn} onPress={load}>
            <Text style={{ color: '#fff', fontWeight: '700' }}>Refresh Advice</Text>
          </TouchableOpacity>
        </>
      )}

      {!loading && !weather && coords && (
        <TouchableOpacity style={styles.refreshBtn} onPress={load}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>Load Advice</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: scaleSize(14), paddingBottom: 60, backgroundColor: '#f2fdf8' },
  title: { fontSize: moderateScale(22), fontWeight: '700', color: '#0b845f', marginBottom: scaleSize(8) },
  hint: { color: '#666', marginBottom: scaleSize(12) },
  card: { backgroundColor: '#fff', padding: scaleSize(12), borderRadius: scaleSize(10), marginBottom: scaleSize(10) },
  cardTitle: { fontSize: moderateScale(16), fontWeight: '700', color: '#074b3b', marginBottom: scaleSize(6) },
  cardText: { fontSize: moderateScale(14), color: '#333' },
  refreshBtn: { marginTop: scaleSize(8), backgroundColor: '#0A8F6A', padding: scaleSize(12), borderRadius: scaleSize(8), alignItems: 'center' },
});
