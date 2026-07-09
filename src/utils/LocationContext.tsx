// src/utils/LocationContext.tsx
import React, { createContext, useContext, useState } from 'react';

type Coords = { latitude: number; longitude: number } | null;
type ContextShape = {
  coords: Coords;
  setCoords: (c: Coords) => void;
  lastPhotoUri: string | null;
  setLastPhotoUri: (u: string | null) => void;
};

const LocationContext = createContext<ContextShape | undefined>(undefined);

export const LocationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [coords, setCoords] = useState<Coords>(null);
  const [lastPhotoUri, setLastPhotoUri] = useState<string | null>(null);

  return (
    <LocationContext.Provider value={{ coords, setCoords, lastPhotoUri, setLastPhotoUri }}>
      {children}
    </LocationContext.Provider>
  );
};

export function useLocationContext() {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error('useLocationContext must be used inside LocationProvider');
  return ctx;
}
