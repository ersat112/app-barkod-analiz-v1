import * as Location from 'expo-location';

export type LocationPermissionSnapshot = {
  granted: boolean;
  canAskAgain: boolean;
  status: Location.PermissionStatus;
};

export type CurrentLocationContext = {
  latitude: number;
  longitude: number;
  city?: string | null;
  district?: string | null;
};

export async function requestLocationPermission(): Promise<LocationPermissionSnapshot> {
  const current = await Location.getForegroundPermissionsAsync();

  if (current.granted) {
    return {
      granted: true,
      canAskAgain: current.canAskAgain,
      status: current.status,
    };
  }

  const response = await Location.requestForegroundPermissionsAsync();

  return {
    granted: response.granted,
    canAskAgain: response.canAskAgain,
    status: response.status,
  };
}

export async function getCurrentLocationContext(): Promise<CurrentLocationContext | null> {
  const permission = await Location.getForegroundPermissionsAsync();

  if (!permission.granted) {
    return null;
  }

  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });
  const latitude = position.coords.latitude;
  const longitude = position.coords.longitude;

  let city: string | null = null;
  let district: string | null = null;

  try {
    const [place] = await Location.reverseGeocodeAsync({
      latitude,
      longitude,
    });

    city = place?.city ?? place?.subregion ?? place?.region ?? null;
    district = place?.district ?? place?.subregion ?? null;
  } catch (error) {
    console.warn('Reverse geocode failed:', error);
  }

  return {
    latitude,
    longitude,
    city,
    district,
  };
}
