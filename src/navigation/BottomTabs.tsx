// src/navigation/BottomTabs.tsx
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import HomeScreen from '../screens/HomeScreen';
import WeatherScreen from '../screens/WeatherScreen';
import BiodiversityScreen from '../screens/BiodiversityScreen';
import ClimateIndicesScreen from '../screens/ClimateIndicesScreen';
import MapScreen from '../screens/MapScreen';
import LocalAdviceScreen from '../screens/LocalAdviceScreen';
import { Ionicons } from '@expo/vector-icons';

const Tab = createBottomTabNavigator();

export default function BottomTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#0A8F6A',
        tabBarInactiveTintColor: '#777',
        tabBarStyle: { height: 62, paddingBottom: 6, paddingTop: 6 },

        tabBarIcon: ({ color, size }) => {
          if (route.name === 'Home') {
            return <Ionicons name="home" size={24} color={color} />;
          }
          if (route.name === 'Weather') {
            return <Ionicons name="cloud" size={24} color={color} />;
          }
          if (route.name === 'Biodiversity') {
            return <Ionicons name="leaf" size={24} color={color} />;
          }
          if (route.name === 'ClimateIndices') {
            return <Ionicons name="analytics" size={24} color={color} />;
          }
          if (route.name === 'Map') {
            return <Ionicons name="map" size={24} color={color} />;
          }
          if (route.name === 'Advice') {
            return <Ionicons name="help-circle" size={24} color={color} />;
          }
          return null;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Weather" component={WeatherScreen} />
      <Tab.Screen name="Biodiversity" component={BiodiversityScreen} />
      <Tab.Screen
        name="ClimateIndices"
        component={ClimateIndicesScreen}
        options={{ title: 'Climate' }}
      />
      <Tab.Screen name="Map" component={MapScreen} />
      <Tab.Screen name="Advice" component={LocalAdviceScreen} options={{ title: 'Advice' }} />
    </Tab.Navigator>
  );
}
