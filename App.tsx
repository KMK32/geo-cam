// App.tsx
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import BottomTabs from './src/navigation/BottomTabs';
import { LocationProvider } from './src/utils/LocationContext';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function App() {
  return (
    <SafeAreaProvider>
      <LocationProvider>
        <NavigationContainer>
          <BottomTabs />
        </NavigationContainer>
      </LocationProvider>
    </SafeAreaProvider>
  );
}
