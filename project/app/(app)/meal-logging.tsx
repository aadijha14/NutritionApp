// Meal Logging Screen (app/(app)/meal-logging.tsx)
import React, { useState, useEffect, useContext } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator, Switch, Platform } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { auth, db } from '../../firebaseConfig';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ArrowLeft, Save, Calendar } from 'lucide-react-native';
import { ThemeContext } from '../../context/ThemeContext';

// For web platform compatibility, provide a DateTimePicker alternative
const DateTimePickerWeb = ({ value, onChange, mode }: any) => {
  const { theme } = useContext(ThemeContext);
  const isDark = theme === 'dark';

  return (
    <View style={styles.webDatePicker}>
      <TextInput
        value={value.toLocaleString()}
        editable={false}
        style={[styles.webDatePickerInput, isDark && styles.webDatePickerInputDark]}
      />
      <TouchableOpacity
        style={[styles.webDatePickerButton, isDark && styles.webDatePickerButtonDark]}
        onPress={() => {
          // Increment by 30 minutes as a simple alternative
          const newDate = new Date(value.getTime());
          newDate.setMinutes(newDate.getMinutes() + 30);
          onChange({ type: 'set', nativeEvent: { timestamp: newDate.getTime() } }, newDate);
        }}
      >
        <Text style={styles.webDatePickerButtonText}>+30 min</Text>
      </TouchableOpacity>
    </View>
  );
};

interface NutritionData {
  food_name?: string;
  nf_calories: number;
  nf_total_fat: number;
  nf_total_carbohydrate: number;
  nf_protein: number;
}

const MealLoggingScreen: React.FC = () => {
  const params = useLocalSearchParams();
  const { theme } = useContext(ThemeContext);
  const isDark = theme === 'dark';
  
  // Initialize states with params or defaults
  const [foodName, setFoodName] = useState(params.foodName as string || '');
  const [calories, setCalories] = useState(params.calories as string || '0');
  const [protein, setProtein] = useState(params.protein as string || '0');
  const [carbs, setCarbs] = useState(params.carbs as string || '0');
  const [fat, setFat] = useState(params.fat as string || '0');
  const [mealDate, setMealDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isCustomLocation, setIsCustomLocation] = useState(params.restaurantId ? false : true);
  const [customLocation, setCustomLocation] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchingNutrition, setFetchingNutrition] = useState(false);
  const [mealType, setMealType] = useState(params.mealType as string || '');
  
  const restaurantId = params.restaurantId as string;
  const restaurantName = params.restaurantName as string;
  const restaurantLat = params.latitude ? parseFloat(params.latitude as string) : null;
  const restaurantLng = params.longitude ? parseFloat(params.longitude as string) : null;
  const restaurantAddress = params.address as string;
  
  // Lazy-load the DateTimePicker component only on native platforms
  let DateTimePicker: any;
  if (Platform.OS !== 'web') {
    try {
      // Dynamic import of native components
      DateTimePicker = require('@react-native-community/datetimepicker').default;
    } catch (error) {
      console.error('Failed to load DateTimePicker:', error);
    }
  }
  
  // Fetch nutrition data when food name changes (if not from a restaurant)
  useEffect(() => {
    if (!restaurantId && foodName.trim().length > 2) {
      const debounceTimer = setTimeout(() => {
        fetchNutritionData(foodName);
      }, 1000);
      
      return () => clearTimeout(debounceTimer);
    }
  }, [foodName, restaurantId]);
  
  const fetchNutritionData = async (query: string) => {
    if (!query.trim()) return;
    
    setFetchingNutrition(true);
    
    try {
      const response = await fetch('https://trackapi.nutritionix.com/v2/natural/nutrients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-app-id': 'a712f1f5',
          'x-app-key': '93d5ae72f7914659738752a846c039ab',
        },
        body: JSON.stringify({ query }),
      });
      
      const data = await response.json();
      
      if (data.foods && data.foods.length > 0) {
        const food = data.foods[0];
        setCalories(Math.round(food.nf_calories || 0).toString());
        setFat(Math.round(food.nf_total_fat || 0).toString());
        setCarbs(Math.round(food.nf_total_carbohydrate || 0).toString());
        setProtein(Math.round(food.nf_protein || 0).toString());
      }
    } catch (error) {
      console.error('Error fetching nutrition data:', error);
      Alert.alert('Error', 'Failed to fetch nutrition data');
    } finally {
      setFetchingNutrition(false);
    }
  };
  
  const handleDateChange = (event: any, selectedDate?: Date) => {
    const currentDate = selectedDate || mealDate;
    setShowDatePicker(Platform.OS === 'ios');
    setMealDate(currentDate);
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
  
  const validateForm = (): boolean => {
    if (!foodName.trim()) {
      Alert.alert('Error', 'Please enter a food name');
      return false;
    }
    
    if (isNaN(Number(calories)) || Number(calories) <= 0) {
      Alert.alert('Error', 'Please enter valid calories');
      return false;
    }
    
    if (isCustomLocation && !customLocation.trim()) {
      Alert.alert('Error', 'Please enter a location');
      return false;
    }
    
    if (!auth.currentUser) {
      Alert.alert('Error', 'You must be logged in to log meals');
      return false;
    }
    
    return true;
  };
  
  const handleSaveMeal = async () => {
    if (!validateForm()) return;
    
    setLoading(true);
    
    try {
      const userId = auth.currentUser!.uid;
      
      // Prepare location data
      let locationData = null;
      
      if (isCustomLocation) {
        locationData = {
          name: customLocation,
          type: 'custom'
        };
      } else {
        locationData = {
          name: restaurantName,
          address: restaurantAddress,
          placeId: restaurantId,
          coordinates: { lat: restaurantLat, lng: restaurantLng },
          type: 'restaurant'
        };
      }
      
      // Create meal log document
      await addDoc(collection(db, 'mealLogs'), {
        userId,
        foodName,
        calories: Number(calories),
        protein: Number(protein),
        carbs: Number(carbs),
        fat: Number(fat),
        date: mealDate,
        createdAt: serverTimestamp(),
        location: locationData,
        mealType: mealType || null
      });
      
      Alert.alert(
        'Success',
        'Meal logged successfully',
        [{ text: 'OK', onPress: () => router.push('/(app)/dashboard') }]
      );
    } catch (error) {
      console.error('Error logging meal:', error);
      Alert.alert('Error', 'Failed to log meal. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  const renderDatePicker = () => {
    if (Platform.OS === 'web') {
      return showDatePicker && <DateTimePickerWeb 
        value={mealDate}
        onChange={handleDateChange}
        mode="datetime"
      />;
    }
    
    return showDatePicker && DateTimePicker && (
      <DateTimePicker
        value={mealDate}
        mode="datetime"
        display="default"
        onChange={handleDateChange}
      />
    );
  };

  const renderMealTypeSelector = () => (
    <View style={styles.inputGroup}>
      <Text style={[styles.label, isDark && styles.labelDark]}>Meal Type</Text>
      <View style={styles.mealTypeContainer}>
        <TouchableOpacity 
          style={[styles.mealTypeButton, mealType === 'breakfast' && styles.mealTypeButtonSelected, isDark && styles.mealTypeButtonDark]}
          onPress={() => setMealType('breakfast')}
        >
          <Text style={[
            styles.mealTypeButtonText, 
            mealType === 'breakfast' && styles.mealTypeButtonTextSelected,
            isDark && styles.mealTypeButtonTextDark
          ]}>
            Breakfast
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.mealTypeButton, mealType === 'lunch' && styles.mealTypeButtonSelected, isDark && styles.mealTypeButtonDark]}
          onPress={() => setMealType('lunch')}
        >
          <Text style={[
            styles.mealTypeButtonText, 
            mealType === 'lunch' && styles.mealTypeButtonTextSelected,
            isDark && styles.mealTypeButtonTextDark
          ]}>
            Lunch
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.mealTypeButton, mealType === 'dinner' && styles.mealTypeButtonSelected, isDark && styles.mealTypeButtonDark]}
          onPress={() => setMealType('dinner')}
        >
          <Text style={[
            styles.mealTypeButtonText, 
            mealType === 'dinner' && styles.mealTypeButtonTextSelected,
            isDark && styles.mealTypeButtonTextDark
          ]}>
            Dinner
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.mealTypeButton, mealType === 'snack' && styles.mealTypeButtonSelected, isDark && styles.mealTypeButtonDark]}
          onPress={() => setMealType('snack')}
        >
          <Text style={[
            styles.mealTypeButtonText, 
            mealType === 'snack' && styles.mealTypeButtonTextSelected,
            isDark && styles.mealTypeButtonTextDark
          ]}>
            Snack
          </Text>
        </TouchableOpacity>
      </View>
    </View>
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
        <Text style={styles.headerTitle}>Log a Meal</Text>
        <TouchableOpacity
          style={styles.saveButton}
          onPress={handleSaveMeal}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Save size={24} color="#2ecc71" />
          )}
        </TouchableOpacity>
      </View>
      
      <ScrollView style={styles.content} contentContainerStyle={[styles.contentContainer, isDark && styles.contentContainerDark]}>
        <View style={[styles.formSection, isDark && styles.formSectionDark]}>
          <Text style={[styles.sectionTitle, isDark && styles.textLight]}>Food Details</Text>
          
          {renderMealTypeSelector()}
          
          <View style={styles.inputGroup}>
            <Text style={[styles.label, isDark && styles.labelDark]}>Food Name</Text>
            <TextInput
              style={[styles.input, isDark && styles.inputDark]}
              value={foodName}
              onChangeText={setFoodName}
              placeholder="e.g., Grilled Chicken Salad"
              placeholderTextColor={isDark ? "#777" : "#aaa"}
            />
            {fetchingNutrition && (
              <ActivityIndicator 
                size="small" 
                color="#2ecc71" 
                style={styles.nutritionLoader} 
              />
            )}
          </View>
          
          <View style={styles.macroRow}>
            <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
              <Text style={[styles.label, isDark && styles.labelDark]}>Calories</Text>
              <TextInput
                style={[styles.input, isDark && styles.inputDark]}
                value={calories}
                onChangeText={setCalories}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={isDark ? "#777" : "#aaa"}
              />
            </View>
            
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={[styles.label, isDark && styles.labelDark]}>Protein (g)</Text>
              <TextInput
                style={[styles.input, isDark && styles.inputDark]}
                value={protein}
                onChangeText={setProtein}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={isDark ? "#777" : "#aaa"}
              />
            </View>
          </View>
          
          <View style={styles.macroRow}>
            <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
              <Text style={[styles.label, isDark && styles.labelDark]}>Carbs (g)</Text>
              <TextInput
                style={[styles.input, isDark && styles.inputDark]}
                value={carbs}
                onChangeText={setCarbs}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={isDark ? "#777" : "#aaa"}
              />
            </View>
            
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={[styles.label, isDark && styles.labelDark]}>Fat (g)</Text>
              <TextInput
                style={[styles.input, isDark && styles.inputDark]}
                value={fat}
                onChangeText={setFat}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={isDark ? "#777" : "#aaa"}
              />
            </View>
          </View>
        </View>
        
        <View style={[styles.formSection, isDark && styles.formSectionDark]}>
          <Text style={[styles.sectionTitle, isDark && styles.textLight]}>Date & Time</Text>
          
          <TouchableOpacity
            style={[styles.datePickerButton, isDark && styles.datePickerButtonDark]}
            onPress={() => setShowDatePicker(true)}
          >
            <Calendar size={20} color="#2ecc71" />
            <Text style={[styles.dateText, isDark && styles.dateTextDark]}>{formatDate(mealDate)}</Text>
          </TouchableOpacity>
          
          {renderDatePicker()}
        </View>
        
        <View style={[styles.formSection, isDark && styles.formSectionDark]}>
          <Text style={[styles.sectionTitle, isDark && styles.textLight]}>Location</Text>
          
          <View style={styles.locationTypeSwitch}>
            <Text style={[
              styles.locationTypeText,
              !isCustomLocation && styles.activeLocationType,
              isDark && styles.locationTypeTextDark,
              !isCustomLocation && isDark && styles.activeLocationTypeDark
            ]}>
              Restaurant
            </Text>
            <Switch
              trackColor={{ false: '#2ecc71', true: '#2ecc71' }}
              thumbColor="#fff"
              ios_backgroundColor={isDark ? "#2a2a2a" : "#e9e9e9"}
              onValueChange={() => setIsCustomLocation(!isCustomLocation)}
              value={isCustomLocation}
            />
            <Text style={[
              styles.locationTypeText,
              isCustomLocation && styles.activeLocationType,
              isDark && styles.locationTypeTextDark,
              isCustomLocation && isDark && styles.activeLocationTypeDark
            ]}>
              Custom
            </Text>
          </View>
          
          {isCustomLocation ? (
            <View style={styles.inputGroup}>
              <Text style={[styles.label, isDark && styles.labelDark]}>Location Name</Text>
              <TextInput
                style={[styles.input, isDark && styles.inputDark]}
                value={customLocation}
                onChangeText={setCustomLocation}
                placeholder="e.g., Home, Work, etc."
                placeholderTextColor={isDark ? "#777" : "#aaa"}
              />
            </View>
          ) : (
            <View style={[styles.restaurantInfo, isDark && styles.restaurantInfoDark]}>
              <Text style={[styles.restaurantName, isDark && styles.restaurantNameDark]}>{restaurantName || 'Select a restaurant'}</Text>
              {restaurantAddress && (
                <Text style={[styles.restaurantAddress, isDark && styles.restaurantAddressDark]}>{restaurantAddress}</Text>
              )}
              
              {!restaurantName && (
                <TouchableOpacity
                  style={styles.selectRestaurantButton}
                  onPress={() => router.push('/(app)/nearby-restaurants')}
                >
                  <Text style={styles.selectRestaurantText}>
                    Find a Restaurant
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
        
        <TouchableOpacity
          style={[styles.logButton, loading && styles.logButtonDisabled]}
          onPress={handleSaveMeal}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.logButtonText}>Log Meal</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
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
  saveButton: {
    padding: 4,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 90, // Add extra padding for tab bar
  },
  contentContainerDark: {
    backgroundColor: '#121212',
  },
  formSection: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  formSectionDark: {
    backgroundColor: '#1e1e1e',
    shadowColor: '#000',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  textLight: {
    color: '#f2f2f2',
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
  datePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#eee',
  },
  datePickerButtonDark: {
    backgroundColor: '#2a2a2a',
    borderColor: '#333',
  },
  dateText: {
    fontSize: 16,
    marginLeft: 8,
    color: '#333',
  },
  dateTextDark: {
    color: '#f2f2f2',
  },
  webDatePicker: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  webDatePickerInput: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#eee',
    marginRight: 8,
  },
  webDatePickerInputDark: {
    backgroundColor: '#2a2a2a',
    borderColor: '#333',
    color: '#f2f2f2',
  },
  webDatePickerButton: {
    backgroundColor: '#2ecc71',
    borderRadius: 8,
    padding: 12,
  },
  webDatePickerButtonDark: {
    backgroundColor: '#27ae60',
  },
  webDatePickerButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  locationTypeSwitch: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  locationTypeText: {
    fontSize: 16,
    marginHorizontal: 8,
    color: '#888',
  },
  locationTypeTextDark: {
    color: '#aaa',
  },
  activeLocationType: {
    fontWeight: 'bold',
    color: '#2ecc71',
  },
  activeLocationTypeDark: {
    color: '#2ecc71',
  },
  restaurantInfo: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#eee',
  },
  restaurantInfoDark: {
    backgroundColor: '#2a2a2a',
    borderColor: '#333',
  },
  restaurantName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  restaurantNameDark: {
    color: '#f2f2f2',
  },
  restaurantAddress: {
    fontSize: 14,
    color: '#666',
  },
  restaurantAddressDark: {
    color: '#aaa',
  },
  selectRestaurantButton: {
    backgroundColor: '#2ecc71',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  selectRestaurantText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  logButton: {
    backgroundColor: '#2ecc71',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 32,
  },
  logButtonDisabled: {
    backgroundColor: '#a8e6cf',
  },
  logButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 18,
  },
  nutritionLoader: {
    position: 'absolute',
    right: 12,
    top: 40,
  },
  mealTypeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  mealTypeButton: {
    width: '48%',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 10,
    marginBottom: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#eee',
  },
  mealTypeButtonDark: {
    backgroundColor: '#2a2a2a',
    borderColor: '#333',
  },
  mealTypeButtonSelected: {
    backgroundColor: '#2ecc71',
    borderColor: '#2ecc71',
  },
  mealTypeButtonText: {
    color: '#666',
    fontWeight: '500',
  },
  mealTypeButtonTextDark: {
    color: '#aaa',
  },
  mealTypeButtonTextSelected: {
    color: 'white',
    fontWeight: 'bold',
  },
});

export default MealLoggingScreen;