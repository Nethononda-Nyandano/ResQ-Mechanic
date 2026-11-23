import * as Location from 'expo-location';
import { updateMechanicLocation } from './mechanicService';

export interface Coordinates {
  latitude: number;
  longitude: number;
  heading?: number;
}

export interface LocationResult extends Coordinates {
  address?: string;
}

/**
 * Safely reverse geocodes coordinates to a human-readable street / area name.
 * Uses a timeout to prevent native Android Geocoder hangs, and provides
 * a quiet fallback without raising uncaught errors or noisy warnings.
 */
export async function reverseGeocodeSafe(latitude: number, longitude: number): Promise<string | undefined> {
  // 1. Try Expo Location native reverseGeocode with a strict 3.5s timeout
  try {
    const nativeReversePromise = Location.reverseGeocodeAsync({ latitude, longitude });
    const timeoutPromise = new Promise<null>((resolve) =>
      setTimeout(() => resolve(null), 3500)
    );

    const geo: any = await Promise.race([nativeReversePromise, timeoutPromise]);
    if (geo && Array.isArray(geo) && geo.length > 0) {
      const place = geo[0];
      const parts = [
        place.streetNumber,
        place.street,
        place.district || place.subregion || place.city,
      ].filter(Boolean);
      const addr = parts.length > 0 ? parts.join(', ') : (place.name || place.city || undefined);
      if (addr) return addr;
    }
  } catch {
    // Native geocoder timed out or failed; silently try web fallback
  }

  // 2. Fallback to OpenStreetMap Nominatim reverse geocode
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
      {
        signal: controller.signal,
        headers: {
          'User-Agent': 'ResQ-Mechanic-App/1.0',
          Accept: 'application/json',
        },
      }
    );
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (data && data.address) {
        const a = data.address;
        const street = [a.house_number, a.road || a.pedestrian || a.street].filter(Boolean).join(' ');
        const area = a.suburb || a.neighbourhood || a.city_district || a.city || a.town || a.village || a.county;
        const formatted = [street, area].filter(Boolean).join(', ');
        if (formatted) return formatted;
        if (data.display_name) {
          const parts = data.display_name.split(',').map((s: string) => s.trim());
          return parts.slice(0, 3).join(', ');
        }
      }
    }
  } catch {
    // Silently ignore if reverse geocoding is unavailable
  }

  return undefined;
}

/**
 * Automatically determine the device's current GPS location.
 * Does NOT return hardcoded default coordinates if unavailable.
 */
export async function getAutoLocation(): Promise<LocationResult | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      return null;
    }

    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    if (!pos || !pos.coords) {
      return null;
    }

    const coords: LocationResult = {
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      heading: pos.coords.heading || 0,
    };

    const address = await reverseGeocodeSafe(coords.latitude, coords.longitude);
    if (address) {
      coords.address = address;
    }

    return coords;
  } catch (err) {
    // Return null instead of default mock coordinates
    return null;
  }
}

/**
 * Geocodes an address string to coordinates if user manually enters or edits their base address
 */
export async function geocodeAddress(address: string): Promise<Coordinates | null> {
  try {
    if (!address || address.trim().length === 0) return null;

    // 1. Try native geocode with timeout
    try {
      const nativePromise = Location.geocodeAsync(address);
      const timeoutPromise = new Promise<null>((resolve) =>
        setTimeout(() => resolve(null), 3500)
      );
      const results: any = await Promise.race([nativePromise, timeoutPromise]);
      if (results && Array.isArray(results) && results.length > 0) {
        return {
          latitude: results[0].latitude,
          longitude: results[0].longitude,
        };
      }
    } catch {
      // Native geocode failed; continue to fallback
    }

    // 2. Fallback to OpenStreetMap Nominatim search
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`,
      {
        signal: controller.signal,
        headers: {
          'User-Agent': 'ResQ-Mechanic-App/1.0',
          Accept: 'application/json',
        },
      }
    );
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return {
          latitude: parseFloat(data[0].lat),
          longitude: parseFloat(data[0].lon),
        };
      }
    }

    return null;
  } catch (err) {
    return null;
  }
}

/**
 * Starts automatic continuous location watching and syncs coordinates directly to Supabase rescuers table
 */
export async function startAutomaticLocationSync(
  userId: string,
  onUpdate?: (coords: Coordinates) => void,
  options?: { highFrequency?: boolean }
): Promise<(() => void) | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;

    const highFrequency = Boolean(options?.highFrequency);
    const subscription = await Location.watchPositionAsync(
      {
        accuracy: highFrequency ? Location.Accuracy.BestForNavigation : Location.Accuracy.High,
        timeInterval: highFrequency ? 2000 : 8000,
        distanceInterval: highFrequency ? 4 : 15,
      },
      (loc) => {
        const coords: Coordinates = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          heading: loc.coords.heading || 0,
        };

        if (onUpdate) {
          onUpdate(coords);
        }

        if (userId) {
          updateMechanicLocation(userId, coords.latitude, coords.longitude, coords.heading || 0).catch(
            () => {}
          );
        }
      }
    );

    return () => {
      try {
        subscription.remove();
      } catch (err) {
        console.warn('Error removing location watcher:', err);
      }
    };
  } catch (err) {
    console.warn('Error starting location sync:', err);
    return null;
  }
}
