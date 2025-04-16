// NearbyRestaurantsScreen (app/(app)/nearby-restaurants.tsx)
import React, { useEffect, useState, useRef, useContext } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  ActivityIndicator, 
  Alert, 
  Platform, 
  Linking, 
  ScrollView 
} from 'react-native';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import { auth, db } from '../../firebaseConfig';
import { doc, updateDoc, arrayUnion, arrayRemove, getDoc } from 'firebase/firestore';
import { Search, MapPin, Star, ArrowLeft, Heart } from 'lucide-react-native';
import { ThemeContext } from '../../context/ThemeContext';

// Conditionally import MapView components
let MapView: any;
let Marker: any;
let PROVIDER_GOOGLE: any;

// Only import map components on native platforms
if (Platform.OS !== 'web') {
  const ReactNativeMaps = require('react-native-maps');
  MapView = ReactNativeMaps.default;
  Marker = ReactNativeMaps.Marker;
  PROVIDER_GOOGLE = ReactNativeMaps.PROVIDER_GOOGLE;
}

interface Restaurant {
  place_id: string;
  name: string;
  vicinity: string;
  formatted_address?: string; // Added for text search results
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
  photos?: Array<{ photo_reference: string }>;
  rating?: number;
  isFavorite?: boolean;
}

interface Region {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

const NearbyRestaurantsScreen: React.FC = () => {
  const { theme } = useContext(ThemeContext);
  const isDark = theme === 'dark';

  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [filteredRestaurants, setFilteredRestaurants] = useState<Restaurant[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [mapRegion, setMapRegion] = useState<Region | null>(null);
  const mapRef = useRef<any>(null);
  const [apiKey, setApiKey] = useState('AIzaSyBoVlv19_MvrLn6M1hcjzMrBCaUvAoIWsA');
  const [locationPermissionBlocked, setLocationPermissionBlocked] = useState(false);
  
  // Mock data for testing in case API fails
  const mockRestaurants: Restaurant[] = [
    {
      place_id: 'mock1',
      name: 'Local Bistro',
      vicinity: '123 Main St',
      geometry: {
        location: {
          lat: 1.3521,
          lng: 103.8198
        }
      },
      rating: 4.5
    },
    {
      place_id: 'mock2',
      name: 'Cafe Delight',
      vicinity: '456 Oak Ave',
      geometry: {
        location: {
          lat: 1.3423,
          lng: 103.8148
        }
      },
      rating: 4.2
    },
    {
      place_id: 'mock3',
      name: 'The Tasty Spot',
      vicinity: '789 Pine Blvd',
      geometry: {
        location: {
          lat: 1.3621,
          lng: 103.8298
        }
      },
      rating: 4.7
    }
  ];
  
  // Get user location and nearby restaurants
  useEffect(() => {
    (async () => {
      try {
        // First check if location permission is already denied
        const { status: foregroundStatus } = await Location.getForegroundPermissionsAsync();
        if (foregroundStatus === 'denied') {
          setLocationPermissionBlocked(true);
          setErrorMsg('Location permission is denied. Please enable location services in your device settings.');
          
          // Use Singapore as default location
          const defaultRegion = {
            latitude: 1.3521,
            longitude: 103.8198,
            latitudeDelta: 0.0922,
            longitudeDelta: 0.0421,
          };
          
          setMapRegion(defaultRegion);
          
          // Use mock data
          const restaurantsWithFavorites = mockRestaurants.map((restaurant) => ({
            ...restaurant,
            isFavorite: favorites.includes(restaurant.place_id)
          }));
          
          setRestaurants(restaurantsWithFavorites);
          setFilteredRestaurants(restaurantsWithFavorites);
          setLoading(false);
          return;
        }
        
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setErrorMsg('Permission to access location was denied');
          setLoading(false);
          // Use a default location (e.g. Singapore)
          setMapRegion({
            latitude: 1.3521,
            longitude: 103.8198,
            latitudeDelta: 0.0922,
            longitudeDelta: 0.0421,
          });
          
          // Use mock data
          const restaurantsWithFavorites = mockRestaurants.map((restaurant) => ({
            ...restaurant,
            isFavorite: favorites.includes(restaurant.place_id)
          }));
          
          setRestaurants(restaurantsWithFavorites);
          setFilteredRestaurants(restaurantsWithFavorites);
          return;
        }

        try {
          let location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          console.log("Got location:", location.coords);
          setLocation(location);
          
          const region = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            latitudeDelta: 0.0922,
            longitudeDelta: 0.0421,
          };
          
          setMapRegion(region);
          
          // Fetch nearby restaurants
          await fetchNearbyRestaurants(location.coords.latitude, location.coords.longitude);
          
          // Fetch user favorites
          if (auth.currentUser) {
            const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
            if (userDoc.exists() && userDoc.data().favorites) {
              setFavorites(userDoc.data().favorites);
            }
          }
        } catch (error) {
          console.error('Error getting location or restaurants:', error);
          setErrorMsg('Could not fetch locations. Please try again later.');
          
          // Use mock data
          const restaurantsWithFavorites = mockRestaurants.map((restaurant) => ({
            ...restaurant,
            isFavorite: favorites.includes(restaurant.place_id)
          }));
          
          setRestaurants(restaurantsWithFavorites);
          setFilteredRestaurants(restaurantsWithFavorites);
        } finally {
          setLoading(false);
        }
      } catch (error) {
        console.error("Location permission error:", error);
        setErrorMsg('Error accessing location permissions');
        setLoading(false);
        
        // Use mock data
        const restaurantsWithFavorites = mockRestaurants.map((restaurant) => ({
          ...restaurant,
          isFavorite: favorites.includes(restaurant.place_id)
        }));
        
        setRestaurants(restaurantsWithFavorites);
        setFilteredRestaurants(restaurantsWithFavorites);
      }
    })();
  }, []);
  
  // Update filtered restaurants when search query changes
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredRestaurants(restaurants);
    } else {
      const lowercaseQuery = searchQuery.toLowerCase();
      const filtered = restaurants.filter((restaurant) => 
        restaurant.name.toLowerCase().includes(lowercaseQuery) || 
        (restaurant.vicinity && restaurant.vicinity.toLowerCase().includes(lowercaseQuery))
      );
      setFilteredRestaurants(filtered);
    }
  }, [searchQuery, restaurants]);

  // Update restaurant favorite status when favorites change
  useEffect(() => {
    const updatedRestaurants = restaurants.map(restaurant => ({
      ...restaurant,
      isFavorite: favorites.includes(restaurant.place_id)
    }));
    setRestaurants(updatedRestaurants);
    setFilteredRestaurants(updatedRestaurants);
  }, [favorites]);

  const fetchNearbyRestaurants = async (latitude: number, longitude: number) => {
    try {
      console.log(`Fetching restaurants at: ${latitude},${longitude}`);
      const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${latitude},${longitude}&radius=1500&type=restaurant&key=${apiKey}`;
      
      console.log("API URL:", url);
      const response = await fetch(url);
      const data = await response.json();
      
      console.log("API Response status:", data.status);
      console.log("API Response has results:", !!data.results);
      
      if (data.status === 'OK' && data.results && data.results.length > 0) {
        // Add isFavorite property based on user's favorites
        const restaurantsWithFavorites = data.results.map((restaurant: Restaurant) => ({
          ...restaurant,
          isFavorite: favorites.includes(restaurant.place_id)
        }));
        
        console.log(`Found ${restaurantsWithFavorites.length} restaurants`);
        setRestaurants(restaurantsWithFavorites);
        setFilteredRestaurants(restaurantsWithFavorites);
      } else if (data.status === 'ZERO_RESULTS') {
        console.log("No restaurants found nearby");
        setErrorMsg('No restaurants found in this area. Try a different location.');
        // Use mock data since API returned no results
        const restaurantsWithFavorites = mockRestaurants.map((restaurant) => ({
          ...restaurant,
          isFavorite: favorites.includes(restaurant.place_id)
        }));
        
        setRestaurants(restaurantsWithFavorites);
        setFilteredRestaurants(restaurantsWithFavorites);
      } else {
        console.error("API error status:", data.status);
        setErrorMsg(`Error fetching restaurants: ${data.status}. Using sample data instead.`);
        
        // Use mock data
        const restaurantsWithFavorites = mockRestaurants.map((restaurant) => ({
          ...restaurant,
          isFavorite: favorites.includes(restaurant.place_id)
        }));
        
        setRestaurants(restaurantsWithFavorites);
        setFilteredRestaurants(restaurantsWithFavorites);
      }
    } catch (error) {
      console.error('Error fetching nearby restaurants:', error);
      setErrorMsg('Failed to fetch restaurants. Using sample data instead.');
      
      // Use mock data
      const restaurantsWithFavorites = mockRestaurants.map((restaurant) => ({
        ...restaurant,
        isFavorite: favorites.includes(restaurant.place_id)
      }));
      
      setRestaurants(restaurantsWithFavorites);
      setFilteredRestaurants(restaurantsWithFavorites);
    }
  };

  const searchRestaurantsByName = async () => {
    if (!searchQuery.trim()) return;
    
    setLoading(true);
    setErrorMsg(null);
    
    try {
      // If we don't have location, use a default one
      const lat = location?.coords.latitude || 1.3521; // Singapore coordinates as default
      const lng = location?.coords.longitude || 103.8198;
      
      console.log(`Searching for "${searchQuery}" at: ${lat},${lng}`);
      const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=restaurant+${encodeURIComponent(searchQuery)}&location=${lat},${lng}&radius=5000&key=${apiKey}`;
      
      console.log("Search API URL:", url);
      const response = await fetch(url);
      const data = await response.json();
      
      console.log("Search API Response status:", data.status);
      
      if (data.status === 'OK' && data.results && data.results.length > 0) {
        // Process each result to ensure it has a vicinity/address
        const processedResults = data.results.map((restaurant: any) => {
          // Text search uses formatted_address instead of vicinity, make sure we have a consistent property
          if (!restaurant.vicinity && restaurant.formatted_address) {
            restaurant.vicinity = restaurant.formatted_address;
          }
          
          // If somehow both are missing, add a placeholder
          if (!restaurant.vicinity && !restaurant.formatted_address) {
            restaurant.vicinity = "Address not available";
          }
          
          return {
            ...restaurant,
            isFavorite: favorites.includes(restaurant.place_id)
          };
        });
        
        console.log(`Found ${processedResults.length} restaurants for search`);
        setRestaurants(processedResults);
        setFilteredRestaurants(processedResults);
      } else if (data.status === 'ZERO_RESULTS') {
        setErrorMsg(`No restaurants found for "${searchQuery}"`);
        setFilteredRestaurants([]);
      } else {
        console.error("Search API error:", data.status);
        setErrorMsg(`Search failed (${data.status}). Using sample data instead.`);
        
        // Filter mock data based on search
        const lowercaseQuery = searchQuery.toLowerCase();
        const filteredMock = mockRestaurants.filter(
          restaurant => restaurant.name.toLowerCase().includes(lowercaseQuery)
        ).map(restaurant => ({
          ...restaurant,
          isFavorite: favorites.includes(restaurant.place_id)
        }));
        
        setRestaurants(filteredMock);
        setFilteredRestaurants(filteredMock);
      }
    } catch (error) {
      console.error('Error searching restaurants:', error);
      setErrorMsg('Search failed. Please try again.');
      
      // Filter mock data based on search
      const lowercaseQuery = searchQuery.toLowerCase();
      const filteredMock = mockRestaurants.filter(
        restaurant => restaurant.name.toLowerCase().includes(lowercaseQuery)
      ).map(restaurant => ({
        ...restaurant,
        isFavorite: favorites.includes(restaurant.place_id)
      }));
      
      setRestaurants(filteredMock);
      setFilteredRestaurants(filteredMock);
    } finally {
      setLoading(false);
    }
  };

  const openAppSettings = () => {
    if (Platform.OS === 'ios') {
      Linking.openURL('app-settings:');
    } else {
      Linking.openSettings();
    }
  };

  const toggleFavorite = async (restaurant: Restaurant) => {
    if (!auth.currentUser) {
      Alert.alert('Login Required', 'Please login to save favorites');
      return;
    }
    
    const userId = auth.currentUser.uid;
    const userRef = doc(db, 'users', userId);
    
    try {
      if (restaurant.isFavorite) {
        // Remove from favorites
        await updateDoc(userRef, {
          favorites: arrayRemove(restaurant.place_id)
        });
        setFavorites(favorites.filter(id => id !== restaurant.place_id));
      } else {
        // Add to favorites
        await updateDoc(userRef, {
          favorites: arrayUnion(restaurant.place_id)
        });
        setFavorites([...favorites, restaurant.place_id]);
      }
    } catch (error) {
      console.error('Error updating favorites:', error);
      Alert.alert('Error', 'Failed to update favorites. Please try again.');
    }
  };

  const focusOnRestaurant = (restaurant: Restaurant) => {
    if (Platform.OS !== 'web' && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: restaurant.geometry.location.lat,
        longitude: restaurant.geometry.location.lng,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01
      }, 1000);
    }
  };

  const navigateToFavorites = () => {
    router.push('/(app)/favorite-restaurants');
  };

  const handleSelectRestaurant = (restaurant: Restaurant) => {
    router.push({
      pathname: '/(app)/restaurant-details',
      params: { 
        placeId: restaurant.place_id,
        name: restaurant.name,
        latitude: restaurant.geometry.location.lat,
        longitude: restaurant.geometry.location.lng,
        address: restaurant.vicinity || ''
      }
    });
  };

  const renderRestaurantItem = (restaurant: Restaurant) => (
    <TouchableOpacity 
      key={restaurant.place_id}
      style={[styles.restaurantItem, isDark && styles.restaurantItemDark]}
      onPress={() => handleSelectRestaurant(restaurant)}
    >
      <View style={styles.restaurantInfo}>
        <Text style={[styles.restaurantName, isDark && styles.textLight]}>{restaurant.name}</Text>
        <Text style={[styles.restaurantAddress, isDark && styles.restaurantAddressDark]}>{restaurant.vicinity}</Text>
        {restaurant.rating && (
          <View style={styles.ratingContainer}>
            <Star size={16} color="#FFD700" fill="#FFD700" />
            <Text style={[styles.ratingText, isDark && styles.ratingTextDark]}>{restaurant.rating}</Text>
          </View>
        )}
      </View>
      <View style={styles.restaurantActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => focusOnRestaurant(restaurant)}
        >
          <MapPin size={20} color="#2ecc71" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => toggleFavorite(restaurant)}
        >
          <Heart 
            size={20} 
            color="#FF6B6B" 
            fill={restaurant.isFavorite ? "#FF6B6B" : "transparent"} 
          />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  // Render the content that updates based on loading, errors, etc.
  const renderContent = () => {
    if (loading) {
      return (
        <View style={[styles.loadingContainer, isDark && styles.loadingContainerDark]}>
          <ActivityIndicator size="large" color="#2ecc71" />
          <Text style={[styles.loadingText, isDark && styles.textLight]}>Loading restaurants...</Text>
        </View>
      );
    }
    
    if (locationPermissionBlocked) {
      return (
        <View style={[styles.errorContainer, isDark && styles.errorContainerDark]}>
          <Text style={styles.errorText}>Location permission is required to find nearby restaurants.</Text>
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={openAppSettings}
          >
            <Text style={styles.retryButtonText}>Open Settings</Text>
          </TouchableOpacity>
          
          <Text style={[styles.orText, isDark && styles.orTextDark]}>OR</Text>
          
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={() => {
              setFilteredRestaurants(
                mockRestaurants.map(r => ({...r, isFavorite: false}))
              );
              setErrorMsg(null);
            }}
          >
            <Text style={styles.retryButtonText}>Use Sample Data</Text>
          </TouchableOpacity>
        </View>
      );
    }
    
    if (errorMsg && filteredRestaurants.length === 0) {
      return (
        <View style={[styles.errorContainer, isDark && styles.errorContainerDark]}>
          <Text style={styles.errorText}>{errorMsg}</Text>
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={() => {
              if (location) {
                setLoading(true);
                setErrorMsg(null);
                fetchNearbyRestaurants(location.coords.latitude, location.coords.longitude);
              } else {
                // Use mock data
                setFilteredRestaurants(
                  mockRestaurants.map(r => ({...r, isFavorite: false}))
                );
                setErrorMsg(null);
              }
            }}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }
    
    // Render list of restaurant items if available
    return (
      <View style={styles.listContainer}>
        {filteredRestaurants.length > 0 ? (
          filteredRestaurants.map((restaurant) => renderRestaurantItem(restaurant))
        ) : (
          <View style={[styles.emptyContainer, isDark && styles.emptyContainerDark]}>
            <Text style={[styles.emptyText, isDark && styles.textLight]}>No restaurants found</Text>
          </View>
        )}
      </View>
    );
  };

  // Render map component
  const renderMap = () => {
    if (Platform.OS === 'web') {
      return (
        <View style={[styles.webMapPlaceholder, isDark && styles.webMapPlaceholderDark]}>
          <Text style={[styles.webMapText, isDark && styles.webMapTextDark]}>Map view is not available on web platform</Text>
          <Text style={[styles.webMapSubtext, isDark && styles.webMapSubtextDark]}>Please use our mobile app for full map functionality</Text>
        </View>
      );
    }
    
    if (!mapRegion) return null;
    
    return (
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={mapRegion}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
      >
        {/* User's location marker */}
        {location && (
          <Marker
            coordinate={{
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
            }}
            title="You are here"
            pinColor="#2ecc71"
          />
        )}
        
        {/* Restaurant markers */}
        {filteredRestaurants.map((restaurant) => (
          <Marker
            key={restaurant.place_id}
            coordinate={{
              latitude: restaurant.geometry.location.lat,
              longitude: restaurant.geometry.location.lng,
            }}
            title={restaurant.name}
            description={restaurant.vicinity}
            onPress={() => handleSelectRestaurant(restaurant)}
          />
        ))}
      </MapView>
    );
  };

  return (
    <ScrollView contentContainerStyle={[styles.container, isDark && styles.containerDark]}>
      <View style={[styles.header, isDark && styles.headerDark]}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color="#2ecc71" />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, isDark && styles.textLight]}>Nearby Restaurants</Text>
      </View>
      
      <View style={[styles.searchContainer, isDark && styles.searchContainerDark]}>
        <TextInput
          style={[styles.searchInput, isDark && styles.searchInputDark]}
          placeholder="Search restaurants..."
          placeholderTextColor={isDark ? "#777" : undefined}
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={searchRestaurantsByName}
        />
        <TouchableOpacity 
          style={styles.searchButton}
          onPress={searchRestaurantsByName}
        >
          <Search size={20} color="#fff" />
        </TouchableOpacity>
      </View>
      
      <View style={[styles.actionsContainer, isDark && styles.actionsContainerDark]}>
        <TouchableOpacity
          style={styles.favoritesButton}
          onPress={navigateToFavorites}
        >
          <Heart size={18} color="#fff" fill="#fff" />
          <Text style={styles.favoritesButtonText}>View Favorites</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.mapContainer}>
        {renderMap()}
      </View>
      
      <View style={styles.resultsContainer}>
        <Text style={[styles.resultsTitle, isDark && styles.resultsTitleDark]}>
          {filteredRestaurants.length} Restaurant{filteredRestaurants.length !== 1 ? 's' : ''} Found
        </Text>
        {renderContent()}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f9f9f9',
    paddingBottom: 16,
  },
  containerDark: {
    backgroundColor: '#121212',
  },
  textLight: {
    color: '#f2f2f2',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
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
  headerDark: {
    backgroundColor: '#1e1e1e',
    shadowColor: '#000',
  },
  backButton: {
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2ecc71',
  },
  searchContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
  },
  searchContainerDark: {
    backgroundColor: '#1e1e1e',
  },
  searchInput: {
    flex: 1,
    height: 44,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    paddingHorizontal: 16,
    marginRight: 8,
    fontSize: 16,
  },
  searchInputDark: {
    backgroundColor: '#2a2a2a',
    color: '#f2f2f2',
  },
  searchButton: {
    width: 44,
    height: 44,
    backgroundColor: '#2ecc71',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionsContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: 'white',
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  actionsContainerDark: {
    backgroundColor: '#1e1e1e',
  },
  favoritesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ff6b6b',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  favoritesButtonText: {
    color: 'white',
    fontWeight: 'bold',
    marginLeft: 4,
  },
  mapContainer: {
    height: 200,
    marginVertical: 12,
    marginHorizontal: 16,
    borderRadius: 8,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
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
  webMapPlaceholderDark: {
    backgroundColor: '#2a2a2a',
  },
  webMapText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#666',
    textAlign: 'center',
  },
  webMapTextDark: {
    color: '#aaa',
  },
  webMapSubtext: {
    fontSize: 12,
    color: '#888',
    textAlign: 'center',
    marginTop: 8,
  },
  webMapSubtextDark: {
    color: '#999',
  },
  resultsContainer: {
    paddingHorizontal: 16,
  },
  resultsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginVertical: 12,
    color: '#555',
  },
  resultsTitleDark: {
    color: '#aaa',
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 32,
  },
  loadingContainerDark: {
    backgroundColor: '#121212',
  },
  loadingText: {
    marginTop: 8,
    fontSize: 16,
    color: '#555',
  },
  errorContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 32,
  },
  errorContainerDark: {
    backgroundColor: '#121212',
  },
  errorText: {
    fontSize: 16,
    color: '#ff6b6b',
    textAlign: 'center',
    marginBottom: 16,
  },
  orText: {
    marginVertical: 10,
    fontSize: 16,
    fontWeight: 'bold',
    color: '#666',
  },
  orTextDark: {
    color: '#aaa',
  },
  retryButton: {
    backgroundColor: '#2ecc71',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginVertical: 4,
  },
  retryButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  listContainer: {
    paddingBottom: 16,
  },
  restaurantItem: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  restaurantItemDark: {
    backgroundColor: '#1e1e1e',
    shadowColor: '#000',
  },
  restaurantInfo: {
    flex: 1,
  },
  restaurantName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
    color: '#333',
  },
  restaurantAddress: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  restaurantAddressDark: {
    color: '#aaa',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    marginLeft: 4,
    fontSize: 14,
    color: '#555',
  },
  ratingTextDark: {
    color: '#aaa',
  },
  restaurantActions: {
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  actionButton: {
    padding: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
  },
  emptyContainerDark: {
    backgroundColor: '#121212',
  },
  emptyText: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
  },
});

export default NearbyRestaurantsScreen;