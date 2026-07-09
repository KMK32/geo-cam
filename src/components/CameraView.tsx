// src/components/CameraView.tsx
import React, { useState } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

type Props = {
  onClose: () => void;
  onCapture: (uri: string | null) => void;
};

function extractUriFromImagePickerResult(res: any): string | null {
  // Newer API: { canceled: boolean, assets: [{ uri, ... }] }
  if (res == null) return null;
  if (typeof res === 'object') {
    if ('canceled' in res) {
      if (res.canceled) return null;
      if (Array.isArray(res.assets) && res.assets.length > 0) return res.assets[0].uri ?? null;
    }
    // older API: { cancelled: boolean, uri: string }
    if ('cancelled' in res) {
      if (res.cancelled) return null;
      if ('uri' in res && typeof res.uri === 'string') return res.uri;
    }
    // fallback: sometimes result itself contains uri
    if ('uri' in res && typeof res.uri === 'string') return res.uri;
    // fallback: assets array under different name
    if (Array.isArray(res.assets) && res.assets.length > 0) return res.assets[0].uri ?? null;
  }
  return null;
}

export default function CameraView({ onClose, onCapture }: Props) {
  const [busy, setBusy] = useState(false);

  const openCamera = async () => {
    try {
      setBusy(true);
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Camera permission is required to take a photo.');
        setBusy(false);
        return;
      }

      // launch native camera UI
      const result: any = await ImagePicker.launchCameraAsync({
        quality: 0.7,
        allowsEditing: false,
        exif: true,
      });

      const uri = extractUriFromImagePickerResult(result);
      onCapture(uri);
    } catch (err) {
      Alert.alert('Error', 'Unable to open camera: ' + (err as Error).message);
      onCapture(null);
    } finally {
      setBusy(false);
    }
  };

  const pickFromGallery = async () => {
    try {
      setBusy(true);
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Media library permission is required to pick a photo.');
        setBusy(false);
        return;
      }

      const res: any = await ImagePicker.launchImageLibraryAsync({
        quality: 0.7,
        exif: true,
      });

      const uri = extractUriFromImagePickerResult(res);
      onCapture(uri);
    } catch (err) {
      Alert.alert('Error', 'Unable to open gallery: ' + (err as Error).message);
      onCapture(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Capture Photo</Text>

      <TouchableOpacity style={styles.button} onPress={openCamera} disabled={busy}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Open Camera</Text>}
      </TouchableOpacity>

      <TouchableOpacity style={[styles.button, styles.alt]} onPress={pickFromGallery} disabled={busy}>
        <Text style={styles.buttonText}>Pick from Gallery</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.button, styles.close]} onPress={() => onClose()} disabled={busy}>
        <Text style={styles.buttonText}>Close</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f7fff9' },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 18, color: '#0b845f' },
  button: { width: 260, padding: 14, borderRadius: 10, backgroundColor: '#0A8F6A', alignItems: 'center', marginTop: 12 },
  alt: { backgroundColor: '#128a9e' },
  close: { backgroundColor: '#888', marginTop: 24 },
  buttonText: { color: '#fff', fontWeight: '600' },
});
