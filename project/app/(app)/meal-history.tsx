// Meal History Screen (app/(app)/meal-history.tsx)
import React, { useState, useEffect, useRef, useContext } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  FlatList, 
  Alert, 
  ActivityIndicator, 
  Modal, 
  TextInput,
  Platform,
  ScrollView
} from 'react-native';
import { router } from 'expo-router';
import { auth, db } from '../../firebaseConfig';
import { collection, query, where, orderBy, getDocs, deleteDoc, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { ArrowLeft, Trash2, CreditCard as Edit, X, Calendar, Filter, ChartBar as BarChart3, Map as MapIcon, List, ChevronDown } from 'lucide-react-native';
import { ThemeContext } from '../../context/ThemeContext';

// Conditionally import MapView components
let MapView: any;
let Marker: any;
let Callout: any;
let PROVIDER_GOOGLE: any;

// Only import map components on native platforms
if (Platform.OS !== 'web') {
  try {
    const ReactNativeMaps = require('react-native-maps');
    MapView = ReactNativeMaps.default;
    Marker = ReactNativeMaps.Marker;
    Callout = ReactNativeMaps.Callout;
    PROVIDER_GOOGLE = ReactNativeMaps.PROVIDER_GOOGLE;
  } catch (error) {
    console.error('Failed to load react-native-maps:', error);
  }
}

interface MealLog {
  id: string;
  foodName: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  date: Date;
  mealType?: string;
  location?: {
    name: string;
    type: string;
    address?: string;
    placeId?: string;
    coordinates?: {
      lat: number;
      lng: number;
    };
  };
}

interface FilterOptions {
  dateRange: 'all' | 'today' | 'week' | 'month';
  mealType: string | null;
  locationFilter: 'all' | 'restaurant' | 'custom';
}

const MealHistoryScreen: React.FC = () => {
  const { theme } = useContext(ThemeContext);
  const isDark = theme === 'dark';

  const [mealHistory, setMealHistory] = useState<MealLog[]>([]);
  const [filteredMeals, setFilteredMeals] = useState<MealLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [editModalVisible, setEditModalVisible] = useState<boolean>(false);
  const [editMealId, setEditMealId] = useState<string | null>(null);
  const [editedFoodName, setEditedFoodName] = useState<string>('');
  const [editedCalories, setEditedCalories] = useState<string>('');
  const [editedProtein, setEditedProtein] = useState<string>('');
  const [editedCarbs, setEditedCarbs] = useState<string>('');
  const [editedFat, setEditedFat] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [filterModalVisible, setFilterModalVisible] = useState<boolean>(false);
  const [filters, setFilters] = useState<FilterOptions>({
    dateRange: 'all',
    mealType: null,
    locationFilter: 'all'
  });
  const [selectedTab, setSelectedTab] = useState<'list' | 'map'>('list');
  const [mapRegion, setMapRegion] = useState<any>(null);
  const mapRef = useRef<any>(null);

  useEffect(() => {
    fetchMealHistory();
  }, []);

  useEffect(() => {
    if (mealHistory.length > 0) {
      applyFilters();
      
      // Set map region based on meal locations
      if (Platform.OS !== 'web' && MapView && !mapRegion) {
        const locationsWithCoordinates = mealHistory.filter(
          meal => meal.location?.coordinates?.lat && meal.location?.coordinates?.lng
        );
        
        if (locationsWithCoordinates.length > 0) {
          // Use the first location with coordinates as center
          const firstLocation = locationsWithCoordinates[0];
          setMapRegion({
            latitude: firstLocation.location!.coordinates!.lat,
            longitude: firstLocation.location!.coordinates!.lng,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          });
        }
      }
    }
  }, [mealHistory, filters]);

  const fetchMealHistory = async () => {
    if (!auth.currentUser) {
      setLoading(false);
      setError('You must be logged in to view meal history');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Create a base query for the user's meal logs
      let mealsQuery = query(
        collection(db, 'mealLogs'),
        where('userId', '==', auth.currentUser.uid),
        orderBy('date', 'desc')
      );

      const snapshot = await getDocs(mealsQuery);
      
      const meals: MealLog[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        // Convert Firestore timestamp to JS Date
        const mealDate = data.date?.toDate ? data.date.toDate() : new Date(data.date);

        const meal: MealLog = {
          id: doc.id,
          foodName: data.foodName || '',
          calories: data.calories || 0,
          protein: data.protein || 0,
          carbs: data.carbs || 0,
          fat: data.fat || 0,
          date: mealDate,
          mealType: data.mealType || null,
          location: data.location || { name: 'Custom meal', type: 'custom' }
        };
        
        meals.push(meal);
      });
      
      setMealHistory(meals);
      setFilteredMeals(meals);
    } catch (error) {
      console.error('Error fetching meal history:', error);
      setError('Failed to fetch meal history. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...mealHistory];
    
    // Apply date range filter
    if (filters.dateRange !== 'all') {
      const now = new Date();
      let startDate: Date;

      if (filters.dateRange === 'today') {
        // Start of today
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      } else if (filters.dateRange === 'week') {
        // Start of the week (7 days ago)
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 7);
      } else if (filters.dateRange === 'month') {
        // Start of the month (30 days ago)
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 30);
      }

      filtered = filtered.filter(meal => meal.date >= startDate);
    }
    
    // Apply meal type filter
    if (filters.mealType) {
      filtered = filtered.filter(meal => meal.mealType === filters.mealType);
    }
    
    // Apply location filter
    if (filters.locationFilter !== 'all') {
      filtered = filtered.filter(meal => 
        filters.locationFilter === 'restaurant' ? 
          meal.location?.type === 'restaurant' : 
          meal.location?.type === 'custom'
      );
    }
    
    setFilteredMeals(filtered);
  };

  const handleDeleteMeal = async (mealId: string) => {
    Alert.alert(
      'Confirm Delete',
      'Are you sure you want to delete this meal?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              await deleteDoc(doc(db, 'mealLogs', mealId));
              // Update state after deletion
              setMealHistory(mealHistory.filter(meal => meal.id !== mealId));
              Alert.alert('Success', 'Meal deleted successfully');
            } catch (error) {
              console.error('Error deleting meal:', error);
              Alert.alert('Error', 'Failed to delete meal. Please try again.');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleEditMeal = (meal: MealLog) => {
    setEditMealId(meal.id);
    setEditedFoodName(meal.foodName);
    setEditedCalories(meal.calories.toString());
    setEditedProtein(meal.protein.toString());
    setEditedCarbs(meal.carbs.toString());
    setEditedFat(meal.fat.toString());
    setEditModalVisible(true);
  };

  const saveEditedMeal = async () => {
    if (!editMealId) return;
    
    if (!editedFoodName.trim()) {
      Alert.alert('Error', 'Please enter a food name');
      return;
    }

    if (isNaN(Number(editedCalories)) || Number(editedCalories) <= 0) {
      Alert.alert('Error', 'Please enter valid calories');
      return;
    }

    try {
      setLoading(true);
      
      await updateDoc(doc(db, 'mealLogs', editMealId), {
        foodName: editedFoodName,
        calories: Number(editedCalories),
        protein: Number(editedProtein) || 0,
        carbs: Number(editedCarbs) || 0,
        fat: Number(editedFat) || 0,
      });

      // Update state after edit
      setMealHistory(mealHistory.map(meal => 
        meal.id === editMealId ? {
          ...meal,
          foodName: editedFoodName,
          calories: Number(editedCalories),
          protein: Number(editedProtein) || 0,
          carbs: Number(editedCarbs) || 0,
          fat: Number(editedFat) || 0,
        } : meal
      ));

      setEditModalVisible(false);
      Alert.alert('Success', 'Meal updated successfully');
    } catch (error) {
      console.error('Error updating meal:', error);
      Alert.alert('Error', 'Failed to update meal. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const navigateToAnalytics = () => {
    router.push('/(app)/dining-analytics');
  };

  const renderMealItem = ({ item }: { item: MealLog }) => (
    <View style={[styles.mealItem, isDark && styles.mealItemDark]}>
      <View style={styles.mealHeader}>
        <Text style={[styles.foodName, isDark && styles.textLight]}>{item.foodName}</Text>
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleEditMeal(item)}
          >
            <Edit size={18} color="#2ecc71" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleDeleteMeal(item.id)}
          >
            <Trash2 size={18} color="#ff6b6b" />
          </TouchableOpacity>
        </View>
      </View>
      
      <Text style={[styles.dateText, isDark && styles.dateTextDark]}>{formatDate(item.date)}</Text>
      
      {item.mealType && (
        <View style={styles.mealTypeContainer}>
          <Text style={styles.mealTypeText}>
            {item.mealType.charAt(0).toUpperCase() + item.mealType.slice(1)}
          </Text>
        </View>
      )}
      
      <View style={styles.locationContainer}>
        <Text style={[styles.locationText, isDark && styles.locationTextDark]}>
          {item.location?.type === 'restaurant' ? '🍽️ ' : '🏠 '}
          {item.location?.name || 'Custom meal'}
          {item.location?.address ? ` · ${item.location.address}` : ''}
        </Text>
      </View>
      
      <View style={styles.nutritionInfo}>
        <View style={styles.nutritionItem}>
          <Text style={styles.nutritionValue}>{Math.round(item.calories)}</Text>
          <Text style={[styles.nutritionLabel, isDark && styles.nutritionLabelDark]}>Calories</Text>
        </View>
        <View style={styles.macroContainer}>
          <View style={styles.nutritionItem}>
            <Text style={styles.nutritionValue}>{Math.round(item.protein)}g</Text>
            <Text style={[styles.nutritionLabel, isDark && styles.nutritionLabelDark]}>Protein</Text>
          </View>
          <View style={styles.nutritionItem}>
            <Text style={styles.nutritionValue}>{Math.round(item.carbs)}g</Text>
            <Text style={[styles.nutritionLabel, isDark && styles.nutritionLabelDark]}>Carbs</Text>
          </View>
          <View style={styles.nutritionItem}>
            <Text style={styles.nutritionValue}>{Math.round(item.fat)}g</Text>
            <Text style={[styles.nutritionLabel, isDark && styles.nutritionLabelDark]}>Fat</Text>
          </View>
        </View>
      </View>
    </View>
  );

  const renderFilters = () => (
    <Modal
      visible={filterModalVisible}
      transparent={true}
      animationType="slide"
      onRequestClose={() => setFilterModalVisible(false)}
    >
      <View style={styles.filterModalOverlay}>
        <View style={[styles.filterModalContent, isDark && styles.filterModalContentDark]}>
          <View style={[styles.filterModalHeader, isDark && styles.filterModalHeaderDark]}>
            <Text style={[styles.filterModalTitle, isDark && styles.textLight]}>Filter Meals</Text>
            <TouchableOpacity
              onPress={() => setFilterModalVisible(false)}
            >
              <X size={24} color={isDark ? "#aaa" : "#666"} />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.filterModalBody}>
            <Text style={[styles.filterSectionTitle, isDark && styles.textLight]}>Date Range</Text>
            <View style={styles.filterOptionsContainer}>
              {['all', 'today', 'week', 'month'].map((option) => (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.filterOption,
                    filters.dateRange === option && styles.filterOptionSelected,
                    isDark && styles.filterOptionDark,
                    filters.dateRange === option && isDark && styles.filterOptionSelectedDark
                  ]}
                  onPress={() => setFilters({...filters, dateRange: option as any})}
                >
                  <Text 
                    style={[
                      styles.filterOptionText,
                      filters.dateRange === option && styles.filterOptionTextSelected,
                      isDark && styles.filterOptionTextDark,
                      filters.dateRange === option && isDark && styles.filterOptionTextSelectedDark
                    ]}
                  >
                    {option === 'all' ? 'All Time' : 
                      option === 'today' ? 'Today' : 
                      option === 'week' ? 'This Week' : 'This Month'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            
            <Text style={[styles.filterSectionTitle, isDark && styles.textLight]}>Meal Type</Text>
            <View style={styles.filterOptionsContainer}>
              <TouchableOpacity
                style={[
                  styles.filterOption,
                  filters.mealType === null && styles.filterOptionSelected,
                  isDark && styles.filterOptionDark,
                  filters.mealType === null && isDark && styles.filterOptionSelectedDark
                ]}
                onPress={() => setFilters({...filters, mealType: null})}
              >
                <Text 
                  style={[
                    styles.filterOptionText,
                    filters.mealType === null && styles.filterOptionTextSelected,
                    isDark && styles.filterOptionTextDark,
                    filters.mealType === null && isDark && styles.filterOptionTextSelectedDark
                  ]}
                >
                  All Meals
                </Text>
              </TouchableOpacity>
              {['breakfast', 'lunch', 'dinner', 'snack'].map((option) => (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.filterOption,
                    filters.mealType === option && styles.filterOptionSelected,
                    isDark && styles.filterOptionDark,
                    filters.mealType === option && isDark && styles.filterOptionSelectedDark
                  ]}
                  onPress={() => setFilters({...filters, mealType: option})}
                >
                  <Text 
                    style={[
                      styles.filterOptionText,
                      filters.mealType === option && styles.filterOptionTextSelected,
                      isDark && styles.filterOptionTextDark,
                      filters.mealType === option && isDark && styles.filterOptionTextSelectedDark
                    ]}
                  >
                    {option.charAt(0).toUpperCase() + option.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            
            <Text style={[styles.filterSectionTitle, isDark && styles.textLight]}>Location</Text>
            <View style={styles.filterOptionsContainer}>
              {['all', 'restaurant', 'custom'].map((option) => (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.filterOption,
                    filters.locationFilter === option && styles.filterOptionSelected,
                    isDark && styles.filterOptionDark,
                    filters.locationFilter === option && isDark && styles.filterOptionSelectedDark
                  ]}
                  onPress={() => setFilters({...filters, locationFilter: option as any})}
                >
                  <Text 
                    style={[
                      styles.filterOptionText,
                      filters.locationFilter === option && styles.filterOptionTextSelected,
                      isDark && styles.filterOptionTextDark,
                      filters.locationFilter === option && isDark && styles.filterOptionTextSelectedDark
                    ]}
                  >
                    {option === 'all' ? 'All Locations' : 
                      option === 'restaurant' ? 'Restaurants Only' : 'Home/Custom Only'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
          
          <View style={[styles.filterModalFooter, isDark && styles.filterModalFooterDark]}>
            <TouchableOpacity 
              style={[styles.resetButton, isDark && styles.resetButtonDark]}
              onPress={() => {
                setFilters({
                  dateRange: 'all',
                  mealType: null,
                  locationFilter: 'all'
                });
              }}
            >
              <Text style={[styles.resetButtonText, isDark && styles.resetButtonTextDark]}>Reset Filters</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.applyButton}
              onPress={() => {
                applyFilters();
                setFilterModalVisible(false);
              }}
            >
              <Text style={styles.applyButtonText}>Apply Filters</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  const renderMapView = () => {
    if (Platform.OS === 'web') {
      return (
        <View style={styles.webMapPlaceholder}>
          <Text style={styles.webMapText}>Map view is not available on web platform</Text>
          <Text style={styles.webMapSubtext}>Please use the mobile app for full map functionality</Text>
        </View>
      );
    }
    
    if (!mapRegion || !MapView) {
      return (
        <View style={[styles.loadingContainer, isDark && styles.loadingContainerDark]}>
          <ActivityIndicator size="large" color="#2ecc71" />
          <Text style={[styles.loadingText, isDark && styles.textLight]}>Loading map...</Text>
        </View>
      );
    }
    
    // Filter for meals with location data
    const mealsWithLocation = filteredMeals.filter(
      meal => meal.location?.coordinates?.lat && meal.location?.coordinates?.lng
    );
    
    if (mealsWithLocation.length === 0) {
      return (
        <View style={[styles.emptyContainer, isDark && styles.emptyContainerDark]}>
          <Text style={[styles.emptyText, isDark && styles.textLight]}>No meals with location data found</Text>
        </View>
      );
    }
    
    return (
      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={mapRegion}
          provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        >
          {mealsWithLocation.map((meal) => (
            <Marker
              key={meal.id}
              coordinate={{
                latitude: meal.location.coordinates.lat,
                longitude: meal.location.coordinates.lng,
              }}
              title={meal.foodName}
              description={`${meal.calories} calories - ${formatDate(meal.date)}`}
              pinColor={meal.location.type === 'restaurant' ? '#ff6b6b' : '#2ecc71'}
            >
              <Callout>
                <View style={styles.calloutContainer}>
                  <Text style={styles.calloutTitle}>{meal.foodName}</Text>
                  <Text style={styles.calloutSubtitle}>{meal.location.name}</Text>
                  <Text style={styles.calloutDetail}>{formatDate(meal.date)}</Text>
                  <Text style={styles.calloutDetail}>{meal.calories} calories</Text>
                </View>
              </Callout>
            </Marker>
          ))}
        </MapView>
        
        <View style={[styles.mapLegend, isDark && styles.mapLegendDark]}>
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: '#ff6b6b' }]} />
            <Text style={[styles.legendText, isDark && styles.legendTextDark]}>Restaurant Meals</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: '#2ecc71' }]} />
            <Text style={[styles.legendText, isDark && styles.legendTextDark]}>Home/Custom Meals</Text>
          </View>
        </View>
      </View>
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
        <Text style={[styles.headerTitle, isDark && styles.textLight]}>Meal History</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.analyticsButton}
            onPress={navigateToAnalytics}
          >
            <BarChart3 size={20} color="#2ecc71" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.filterButton}
            onPress={() => setFilterModalVisible(true)}
          >
            <Filter size={20} color="#2ecc71" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.tabBar, isDark && styles.tabBarDark]}>
        <TouchableOpacity
          style={[
            styles.tab, 
            selectedTab === 'list' && styles.selectedTab,
            isDark && selectedTab === 'list' && styles.selectedTabDark
          ]}
          onPress={() => setSelectedTab('list')}
        >
          <List size={20} color={selectedTab === 'list' ? '#2ecc71' : isDark ? '#aaa' : '#888'} />
          <Text 
            style={[
              styles.tabText, 
              selectedTab === 'list' && styles.selectedTabText,
              isDark && styles.tabTextDark,
              selectedTab === 'list' && isDark && styles.selectedTabTextDark
            ]}
          >
            List View
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tab, 
            selectedTab === 'map' && styles.selectedTab,
            isDark && selectedTab === 'map' && styles.selectedTabDark
          ]}
          onPress={() => setSelectedTab('map')}
        >
          <MapIcon size={20} color={selectedTab === 'map' ? '#2ecc71' : isDark ? '#aaa' : '#888'} />
          <Text 
            style={[
              styles.tabText, 
              selectedTab === 'map' && styles.selectedTabText,
              isDark && styles.tabTextDark,
              selectedTab === 'map' && isDark && styles.selectedTabTextDark
            ]}
          >
            Map View
          </Text>
        </TouchableOpacity>
      </View>
      
      {loading ? (
        <View style={[styles.loadingContainer, isDark && styles.loadingContainerDark]}>
          <ActivityIndicator size="large" color="#2ecc71" />
          <Text style={[styles.loadingText, isDark && styles.textLight]}>Loading meals...</Text>
        </View>
      ) : error ? (
        <View style={[styles.errorContainer, isDark && styles.errorContainerDark]}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={fetchMealHistory}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        selectedTab === 'list' ? (
          filteredMeals.length === 0 ? (
            <View style={[styles.emptyContainer, isDark && styles.emptyContainerDark]}>
              <Text style={[styles.emptyText, isDark && styles.textLight]}>No meals found</Text>
              <TouchableOpacity
                style={styles.addMealButton}
                onPress={() => router.push('/(app)/meal-logging')}
              >
                <Text style={styles.addMealButtonText}>Add a Meal</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={filteredMeals}
              renderItem={renderMealItem}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContainer}
            />
          )
        ) : (
          renderMapView()
        )
      )}

      {renderFilters()}

      <Modal
        visible={editModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={[styles.modalContent, isDark && styles.modalContentDark]}>
            <View style={[styles.modalHeader, isDark && styles.modalHeaderDark]}>
              <Text style={[styles.modalTitle, isDark && styles.modalTitleDark]}>Edit Meal</Text>
              <TouchableOpacity
                onPress={() => setEditModalVisible(false)}
                style={styles.closeButton}
              >
                <X size={24} color={isDark ? "#aaa" : "#666"} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={[styles.label, isDark && styles.labelDark]}>Food Name</Text>
              <TextInput
                style={[styles.input, isDark && styles.inputDark]}
                value={editedFoodName}
                onChangeText={setEditedFoodName}
                placeholder="e.g., Grilled Chicken Salad"
                placeholderTextColor={isDark ? "#777" : undefined}
              />
            </View>
            
            <View style={styles.macroRow}>
              <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                <Text style={[styles.label, isDark && styles.labelDark]}>Calories</Text>
                <TextInput
                  style={[styles.input, isDark && styles.inputDark]}
                  value={editedCalories}
                  onChangeText={setEditedCalories}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={isDark ? "#777" : undefined}
                />
              </View>
              
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={[styles.label, isDark && styles.labelDark]}>Protein (g)</Text>
                <TextInput
                  style={[styles.input, isDark && styles.inputDark]}
                  value={editedProtein}
                  onChangeText={setEditedProtein}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={isDark ? "#777" : undefined}
                />
              </View>
            </View>
            
            <View style={styles.macroRow}>
              <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                <Text style={[styles.label, isDark && styles.labelDark]}>Carbs (g)</Text>
                <TextInput
                  style={[styles.input, isDark && styles.inputDark]}
                  value={editedCarbs}
                  onChangeText={setEditedCarbs}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={isDark ? "#777" : undefined}
                />
              </View>
              
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={[styles.label, isDark && styles.labelDark]}>Fat (g)</Text>
                <TextInput
                  style={[styles.input, isDark && styles.inputDark]}
                  value={editedFat}
                  onChangeText={setEditedFat}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={isDark ? "#777" : undefined}
                />
              </View>
            </View>
            
            <TouchableOpacity
              style={styles.saveButton}
              onPress={saveEditedMeal}
            >
              <Text style={styles.saveButtonText}>Save Changes</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  headerActions: {
    flexDirection: 'row',
  },
  analyticsButton: {
    padding: 8,
    marginRight: 8,
  },
  filterButton: {
    padding: 8,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  tabBarDark: {
    backgroundColor: '#1e1e1e',
    borderBottomColor: '#2a2a2a',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  selectedTab: {
    borderBottomColor: '#2ecc71',
  },
  selectedTabDark: {
    borderBottomColor: '#2ecc71',
  },
  tabText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#888',
  },
  tabTextDark: {
    color: '#aaa',
  },
  selectedTabText: {
    fontWeight: 'bold',
    color: '#2ecc71',
  },
  selectedTabTextDark: {
    color: '#2ecc71',
  },
  listContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  mealItem: {
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
  mealItemDark: {
    backgroundColor: '#1e1e1e',
    shadowColor: '#000',
  },
  mealHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  foodName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
    marginRight: 8,
  },
  dateText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  dateTextDark: {
    color: '#aaa',
  },
  mealTypeContainer: {
    marginBottom: 8,
  },
  mealTypeText: {
    color: '#2ecc71',
    fontWeight: 'bold',
    fontSize: 14,
  },
  locationContainer: {
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  locationText: {
    fontSize: 14,
    color: '#666',
  },
  locationTextDark: {
    color: '#aaa',
    borderBottomColor: '#2a2a2a',
  },
  nutritionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  nutritionItem: {
    alignItems: 'center',
  },
  nutritionValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2ecc71',
  },
  nutritionLabel: {
    fontSize: 12,
    color: '#666',
  },
  nutritionLabelDark: {
    color: '#aaa',
  },
  macroContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '60%',
  },
  actionButtons: {
    flexDirection: 'row',
  },
  actionButton: {
    padding: 8,
    marginLeft: 4,
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
    padding: 20,
  },
  emptyContainerDark: {
    backgroundColor: '#121212',
  },
  emptyText: {
    color: '#666',
    marginBottom: 16,
    fontSize: 16,
  },
  addMealButton: {
    backgroundColor: '#2ecc71',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  addMealButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  modalContentDark: {
    backgroundColor: '#1e1e1e',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  modalHeaderDark: {
    borderBottomColor: '#2a2a2a',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2ecc71',
  },
  modalTitleDark: {
    color: '#2ecc71',
  },
  closeButton: {
    padding: 4,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#555',
    marginBottom: 8,
  },
  labelDark: {
    color: '#f2f2f2',
  },
  input: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#eee',
  },
  inputDark: {
    backgroundColor: '#2a2a2a',
    borderColor: '#333',
    color: '#f2f2f2',
  },
  macroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  saveButton: {
    backgroundColor: '#2ecc71',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  saveButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  filterModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  filterModalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '70%',
  },
  filterModalContentDark: {
    backgroundColor: '#1e1e1e',
  },
  filterModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  filterModalHeaderDark: {
    borderBottomColor: '#2a2a2a',
  },
  filterModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  filterModalBody: {
    padding: 20,
  },
  filterSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  filterOptionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
  },
  filterOption: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ddd',
    marginRight: 8,
    marginBottom: 8,
  },
  filterOptionDark: {
    borderColor: '#444',
  },
  filterOptionSelected: {
    backgroundColor: '#2ecc71',
    borderColor: '#2ecc71',
  },
  filterOptionSelectedDark: {
    backgroundColor: '#2ecc71',
    borderColor: '#2ecc71',
  },
  filterOptionText: {
    fontSize: 14,
    color: '#666',
  },
  filterOptionTextDark: {
    color: '#aaa',
  },
  filterOptionTextSelected: {
    color: 'white',
    fontWeight: 'bold',
  },
  filterOptionTextSelectedDark: {
    color: 'white',
    fontWeight: 'bold',
  },
  filterModalFooter: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  filterModalFooterDark: {
    borderTopColor: '#2a2a2a',
  },
  resetButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    marginRight: 8,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  resetButtonDark: {
    backgroundColor: '#2a2a2a',
  },
  resetButtonText: {
    color: '#666',
    fontWeight: 'bold',
  },
  resetButtonTextDark: {
    color: '#aaa',
  },
  applyButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#2ecc71',
    borderRadius: 8,
  },
  applyButtonText: {
    color: 'white',
    fontWeight: 'bold',
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
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  webMapText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#666',
    marginBottom: 8,
    textAlign: 'center',
  },
  webMapSubtext: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
  },
  calloutContainer: {
    padding: 8,
    width: 150,
  },
  calloutTitle: {
    fontWeight: 'bold',
    fontSize: 14,
    marginBottom: 4,
  },
  calloutSubtitle: {
    color: '#666',
    fontSize: 12,
    marginBottom: 4,
  },
  calloutDetail: {
    color: '#888',
    fontSize: 12,
  },
  mapLegend: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    backgroundColor: 'white',
    padding: 10,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  mapLegendDark: {
    backgroundColor: '#1e1e1e',
    shadowColor: '#000',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  legendColor: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: 8,
  },
  legendText: {
    fontSize: 12,
    color: '#666',
  },
  legendTextDark: {
    color: '#aaa',
  },
});

export default MealHistoryScreen;