// Restaurant Details Screen (app/(app)/restaurant-details.tsx)
import React, { useEffect, useState, useContext } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, ActivityIndicator, Alert, Platform, Image } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { auth, db } from '../../firebaseConfig';
import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { ArrowLeft, Heart, Plus, MapPin, ArrowUpRight, Search, X } from 'lucide-react-native';
import { ThemeContext } from '../../context/ThemeContext';

// Conditionally import MapView components
let MapView: any;
let Marker: any;
let PROVIDER_GOOGLE: any;

// Only import map components on native platforms
if (Platform.OS !== 'web') {
  try {
    const ReactNativeMaps = require('react-native-maps');
    MapView = ReactNativeMaps.default;
    Marker = ReactNativeMaps.Marker;
    PROVIDER_GOOGLE = ReactNativeMaps.PROVIDER_GOOGLE;
  } catch (error) {
    console.error('Failed to load react-native-maps:', error);
  }
}

interface NutritionData {
  food_name?: string;
  nf_calories: number;
  nf_total_fat: number;
  nf_total_carbohydrate: number;
  nf_protein: number;
}

interface MenuItem {
  id: string;
  foodName: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  createdBy?: string;
  createdAt?: any;
}

const RestaurantDetailsScreen: React.FC = () => {
  const params = useLocalSearchParams();
  const { placeId, name, latitude, longitude, address } = params;
  
  const { theme } = useContext(ThemeContext);
  const isDark = theme === 'dark';
  
  const [isFavorite, setIsFavorite] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [filteredMenuItems, setFilteredMenuItems] = useState<MenuItem[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isAddingMode, setIsAddingMode] = useState<boolean>(false);
  const [fetchingNutrition, setFetchingNutrition] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [addingItem, setAddingItem] = useState<boolean>(false);
  
  // Fetch restaurant details and check if it's a favorite
  useEffect(() => {
    const fetchRestaurantDetails = async () => {
      if (!placeId) return;
      
      setLoading(true);
      
      try {
        // Check if restaurant is a favorite
        if (auth.currentUser) {
          const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
          if (userDoc.exists() && userDoc.data().favorites) {
            setIsFavorite(userDoc.data().favorites.includes(placeId));
          }
        }
        
        // Fetch restaurant menu items
        await fetchRestaurantItems(placeId as string);
      } catch (error) {
        console.error('Error fetching restaurant details:', error);
        setErrorMsg('Failed to fetch restaurant details');
      } finally {
        setLoading(false);
      }
    };
    
    fetchRestaurantDetails();
  }, [placeId]);
  
  // Filter menu items when search query changes
  useEffect(() => {
    if (!isAddingMode) {
      if (searchQuery.trim() === '') {
        setFilteredMenuItems(menuItems);
      } else {
        const lowercaseQuery = searchQuery.toLowerCase();
        const filtered = menuItems.filter(item => 
          item.foodName.toLowerCase().includes(lowercaseQuery)
        );
        setFilteredMenuItems(filtered);
      }
    }
  }, [searchQuery, menuItems, isAddingMode]);
  
  const fetchRestaurantItems = async (restaurantId: string) => {
    try {
      // Check if restaurant document exists
      const restaurantDoc = await getDoc(doc(db, 'restaurants', restaurantId));
      
      if (restaurantDoc.exists() && restaurantDoc.data().items) {
        const items = restaurantDoc.data().items;
        setMenuItems(items);
        setFilteredMenuItems(items);
      } else {
        // If no document exists, create one with empty items array
        await setDoc(doc(db, 'restaurants', restaurantId), {
          placeId: restaurantId,
          name: name,
          address: address,
          location: { lat: Number(latitude), lng: Number(longitude) },
          items: []
        });
        setMenuItems([]);
        setFilteredMenuItems([]);
      }
    } catch (error) {
      console.error('Error fetching restaurant items:', error);
      setErrorMsg('Failed to fetch menu items');
    }
  };
  
  const toggleFavorite = async () => {
    if (!auth.currentUser) {
      Alert.alert('Login Required', 'Please login to save favorites');
      return;
    }
    
    const userId = auth.currentUser.uid;
    const userRef = doc(db, 'users', userId);
    
    try {
      const userDoc = await getDoc(userRef);
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const favorites = userData.favorites || [];
        
        if (isFavorite) {
          // Remove from favorites
          const updatedFavorites = favorites.filter((id: string) => id !== placeId);
          await updateDoc(userRef, { favorites: updatedFavorites });
        } else {
          // Add to favorites
          const updatedFavorites = [...favorites, placeId];
          await updateDoc(userRef, { favorites: updatedFavorites });
        }
        
        setIsFavorite(!isFavorite);
      }
    } catch (error) {
      console.error('Error updating favorites:', error);
      Alert.alert('Error', 'Failed to update favorites');
    }
  };
  
  const getNutritionData = async (foodName: string): Promise<NutritionData | null> => {
    setFetchingNutrition(true);
    
    try {
      const response = await fetch('https://trackapi.nutritionix.com/v2/natural/nutrients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-app-id': 'a712f1f5',
          'x-app-key': '93d5ae72f7914659738752a846c039ab',
        },
        body: JSON.stringify({ query: foodName }),
      });
      
      const data = await response.json();
      
      if (data.foods && data.foods.length > 0) {
        return {
          food_name: data.foods[0].food_name,
          nf_calories: data.foods[0].nf_calories || 0,
          nf_total_fat: data.foods[0].nf_total_fat || 0,
          nf_total_carbohydrate: data.foods[0].nf_total_carbohydrate || 0,
          nf_protein: data.foods[0].nf_protein || 0,
        };
      }
      
      return null;
    } catch (error) {
      console.error('Error fetching nutrition data:', error);
      return null;
    } finally {
      setFetchingNutrition(false);
    }
  };
  
  const addNewItemToRestaurant = async () => {
    if (!searchQuery.trim()) {
      Alert.alert('Input Required', 'Please enter a food item name');
      return;
    }
    
    if (!placeId) {
      setErrorMsg('Restaurant ID is missing');
      return;
    }
    
    try {
      setAddingItem(true);
      
      // Get nutrition data for the new item
      const nutritionData = await getNutritionData(searchQuery);
      
      if (!nutritionData) {
        Alert.alert('Error', 'Could not retrieve nutrition information for this item');
        setAddingItem(false);
        return;
      }
      
      // Create new item object
      const newItem: MenuItem = {
        id: Date.now().toString(),
        foodName: searchQuery,
        calories: Math.round(nutritionData.nf_calories),
        protein: Math.round(nutritionData.nf_protein),
        carbs: Math.round(nutritionData.nf_total_carbohydrate),
        fat: Math.round(nutritionData.nf_total_fat),
        createdBy: auth.currentUser?.uid || 'anonymous',
        createdAt: new Date(),
      };
      
      // Update restaurant document in Firestore
      const restaurantRef = doc(db, 'restaurants', placeId as string);
      const restaurantDoc = await getDoc(restaurantRef);
      
      if (restaurantDoc.exists()) {
        // Create a new items array with the new item added
        const updatedItems = [...(restaurantDoc.data().items || []), newItem];
        
        // Update the document with the new items array
        await updateDoc(restaurantRef, { items: updatedItems });
        
        // Update local state
        setMenuItems(updatedItems);
        setFilteredMenuItems(updatedItems);
        
        // Clear input and show success message
        setSearchQuery('');
        setIsAddingMode(false);
        Alert.alert('Success', 'Food item added to the restaurant menu');
      } else {
        // Create a new document if it doesn't exist
        await setDoc(restaurantRef, {
          placeId: placeId,
          name: name,
          address: address,
          location: { lat: Number(latitude), lng: Number(longitude) },
          items: [newItem]
        });
        
        // Update local state
        setMenuItems([newItem]);
        setFilteredMenuItems([newItem]);
        
        // Clear input and show success message
        setSearchQuery('');
        setIsAddingMode(false);
        Alert.alert('Success', 'Food item added to the restaurant menu');
      }
    } catch (error) {
      console.error('Error adding new item:', error);
      Alert.alert('Error', 'Failed to add food item. Please try again.');
    } finally {
      setAddingItem(false);
    }
  };
  
  const selectMenuItem = (item: MenuItem) => {
    router.push({
      pathname: '/(app)/meal-logging',
      params: {
        restaurantId: placeId as string,
        restaurantName: name as string,
        foodName: item.foodName,
        calories: item.calories.toString(),
        protein: item.protein.toString(),
        carbs: item.carbs.toString(),
        fat: item.fat.toString(),
        latitude: latitude as string,
        longitude: longitude as string,
        address: address as string
      }
    });
  };
  
  const goToDirections = () => {
    router.push({
      pathname: '/(app)/restaurant-directions',
      params: {
        placeId: placeId as string,
        name: name as string,
        latitude: latitude as string,
        longitude: longitude as string,
        address: address as string
      }
    });
  };
  
  const renderMenuItem = ({ item }: { item: MenuItem }) => (
    <TouchableOpacity
      style={[styles.menuItem, isDark && styles.menuItemDark]}
      onPress={() => selectMenuItem(item)}
    >
      <View style={styles.menuItemContent}>
        <Text style={[styles.menuItemName, isDark && styles.textLight]}>{item.foodName}</Text>
        <View style={styles.nutritionInfo}>
          <Text style={styles.calorieText}>{Math.round(item.calories)} cal</Text>
          <View style={styles.macroDetails}>
            <Text style={[styles.macroText, isDark && styles.macroTextDark]}>P: {Math.round(item.protein)}g</Text>
            <Text style={[styles.macroText, isDark && styles.macroTextDark]}>C: {Math.round(item.carbs)}g</Text>
            <Text style={[styles.macroText, isDark && styles.macroTextDark]}>F: {Math.round(item.fat)}g</Text>
          </View>
        </View>
      </View>
      <ArrowUpRight size={20} color="#2ecc71" />
    </TouchableOpacity>
  );
  
  const renderMap = () => {
    if (Platform.OS === 'web') {
      return (
        <View style={styles.webMapPlaceholder}>
          <Text style={styles.webMapText}>Map view is not available on web platform</Text>
          <TouchableOpacity
            style={styles.directionsButton}
            onPress={goToDirections}
          >
            <MapPin size={16} color="#fff" />
            <Text style={styles.directionsText}>Get Directions</Text>
          </TouchableOpacity>
        </View>
      );
    }
    
    return (
      <MapView
        style={styles.map}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        initialRegion={{
          latitude: Number(latitude),
          longitude: Number(longitude),
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        }}
        scrollEnabled={false}
        zoomEnabled={false}
      >
        <Marker
          coordinate={{
            latitude: Number(latitude),
            longitude: Number(longitude),
          }}
          title={name as string}
        />
      </MapView>
    );
  };
  
  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
      <View style={[styles.header, isDark && styles.headerDark]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color="#2ecc71" />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, isDark && styles.textLight]} numberOfLines={1}>
          {name}
        </Text>
        <TouchableOpacity
          style={styles.favoriteButton}
          onPress={toggleFavorite}
        >
          <Heart
            size={24}
            color="#FF6B6B"
            fill={isFavorite ? "#FF6B6B" : "transparent"}
          />
        </TouchableOpacity>
      </View>
      
      <View style={[styles.content, isDark && styles.contentDark]}>
        <View style={styles.restaurantDetails}>
          <Text style={[styles.address, isDark && styles.addressDark]}>{address}</Text>
          
          <View style={styles.mapContainer}>
            {renderMap()}
            <TouchableOpacity
              style={styles.directionsButton}
              onPress={goToDirections}
            >
              <MapPin size={16} color="#fff" />
              <Text style={styles.directionsText}>Get Directions</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.menuHeader}>
            <Text style={[styles.menuTitle, isDark && styles.textLight]}>Menu Items</Text>
            <Text style={[styles.menuSubtitle, isDark && styles.menuSubtitleDark]}>
              Select an item to log it as a meal
            </Text>
          </View>
          
          {loading ? (
            <ActivityIndicator size="large" color="#2ecc71" style={styles.loader} />
          ) : errorMsg ? (
            <Text style={styles.errorText}>{errorMsg}</Text>
          ) : (
            <>
              <View style={styles.searchContainer}>
                <View style={[styles.searchInputContainer, isDark && styles.searchInputContainerDark]}>
                  <Search size={18} color={isDark ? "#aaa" : "#888"} style={styles.searchIcon} />
                  <TextInput
                    style={[styles.searchInput, isDark && styles.searchInputDark]}
                    placeholder={isAddingMode ? "Add new menu item..." : "Search menu items..."}
                    placeholderTextColor={isDark ? "#777" : "#aaa"}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    onSubmitEditing={isAddingMode ? addNewItemToRestaurant : undefined}
                  />
                  {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchQuery('')}>
                      <X size={18} color={isDark ? "#aaa" : "#888"} />
                    </TouchableOpacity>
                  )}
                </View>
                <TouchableOpacity
                  style={styles.addButton}
                  onPress={isAddingMode ? addNewItemToRestaurant : () => setIsAddingMode(true)}
                  disabled={isAddingMode && (fetchingNutrition || !searchQuery.trim() || addingItem)}
                >
                  {isAddingMode ? (
                    fetchingNutrition || addingItem ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Plus size={20} color="#fff" />
                    )
                  ) : (
                    <Plus size={20} color="#fff" />
                  )}
                </TouchableOpacity>
              </View>
              
              {isAddingMode && (
                <TouchableOpacity 
                  style={[styles.cancelAddButton, isDark && styles.cancelAddButtonDark]}
                  onPress={() => {
                    setIsAddingMode(false);
                    setSearchQuery('');
                  }}
                >
                  <Text style={[styles.cancelAddText, isDark && styles.cancelAddTextDark]}>Cancel</Text>
                </TouchableOpacity>
              )}
              
              {filteredMenuItems.length > 0 ? (
                <FlatList
                  data={filteredMenuItems}
                  renderItem={renderMenuItem}
                  keyExtractor={(item) => item.id}
                  style={styles.menuList}
                  scrollEnabled={false}
                  ListEmptyComponent={
                    searchQuery.length > 0 ? (
                      <View style={[styles.emptyContainer, isDark && styles.emptyContainerDark]}>
                        <Text style={[styles.emptyText, isDark && styles.emptyTextDark]}>No matching menu items found</Text>
                      </View>
                    ) : null
                  }
                />
              ) : (
                <View style={[styles.emptyContainer, isDark && styles.emptyContainerDark]}>
                  {searchQuery.length > 0 ? (
                    <Text style={[styles.emptyText, isDark && styles.emptyTextDark]}>
                      No matching menu items found
                    </Text>
                  ) : (
                    <Text style={[styles.emptyText, isDark && styles.emptyTextDark]}>
                      No menu items available. Add the first one!
                    </Text>
                  )}
                </View>
              )}
            </>
          )}
        </View>
      </View>
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
    flex: 1,
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2ecc71',
    textAlign: 'center',
    marginHorizontal: 10,
  },
  favoriteButton: {
    padding: 4,
  },
  content: {
    flex: 1,
  },
  contentDark: {
    backgroundColor: '#121212',
  },
  restaurantDetails: {
    padding: 16,
    paddingBottom: 90, // Add extra padding for tab bar
  },
  address: {
    fontSize: 16,
    color: '#555',
    marginBottom: 16,
  },
  addressDark: {
    color: '#aaa',
  },
  mapContainer: {
    height: 180,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 24,
    position: 'relative',
    backgroundColor: '#e1e1e1',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  webMapPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  webMapText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    textAlign: 'center',
  },
  directionsButton: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2ecc71',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  directionsText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 4,
  },
  menuHeader: {
    marginBottom: 16,
  },
  menuTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  menuSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  menuSubtitleDark: {
    color: '#aaa',
  },
  searchContainer: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'center',
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    height: 44,
  },
  searchInputContainerDark: {
    backgroundColor: '#252525',
    borderColor: '#444',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    fontSize: 16,
    color: '#333',
  },
  searchInputDark: {
    color: '#f2f2f2',
  },
  addButton: {
    width: 44,
    height: 44,
    backgroundColor: '#2ecc71',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelAddButton: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  cancelAddButtonDark: {
    backgroundColor: '#2a2a2a',
  },
  cancelAddText: {
    color: '#666',
    fontWeight: 'bold',
  },
  cancelAddTextDark: {
    color: '#aaa',
  },
  menuList: {
    marginBottom: 16,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  menuItemDark: {
    backgroundColor: '#1e1e1e',
    shadowColor: '#000',
  },
  menuItemContent: {
    flex: 1,
  },
  menuItemName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  nutritionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  calorieText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2ecc71',
  },
  macroDetails: {
    flexDirection: 'row',
  },
  macroText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 8,
  },
  macroTextDark: {
    color: '#aaa',
  },
  emptyContainer: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 24,
    alignItems: 'center',
    marginTop: 8,
  },
  emptyContainerDark: {
    backgroundColor: '#1e1e1e',
  },
  emptyText: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
  },
  emptyTextDark: {
    color: '#aaa',
  },
  loader: {
    marginVertical: 24,
  },
  errorText: {
    color: '#ff6b6b',
    textAlign: 'center',
    marginVertical: 24,
  },
});

export default RestaurantDetailsScreen;