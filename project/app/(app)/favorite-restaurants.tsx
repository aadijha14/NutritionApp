// Favorite Restaurants Screen (app/(app)/favorite-restaurants.tsx)
import React, { useState, useEffect, useContext } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, ActivityIndicator, Platform } from 'react-native';
import { router } from 'expo-router';
import { auth, db } from '../../firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';
import { ArrowLeft, Star, MapPin, Heart } from 'lucide-react-native';
import { ThemeContext } from '../../context/ThemeContext';

interface RestaurantDetails {
  place_id: string;
  name: string;
  address: string;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
  rating?: number;
  photos?: any[];
}

const FavoriteRestaurantsScreen: React.FC = () => {
  const { theme } = useContext(ThemeContext);
  const isDark = theme === 'dark';

  const [favoriteRestaurants, setFavoriteRestaurants] = useState<RestaurantDetails[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState('AIzaSyBoVlv19_MvrLn6M1hcjzMrBCaUvAoIWsA');

  useEffect(() => {
    fetchFavorites();
  }, []);

  const fetchFavorites = async () => {
    if (!auth.currentUser) {
      setLoading(false);
      setError('You must be logged in to view favorite restaurants');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Get user's favorite restaurant IDs
      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      if (!userDoc.exists() || !userDoc.data().favorites || userDoc.data().favorites.length === 0) {
        setLoading(false);
        setFavoriteRestaurants([]);
        return;
      }

      const favoriteIds = userDoc.data().favorites;
      
      // Fetch details for each favorite restaurant
      const detailsPromises = favoriteIds.map(async (placeId: string) => {
        // First check if we have this restaurant in our database
        const restaurantDoc = await getDoc(doc(db, 'restaurants', placeId));
        
        if (restaurantDoc.exists()) {
          const data = restaurantDoc.data();
          return {
            place_id: placeId,
            name: data.name,
            address: data.address,
            geometry: {
              location: data.location || { lat: 0, lng: 0 }
            },
            // Add any other fields we have stored
          };
        } else {
          // If not in our database, fetch from Google Places API
          try {
            const response = await fetch(
              `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,formatted_address,geometry,rating&key=${apiKey}`
            );
            const data = await response.json();
            
            if (data.status === 'OK' && data.result) {
              return {
                place_id: placeId,
                name: data.result.name,
                address: data.result.formatted_address,
                geometry: data.result.geometry,
                rating: data.result.rating
              };
            } else {
              console.error(`Failed to fetch details for place ID: ${placeId}`);
              // Return a placeholder for failed fetches
              return {
                place_id: placeId,
                name: "Restaurant Information Unavailable",
                address: "Address not available",
                geometry: {
                  location: { lat: 0, lng: 0 }
                }
              };
            }
          } catch (error) {
            console.error(`Error fetching details for place ID: ${placeId}`, error);
            // Return a placeholder for failed fetches
            return {
              place_id: placeId,
              name: "Restaurant Information Unavailable",
              address: "Address not available",
              geometry: {
                location: { lat: 0, lng: 0 }
              }
            };
          }
        }
      });
      
      // Wait for all detail fetches to complete
      const restaurantDetails = await Promise.all(detailsPromises);
      setFavoriteRestaurants(restaurantDetails);
    } catch (error) {
      console.error('Error fetching favorites:', error);
      setError('Failed to load favorite restaurants. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectRestaurant = (restaurant: RestaurantDetails) => {
    router.push({
      pathname: '/(app)/restaurant-details',
      params: { 
        placeId: restaurant.place_id,
        name: restaurant.name,
        latitude: restaurant.geometry.location.lat,
        longitude: restaurant.geometry.location.lng,
        address: restaurant.address
      }
    });
  };

  const renderRestaurantItem = ({ item }: { item: RestaurantDetails }) => (
    <TouchableOpacity
      style={[styles.restaurantItem, isDark && styles.restaurantItemDark]}
      onPress={() => handleSelectRestaurant(item)}
    >
      <View style={styles.restaurantInfo}>
        <Text style={[styles.restaurantName, isDark && styles.textLight]}>{item.name}</Text>
        <Text style={[styles.restaurantAddress, isDark && styles.restaurantAddressDark]}>{item.address}</Text>
        {item.rating && (
          <View style={styles.ratingContainer}>
            <Star size={16} color="#FFD700" fill="#FFD700" />
            <Text style={[styles.ratingText, isDark && styles.ratingTextDark]}>{item.rating}</Text>
          </View>
        )}
      </View>
      <View style={styles.actionContainer}>
        <MapPin size={24} color="#2ecc71" />
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
      <View style={[styles.header, isDark && styles.headerDark]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color="#2ecc71" />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, isDark && styles.textLight]}>My Favorites</Text>
        <View style={styles.heartContainer}>
          <Heart size={24} color="#ff6b6b" fill="#ff6b6b" />
        </View>
      </View>

      {loading ? (
        <View style={[styles.loadingContainer, isDark && styles.loadingContainerDark]}>
          <ActivityIndicator size="large" color="#2ecc71" />
          <Text style={[styles.loadingText, isDark && styles.textLight]}>Loading your favorites...</Text>
        </View>
      ) : error ? (
        <View style={[styles.errorContainer, isDark && styles.errorContainerDark]}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={fetchFavorites}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : favoriteRestaurants.length === 0 ? (
        <View style={[styles.emptyContainer, isDark && styles.emptyContainerDark]}>
          <Heart size={48} color={isDark ? "#555" : "#ccc"} />
          <Text style={[styles.emptyText, isDark && styles.textLight]}>No favorite restaurants yet</Text>
          <Text style={[styles.emptySubText, isDark && styles.emptySubTextDark]}>
            Start exploring and add restaurants to your favorites!
          </Text>
          <TouchableOpacity
            style={styles.exploreButton}
            onPress={() => router.push('/(app)/nearby-restaurants')}
          >
            <Text style={styles.exploreButtonText}>Explore Restaurants</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={favoriteRestaurants}
          renderItem={renderRestaurantItem}
          keyExtractor={(item) => item.place_id}
          contentContainerStyle={[
            styles.listContainer,
            { paddingBottom: 80 } // Add extra padding for the bottom tab bar
          ]}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9f9f9',
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
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
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
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2ecc71',
  },
  heartContainer: {
    padding: 4,
  },
  listContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  restaurantItem: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  restaurantItemDark: {
    backgroundColor: '#1e1e1e',
    shadowColor: '#000',
  },
  restaurantInfo: {
    flex: 1,
  },
  restaurantName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
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
  actionContainer: {
    justifyContent: 'center',
    paddingLeft: 12,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainerDark: {
    backgroundColor: '#121212',
  },
  loadingText: {
    marginTop: 16,
    color: '#666',
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorContainerDark: {
    backgroundColor: '#121212',
  },
  errorText: {
    color: '#ff6b6b',
    marginBottom: 16,
    textAlign: 'center',
    fontSize: 16,
  },
  retryButton: {
    backgroundColor: '#2ecc71',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyContainerDark: {
    backgroundColor: '#121212',
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#555',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubText: {
    fontSize: 14,
    color: '#777',
    textAlign: 'center',
    marginBottom: 24,
  },
  emptySubTextDark: {
    color: '#aaa',
  },
  exploreButton: {
    backgroundColor: '#2ecc71',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  exploreButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default FavoriteRestaurantsScreen;