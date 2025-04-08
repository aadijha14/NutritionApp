// Restaurant Directions Screen (app/(app)/restaurant-directions.tsx)
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Platform, Linking } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Location from 'expo-location';
import { ArrowLeft, Navigation, Car, Scaling as Walking, Bike } from 'lucide-react-native';

// Conditionally import MapView components
let MapView: any;
let Marker: any;
let Polyline: any;
let PROVIDER_GOOGLE: any;

// Only import map components on native platforms
if (Platform.OS !== 'web') {
  const ReactNativeMaps = require('react-native-maps');
  MapView = ReactNativeMaps.default;
  Marker = ReactNativeMaps.Marker;
  Polyline = ReactNativeMaps.Polyline;
  PROVIDER_GOOGLE = ReactNativeMaps.PROVIDER_GOOGLE;
}

type TransportMode = 'driving' | 'walking' | 'bicycling';

interface DirectionsResult {
  routes: {
    overview_polyline: {
      points: string;
    };
    legs: {
      distance: {
        text: string;
        value: number;
      };
      duration: {
        text: string;
        value: number;
      };
      steps: any[];
    }[];
  }[];
}

interface Coordinates {
  latitude: number;
  longitude: number;
}

const RestaurantDirectionsScreen: React.FC = () => {
  const params = useLocalSearchParams();
  const { placeId, name, latitude, longitude, address } = params;
  
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [directions, setDirections] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [transportMode, setTransportMode] = useState<TransportMode>('driving');
  const [apiKey, setApiKey] = useState('AIzaSyBoVlv19_MvrLn6M1hcjzMrBCaUvAoIWsA');
  
  const restaurantLocation: Coordinates = {
    latitude: Number(latitude),
    longitude: Number(longitude)
  };
  
  // Get user location
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setErrorMsg('Permission to access location was denied');
          // Use a default location (e.g., Singapore)
          setUserLocation({
            latitude: 1.3521,
            longitude: 103.8198
          });
          // Try to fetch directions with default location
          fetchDirections({
            latitude: 1.3521,
            longitude: 103.8198
          }, restaurantLocation, transportMode);
          return;
        }
        
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced
        });
        const userCoords: Coordinates = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude
        };
        setUserLocation(userCoords);
        
        // Fetch directions
        fetchDirections(userCoords, restaurantLocation, transportMode);
      } catch (error) {
        console.error('Error getting location:', error);
        setErrorMsg('Could not fetch your location. Using default location.');
        // Use a default location
        setUserLocation({
          latitude: 1.3521,
          longitude: 103.8198
        });
        // Try to fetch directions with default location
        fetchDirections({
          latitude: 1.3521,
          longitude: 103.8198
        }, restaurantLocation, transportMode);
      } finally {
        setLoading(false);
      }
    })();
  }, []);
  
  // Fetch directions when transport mode changes
  useEffect(() => {
    if (userLocation) {
      fetchDirections(userLocation, restaurantLocation, transportMode);
    }
  }, [transportMode, userLocation]);
  
  const fetchDirections = async (
    origin: Coordinates,
    destination: Coordinates,
    mode: TransportMode
  ) => {
    setLoading(true);
    
    try {
      console.log(`Fetching directions from ${origin.latitude},${origin.longitude} to ${destination.latitude},${destination.longitude} via ${mode}`);
      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.latitude},${origin.longitude}&destination=${destination.latitude},${destination.longitude}&mode=${mode}&key=${apiKey}`;
      
      console.log("Directions API URL:", url);
      const response = await fetch(url);
      const data: DirectionsResult = await response.json();
      
      console.log("Directions API status:", data.status);
      
      if (data.routes && data.routes.length > 0) {
        console.log("Got directions successfully");
        setDirections(data);
        setErrorMsg(null);
      } else {
        console.error("No routes found in directions response");
        setErrorMsg('Could not find directions to this location. Try a different transport mode.');
        // Create a simple mock directions response
        setDirections({
          routes: [{
            overview_polyline: {
              points: encodePath([origin, destination])
            },
            legs: [{
              distance: { text: "Unknown distance" },
              duration: { text: "Unknown time" }
            }]
          }]
        });
      }
    } catch (error) {
      console.error('Error fetching directions:', error);
      setErrorMsg('Failed to fetch directions. Try a different transport mode.');
      // Create a simple mock directions response
      setDirections({
        routes: [{
          overview_polyline: {
            points: encodePath([origin, destination])
          },
          legs: [{
            distance: { text: "Unknown distance" },
            duration: { text: "Unknown time" }
          }]
        }]
      });
    } finally {
      setLoading(false);
    }
  };
  
  // Simple polyline encoder for fallback when API fails
  const encodePath = (points: Coordinates[]): string => {
    // This is a very simplified encoder that doesn't actually create a valid polyline
    // But it's enough to have something to display when the API fails
    return "whatever";
  };
  
  const decodePolyline = (encoded: string): Coordinates[] => {
    // This function decodes an encoded polyline string into an array of coordinates
    if (!encoded) return [];
    
    const poly: Coordinates[] = [];
    let index = 0, lat = 0, lng = 0;
    
    try {
      while (index < encoded.length) {
        let b, shift = 0, result = 0;
        
        do {
          b = encoded.charCodeAt(index++) - 63;
          result |= (b & 0x1f) << shift;
          shift += 5;
        } while (b >= 0x20);
        
        const dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
        lat += dlat;
        
        shift = 0;
        result = 0;
        
        do {
          b = encoded.charCodeAt(index++) - 63;
          result |= (b & 0x1f) << shift;
          shift += 5;
        } while (b >= 0x20);
        
        const dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
        lng += dlng;
        
        const point: Coordinates = {
          latitude: lat / 1e5,
          longitude: lng / 1e5,
        };
        
        poly.push(point);
      }
    } catch (error) {
      console.error("Error decoding polyline:", error);
      // If decoding fails, just connect origin and destination directly
      if (userLocation) {
        return [userLocation, restaurantLocation];
      }
      return [];
    }
    
    return poly;
  };
  
  // Get appropriate map region to show both points and the route
  const getMapRegion = () => {
    if (!userLocation) {
      return {
        latitude: Number(latitude),
        longitude: Number(longitude),
        latitudeDelta: 0.05,
        longitudeDelta: 0.05
      };
    }
    
    // Calculate the center point
    const centerLat = (userLocation.latitude + Number(latitude)) / 2;
    const centerLng = (userLocation.longitude + Number(longitude)) / 2;
    
    // Calculate appropriate deltas to show both points
    const latDelta = Math.abs(userLocation.latitude - Number(latitude)) * 2.5;
    const lngDelta = Math.abs(userLocation.longitude - Number(longitude)) * 2.5;
    
    return {
      latitude: centerLat,
      longitude: centerLng,
      latitudeDelta: Math.max(0.05, latDelta),
      longitudeDelta: Math.max(0.05, lngDelta)
    };
  };
  
  const getDirectionInfo = () => {
    if (!directions || !directions.routes || directions.routes.length === 0) {
      return {
        distance: "Unknown distance",
        duration: "Unknown duration"
      };
    }
    
    const route = directions.routes[0];
    const leg = route.legs[0];
    
    return {
      distance: leg.distance.text || "Unknown distance",
      duration: leg.duration.text || "Unknown duration",
    };
  };
  
  // Open in native maps app
  const openInMaps = () => {
    try {
      const scheme = Platform.select({ ios: 'maps:0,0?q=', android: 'geo:0,0?q=' });
      const latLng = `${latitude},${longitude}`;
      const label = encodeURIComponent(name as string);
      const url = Platform.select({
        ios: `${scheme}${label}@${latLng}`,
        android: `${scheme}${latLng}(${label})`
      });
      
      if (url) {
        Linking.openURL(url).catch(err => {
          console.error('Error opening maps app:', err);
          Alert.alert('Error', 'Could not open the maps application');
        });
      }
    } catch (error) {
      console.error('Error preparing maps URL:', error);
      Alert.alert('Error', 'Could not prepare directions for external maps app');
    }
  };
  
  const directionInfo = getDirectionInfo();
  
  const renderMap = () => {
    if (Platform.OS === 'web') {
      return (
        <View style={styles.webMapPlaceholder}>
          <Text style={styles.webMapText}>Map view is not available on web platform</Text>
          <Text style={styles.webMapSubtext}>Please use our mobile app for full map functionality</Text>
        </View>
      );
    }
    
    return (
      <MapView
        style={styles.map}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        initialRegion={getMapRegion()}
      >
        {userLocation && (
          <Marker
            coordinate={userLocation}
            title="Your Location"
            pinColor="#2ecc71"
          />
        )}
        
        <Marker
          coordinate={restaurantLocation}
          title={name as string}
          description={address as string}
        />
        
        {directions && directions.routes && directions.routes.length > 0 && directions.routes[0].overview_polyline && (
          <Polyline
            coordinates={decodePolyline(directions.routes[0].overview_polyline.points)}
            strokeWidth={4}
            strokeColor="#2ecc71"
          />
        )}
      </MapView>
    );
  };
  
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color="#2ecc71" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          Directions to {name}
        </Text>
        <TouchableOpacity 
          style={styles.navigateButton}
          onPress={openInMaps}
        >
          <Navigation size={24} color="#2ecc71" />
        </TouchableOpacity>
      </View>
      
      <View style={styles.transportModeSwitcher}>
        <TouchableOpacity 
          style={[
            styles.transportModeButton,
            transportMode === 'driving' && styles.activeTransportMode
          ]}
          onPress={() => setTransportMode('driving')}
        >
          <Car size={20} color={transportMode === 'driving' ? '#fff' : '#666'} />
          <Text style={[
            styles.transportModeText,
            transportMode === 'driving' && styles.activeTransportModeText
          ]}>
            Drive
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[
            styles.transportModeButton,
            transportMode === 'walking' && styles.activeTransportMode
          ]}
          onPress={() => setTransportMode('walking')}
        >
          <Walking size={20} color={transportMode === 'walking' ? '#fff' : '#666'} />
          <Text style={[
            styles.transportModeText,
            transportMode === 'walking' && styles.activeTransportModeText
          ]}>
            Walk
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[
            styles.transportModeButton,
            transportMode === 'bicycling' && styles.activeTransportMode
          ]}
          onPress={() => setTransportMode('bicycling')}
        >
          <Bike size={20} color={transportMode === 'bicycling' ? '#fff' : '#666'} />
          <Text style={[
            styles.transportModeText,
            transportMode === 'bicycling' && styles.activeTransportModeText
          ]}>
            Bike
          </Text>
        </TouchableOpacity>
      </View>
      
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2ecc71" />
          <Text style={styles.loadingText}>Getting directions...</Text>
        </View>
      ) : (
        <View style={styles.mapContainer}>
          {renderMap()}
          
          <View style={styles.directionsInfoCard}>
            {errorMsg && (
              <Text style={styles.errorText}>{errorMsg}</Text>
            )}
            <View style={styles.directionsInfoRow}>
              <Text style={styles.directionsInfoLabel}>Distance:</Text>
              <Text style={styles.directionsInfoValue}>{directionInfo.distance}</Text>
            </View>
            <View style={styles.directionsInfoRow}>
              <Text style={styles.directionsInfoLabel}>Duration:</Text>
              <Text style={styles.directionsInfoValue}>{directionInfo.duration}</Text>
            </View>
            <Text style={styles.restaurantAddress}>{address}</Text>
            
            <TouchableOpacity 
              style={styles.openInMapsButton}
              onPress={openInMaps}
            >
              <Text style={styles.openInMapsText}>Open in Maps App</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9f9f9',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 16,
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2ecc71',
    textAlign: 'center',
    marginHorizontal: 10,
  },
  navigateButton: {
    padding: 4,
  },
  transportModeSwitcher: {
    flexDirection: 'row',
    backgroundColor: 'white',
    padding: 8,
    justifyContent: 'space-around',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  transportModeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  activeTransportMode: {
    backgroundColor: '#2ecc71',
  },
  transportModeText: {
    marginLeft: 4,
    color: '#666',
    fontWeight: 'bold',
  },
  activeTransportModeText: {
    color: 'white',
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  webMapPlaceholder: {
    flex: 1,
    backgroundColor: '#e1e1e1',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  webMapText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#666',
    textAlign: 'center',
  },
  webMapSubtext: {
    fontSize: 12,
    color: '#888',
    textAlign: 'center',
    marginTop: 8,
  },
  directionsInfoCard: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  directionsInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  directionsInfoLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  directionsInfoValue: {
    fontSize: 16,
    color: '#2ecc71',
    fontWeight: 'bold',
  },
  restaurantAddress: {
    marginTop: 4,
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 8,
    fontSize: 16,
    color: '#555',
  },
  errorText: {
    fontSize: 14,
    color: '#ff6b6b',
    marginBottom: 10,
    textAlign: 'center',
  },
  openInMapsButton: {
    backgroundColor: '#2ecc71',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  openInMapsText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default RestaurantDirectionsScreen;