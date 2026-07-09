// src/screens/ClimateIndicesScreen.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { scaleSize, moderateScale } from '../utils/responsive';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fetchSoundingAndCompute } from '../api/sounding';
import { useLocationContext } from '../utils/LocationContext';
import { setCache } from '../utils/cache';

type IndexInfoKey = 'showalter' | 'liftedIndex' | 'cape' | 'cin' | 'kindex' | 'tt';

const INDEX_INFO: Record<IndexInfoKey, { title: string; description: string; interpretation: string }> = {
  showalter: {
    title: 'Showalter Index',
    description:
      'Showalter Index (SI) compares environmental temperature at 500 hPa with a parcel lifted from 850 hPa. Positive SI indicates stable air; negative SI suggests potential instability.',
    interpretation: 'SI > 3: stable; SI 0–3: slight instability; SI < 0: increasing likelihood of convection.',
  },
  liftedIndex: {
    title: 'Lifted Index (LI)',
    description:
      'Lifted Index compares the environment temperature at 500 hPa with the temperature a surface parcel would have when lifted to 500 hPa. Negative values indicate instability.',
    interpretation: 'LI > 0: stable; LI 0 to -2: marginal; LI -3 to -5: moderate; LI < -6: severe instability.',
  },
  cape: {
    title: 'CAPE (Convective Available Potential Energy)',
    description:
      'CAPE measures the positive buoyant energy available to a lifted parcel (J/kg). Larger CAPE means stronger potential updrafts and more severe storms possible.',
    interpretation: 'CAPE < 1000: weak; 1000–2500: moderate; >2500: strong (severe potential).',
  },
  cin: {
    title: 'CIN (Convective INhibition)',
    description:
      'CIN represents the negative energy barrier preventing parcels from rising freely. Strong CIN can suppress convection until it is overcome.',
    interpretation: 'CIN near 0: little suppression; large negative CIN (e.g., -100+ J/kg) strongly suppresses convection.',
  },
  kindex: {
    title: 'K-index',
    description:
      'K-index is an empirical measure of thunderstorm potential using temps/dewpoints at three levels. Higher K indicates higher thunderstorm probability.',
    interpretation: 'K < 20: low; 20–25: moderate; >30: high thunderstorm chance.',
  },
  tt: {
    title: 'Total Totals (TT)',
    description: 'Total Totals index is another instability metric combining low- and mid-level instability. Higher values suggest greater convective potential.',
    interpretation: 'TT < 44: stable; 44–50: marginal; >50: significant potential.',
  },
};

export default function ClimateIndicesScreen() {
  const insets = useSafeAreaInsets();
  const { coords } = useLocationContext();

  // manual inputs (so user can still compute simple indices)
  const [T500, setT500] = useState('');
  const [T700, setT700] = useState('');
  const [T850, setT850] = useState('');
  const [Td850, setTd850] = useState('');

  // results
  const [showalter, setShowalter] = useState<number | null>(null);
  const [liftedIndex, setLiftedIndex] = useState<number | null>(null);
  const [cape, setCAPE] = useState<number | null>(null);
  const [cin, setCIN] = useState<number | null>(null);
  const [kIndex, setKIndex] = useState<number | null>(null);
  const [ttIndex, setTTIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const [infoModalKey, setInfoModalKey] = useState<IndexInfoKey | null>(null);

  const parse = (s: string) => {
    const n = parseFloat(s.replace(',', '.'));
    return isNaN(n) ? null : n;
  };

  // small helper: if value is a finite number return number, else null
  const safeNum = (v: any): number | null => {
    if (v === null || typeof v === 'undefined') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  // round helper: return rounded number or null
  const roundOrNull = (v: number | null, digits = 1) => {
    if (v === null) return null;
    const m = Math.pow(10, digits);
    return Math.round(v * m) / m;
  };

  // manual simple compute (keeps previous functionality)
  const computeManualSimple = async () => {
    const t500 = parse(T500);
    const t700 = parse(T700);
    const t850 = parse(T850);
    const td850 = parse(Td850);

    if (t500 === null || t700 === null || t850 === null || td850 === null) {
      Alert.alert('Missing inputs', 'Please enter T500, T700, T850 and Td850 to compute simple indices.');
      return;
    }

    // sample formulas (same as earlier)
    const k = (t850 - t500) + td850 - t700;
    const tt = (t850 - t500) + (td850 - t500);

    setKIndex(roundOrNull(k, 1));
    setTTIndex(roundOrNull(tt, 1));

    // Save manual results to cache so PDF can use them if user wants
    try {
      await setCache('last_indices', {
        cape: null,
        cin: null,
        li: null,
        si: null,
        ki: roundOrNull(k, 1),
        tti: roundOrNull(tt, 1),
      });
    } catch (e) {
      // ignore cache write errors
      console.warn('Could not save manual indices to cache', e);
    }

    Alert.alert('Computed', 'K-index and Total Totals saved to cache for report export.');
  };

  // Fetch sounding and compute indices using API helper.
  // This function expects fetchSoundingAndCompute to return an object with some fields,
  // but we safely access optional fields using runtime checks to avoid TypeScript errors.
  const fetchAndCompute = async () => {
    if (!coords) {
      Alert.alert('No coordinates', 'Go to Home and capture/detect a location first.');
      return;
    }
    setLoading(true);

    try {
      const res = await fetchSoundingAndCompute(coords.latitude, coords.longitude);
      // treat res as any for optional properties
      const r = res as any;

      // Safely obtain numbers
      const rawShowalter = safeNum(r.showalter ?? r.si ?? r.showAlt ?? null);
      const rawLifted = safeNum(r.liftedIndex ?? r.li ?? r.lifted ?? null);
      const rawCAPE = safeNum(r.cape ?? r.CAPE ?? null);
      const rawCIN = safeNum(r.cin ?? r.CIN ?? null);

      // set with rounding or null
      setShowalter(roundOrNull(rawShowalter, 1));
      setLiftedIndex(roundOrNull(rawLifted, 1));
      setCAPE(roundOrNull(rawCAPE, 1));
      setCIN(roundOrNull(rawCIN, 1));

      // optional extras: K index — try multiple possible property names
      const possibleK = safeNum(r.kIndex ?? r.ki ?? r.K ?? r.k ?? null);
      const possibleTT = safeNum(r.tt ?? r.TT ?? r.totalTotals ?? null);

      setKIndex(roundOrNull(possibleK, 1));
      setTTIndex(roundOrNull(possibleTT, 1));

      // Save to cache for report export — use null for missing values
      try {
        await setCache('last_indices', {
          cape: rawCAPE !== null ? rawCAPE : null,
          cin: rawCIN !== null ? rawCIN : null,
          li: rawLifted !== null ? rawLifted : null,
          si: rawShowalter !== null ? rawShowalter : null,
          ki: possibleK !== null ? possibleK : null,
          tti: possibleTT !== null ? possibleTT : null,
        });
      } catch (e) {
        console.warn('Could not save indices to cache', e);
      }
    } catch (err) {
      console.warn('fetchAndCompute error', err);
      Alert.alert('Error', 'Could not fetch sounding or compute indices: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const openInfo = (key: IndexInfoKey) => setInfoModalKey(key);
  const closeInfo = () => setInfoModalKey(null);

  return (
    <ScrollView contentContainerStyle={[styles.container, { paddingTop: Math.max(insets.top, scaleSize(12)) }]}>
      <Text style={styles.title}>Climate Indices</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Quick manual inputs (°C)</Text>
        <Text style={styles.hint}>If you already have level temps, enter them and use the simple calculator.</Text>

        <View style={styles.row}>
          <Text style={styles.label}>T500</Text>
          <TextInput value={T500} onChangeText={setT500} keyboardType="numeric" placeholder="°C" style={styles.input} />
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>T700</Text>
          <TextInput value={T700} onChangeText={setT700} keyboardType="numeric" placeholder="°C" style={styles.input} />
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>T850</Text>
          <TextInput value={T850} onChangeText={setT850} keyboardType="numeric" placeholder="°C" style={styles.input} />
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Td850</Text>
          <TextInput value={Td850} onChangeText={setTd850} keyboardType="numeric" placeholder="°C" style={styles.input} />
        </View>

        <TouchableOpacity style={styles.button} onPress={computeManualSimple}>
          <Text style={styles.buttonText}>Compute simple K-index & TT</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Auto-sounding (recommended)</Text>
        <Text style={styles.hint}>Fetch a vertical sounding and compute Showalter, Lifted Index, CAPE & CIN (approx).</Text>

        <TouchableOpacity style={styles.button} onPress={fetchAndCompute} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Fetch sounding & compute</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={styles.infoRow} onPress={() => openInfo('showalter')}>
          <Text style={styles.resultLabel}>Showalter</Text>
          <Text style={styles.resultValue}>{showalter !== null ? `${showalter}` : '—'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.infoRow} onPress={() => openInfo('liftedIndex')}>
          <Text style={styles.resultLabel}>Lifted Index (LI)</Text>
          <Text style={styles.resultValue}>{liftedIndex !== null ? `${liftedIndex}` : '—'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.infoRow} onPress={() => openInfo('cape')}>
          <Text style={styles.resultLabel}>CAPE (approx)</Text>
          <Text style={styles.resultValue}>{cape !== null ? `${cape} J/kg` : '—'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.infoRow} onPress={() => openInfo('cin')}>
          <Text style={styles.resultLabel}>CIN (approx)</Text>
          <Text style={styles.resultValue}>{cin !== null ? `${cin} J/kg` : '—'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.infoRow} onPress={() => openInfo('kindex')}>
          <Text style={styles.resultLabel}>K-index</Text>
          <Text style={styles.resultValue}>{kIndex !== null ? `${kIndex}` : '—'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.infoRow} onPress={() => openInfo('tt')}>
          <Text style={styles.resultLabel}>Total Totals (TT)</Text>
          <Text style={styles.resultValue}>{ttIndex !== null ? `${ttIndex}` : '—'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Notes & caveats</Text>
        <Text style={styles.hint}>
          CAPE/CIN computation is approximate and best for demonstration. For operational use higher-resolution soundings and exact thermodynamics are required.
        </Text>
      </View>

      <Modal visible={infoModalKey !== null} animationType="slide" transparent>
        <View style={styles.modalWrap}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{infoModalKey ? INDEX_INFO[infoModalKey].title : ''}</Text>
            <Text style={styles.modalDesc}>{infoModalKey ? INDEX_INFO[infoModalKey].description : ''}</Text>
            <Text style={[styles.modalDesc, { marginTop: scaleSize(8), fontWeight: '700' }]}>Interpretation</Text>
            <Text style={styles.modalDesc}>{infoModalKey ? INDEX_INFO[infoModalKey].interpretation : ''}</Text>

            <TouchableOpacity style={[styles.button, { marginTop: scaleSize(12) }]} onPress={closeInfo}>
              <Text style={styles.buttonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: scaleSize(16), paddingBottom: 80, backgroundColor: '#f2fdf8' },
  title: { fontSize: moderateScale(22), fontWeight: '700', color: '#0b845f', marginVertical: scaleSize(8) },
  card: { backgroundColor: '#fff', padding: scaleSize(12), borderRadius: scaleSize(10), marginBottom: scaleSize(12) },
  cardTitle: { fontSize: moderateScale(16), fontWeight: '700', color: '#074b3b', marginBottom: scaleSize(8) },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: scaleSize(8) },
  label: { fontSize: moderateScale(14), marginRight: 8, width: '30%' },
  input: { width: '65%', borderWidth: 1, borderColor: '#eee', padding: scaleSize(8), borderRadius: scaleSize(8), textAlign: 'center', fontSize: moderateScale(14) },
  button: { marginTop: scaleSize(6), backgroundColor: '#0A8F6A', padding: scaleSize(10), borderRadius: scaleSize(8), alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '700' },
  resultRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: scaleSize(8), borderTopWidth: 0.5, borderTopColor: '#eee', marginTop: scaleSize(10) },
  resultLabel: { fontSize: moderateScale(15), color: '#333' },
  resultValue: { fontSize: moderateScale(15), color: '#0b845f', fontWeight: '700' },
  hint: { fontSize: moderateScale(12), color: '#666' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: scaleSize(10), borderBottomWidth: 0.5, borderBottomColor: '#f0f0f0', alignItems: 'center' },
  modalWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.35)' },
  modalCard: { width: '90%', backgroundColor: '#fff', borderRadius: 12, padding: scaleSize(14) },
  modalTitle: { fontSize: moderateScale(18), fontWeight: '800', color: '#074b3b' },
  modalDesc: { fontSize: moderateScale(14), color: '#333', marginTop: scaleSize(8) },
});
