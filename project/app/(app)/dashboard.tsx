// DashboardScreen.tsx
import React, { useEffect, useState, useContext } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  ScrollView, 
  Alert,
  ActivityIndicator,
  Platform
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { auth, db } from '../../firebaseConfig';
import { doc, getDoc, collection, query, where, onSnapshot, orderBy, updateDoc, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { Search, Plus, ChartPie as PieChart, Clock, Settings, Map, UtensilsCrossed, ChartBar as BarChart3, CalendarClock, Check } from 'lucide-react-native';
import { ThemeContext } from '../../context/ThemeContext';

interface UserData {
  email?: string;
  name?: string;
  weight?: number;
  height?: number;
  age?: number;
  sex?: string;
  activityLevel?: string;
  tdee?: number;
  dailyCalorieTarget?: number;
}

interface MealLog {
  id: string;
  foodName: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  date: Date;
  location?: any;
  mealType?: string;
}

interface MealPlanSlot {
  id: string;
  name: string;
  time: string;
  menuItem: {
    foodName: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  } | null;
  locationType: 'home' | 'restaurant';
}

const DashboardScreen: React.FC = () => {
  const { theme } = useContext(ThemeContext);
  const isDark = theme === 'dark';
  
  const [userData, setUserData] = useState<UserData | null>(null);
  const [totalCalories, setTotalCalories] = useState<number>(0);
  const [caloriesLeft, setCaloriesLeft] = useState<number>(0);
  const [recentMeals, setRecentMeals] = useState<MealLog[]>([]);
  const [lastResetDate, setLastResetDate] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [totalProtein, setTotalProtein] = useState<number>(0);
  const [totalCarbs, setTotalCarbs] = useState<number>(0);
  const [totalFat, setTotalFat] = useState<number>(0);
  const [isCalorieExceeded, setIsCalorieExceeded] = useState<boolean>(false);
  const [isProteinExceeded, setIsProteinExceeded] = useState<boolean>(false);
  const [isCarbsExceeded, setIsCarbsExceeded] = useState<boolean>(false);
  const [isFatExceeded, setIsFatExceeded] = useState<boolean>(false);
  const [todaysPlan, setTodaysPlan] = useState<MealPlanSlot[]>([]);
  
  // Function to fetch user data and set up meal logs listener
  const fetchUserDataAndMealLogs = async () => {
    if (auth.currentUser) {
      try {
        const userRef = doc(db, 'users', auth.currentUser.uid);
        const userDoc = await getDoc(userRef);
        if (userDoc.exists()) {
          const data = userDoc.data() as UserData;
          setUserData(data);
          
          // Check if we need to reset daily calories
          const today = new Date().toDateString();
          const storedResetDate = userDoc.data().lastResetDate || '';
          
          if (storedResetDate !== today) {
            // Reset calories for new day
            setCaloriesLeft(data.dailyCalorieTarget || 2000);
            setTotalCalories(0);
            setLastResetDate(today);
          } else {
            setLastResetDate(storedResetDate);
            const todaysCals = userDoc.data().todayCalories || 0;
            setTotalCalories(todaysCals);
            setCaloriesLeft((data.dailyCalorieTarget || 2000) - todaysCals);
            setIsCalorieExceeded(todaysCals > (data.dailyCalorieTarget || 2000));
          }
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
        Alert.alert("Error", "Failed to load your profile data");
      }
    } else {
      // Demo data for when user isn't authenticated
      setUserData({
        email: "user@example.com",
        dailyCalorieTarget: 2000,
        tdee: 2000
      });
      setCaloriesLeft(2000);
    }
    
    const unsubscribe = setupMealLogsListener();

    // Also fetch today's meal plan
    await fetchTodaysMealPlan();
    
    return unsubscribe;
  };
  
  // Set up meal logs listener
  const setupMealLogsListener = () => {
    if (!auth.currentUser) return () => {};
    
    // Get today's date at midnight
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // Listen for today's meal logs
    const mealsRef = collection(db, 'mealLogs');
    const todayMealsQuery = query(
      mealsRef,
      where('userId', '==', auth.currentUser.uid),
      where('date', '>=', today),
      where('date', '<', tomorrow),
      orderBy('date', 'desc')
    );
    
    const unsubscribe = onSnapshot(todayMealsQuery, (snapshot) => {
      let meals: MealLog[] = [];
      let totalCals = 0;
      let proteinTotal = 0;
      let carbsTotal = 0;
      let fatTotal = 0;
      
      snapshot.forEach((docSnap) => {
        const mealData = docSnap.data();
        const mealDate = mealData.date?.toDate ? mealData.date.toDate() : new Date(mealData.date);
        
        const meal: MealLog = {
          id: docSnap.id,
          foodName: mealData.foodName || '',
          calories: mealData.calories || 0,
          protein: mealData.protein || 0,
          carbs: mealData.carbs || 0,
          fat: mealData.fat || 0,
          date: mealDate,
          location: mealData.location,
          mealType: mealData.mealType
        };
        
        meals.push(meal);
        totalCals += meal.calories;
        proteinTotal += meal.protein;
        carbsTotal += meal.carbs;
        fatTotal += meal.fat;
      });
      
      setRecentMeals(meals);
      setTotalCalories(totalCals);
      setTotalProtein(proteinTotal);
      setTotalCarbs(carbsTotal);
      setTotalFat(fatTotal);
      
      if (userData?.dailyCalorieTarget) {
        const remaining = userData.dailyCalorieTarget - totalCals;
        setCaloriesLeft(remaining);
        setIsCalorieExceeded(remaining < 0);
        
        // Check if macro nutrients are exceeded
        const proteinTarget = userData.dailyCalorieTarget * 0.25 / 4; // 4 calories per gram
        const carbsTarget = userData.dailyCalorieTarget * 0.5 / 4;
        const fatTarget = userData.dailyCalorieTarget * 0.25 / 9;
        
        setIsProteinExceeded(proteinTotal > proteinTarget);
        setIsCarbsExceeded(carbsTotal > carbsTarget);
        setIsFatExceeded(fatTotal > fatTarget);
      }
      
      // Update user document with today's calories
      if (auth.currentUser) {
        const userRef = doc(db, 'users', auth.currentUser.uid);
        const todayString = new Date().toDateString();
        getDoc(userRef).then((docSnap) => {
          if (docSnap.exists()) {
            if (docSnap.data().todayCalories !== totalCals || docSnap.data().lastResetDate !== todayString) {
              updateDoc(userRef, {
                todayCalories: totalCals,
                lastResetDate: todayString
              });
            }
          }
        }).catch((error) => {
          console.error("Error updating user calories:", error);
        });
      }
    }, (error) => {
      console.error("Error listening to meal logs:", error);
      Alert.alert("Error", "Failed to sync your meal data");
    });
    
    return unsubscribe;
  };
  
  // Fetch today's meal plan
  const fetchTodaysMealPlan = async () => {
    if (!auth.currentUser) return;
    
    try {
      // Get today's date in YYYY-MM-DD format
      const today = new Date().toISOString().split('T')[0];
      
      // Fetch the plan from Firestore
      const planDoc = await getDoc(doc(db, `users/${auth.currentUser.uid}/plans`, today));
      
      if (planDoc.exists()) {
        const planData = planDoc.data();
        setTodaysPlan(planData.slots.filter(
          (slot: MealPlanSlot) => slot.menuItem !== null
        ));
      } else {
        setTodaysPlan([]);
      }
    } catch (error) {
      console.error('Error fetching today\'s meal plan:', error);
    }
  };

  // Log a meal from today's plan
  const logPlannedMeal = async (slot: MealPlanSlot) => {
    if (!auth.currentUser || !slot.menuItem) return;
    
    try {
      // Create meal log entry
      await addDoc(collection(db, 'mealLogs'), {
        userId: auth.currentUser.uid,
        foodName: slot.menuItem.foodName,
        calories: slot.menuItem.calories,
        protein: slot.menuItem.protein || 0,
        carbs: slot.menuItem.carbs || 0,
        fat: slot.menuItem.fat || 0,
        date: new Date(),
        createdAt: serverTimestamp(),
        mealType: slot.id, // Use slot id as meal type (breakfast, lunch, etc.)
        location: {
          name: slot.locationType === 'home' ? 'Home' : 'Restaurant',
          type: slot.locationType
        }
      });
      
      // Update the plan to mark this slot as logged
      const today = new Date().toISOString().split('T')[0];
      const planRef = doc(db, `users/${auth.currentUser.uid}/plans`, today);
      const planDoc = await getDoc(planRef);
      
      if (planDoc.exists()) {
        const planData = planDoc.data();
        const updatedSlots = planData.slots.map((s: MealPlanSlot) => 
          s.id === slot.id ? { ...s, menuItem: null } : s
        );
        
        await updateDoc(planRef, { slots: updatedSlots });
        
        // Update local state
        setTodaysPlan(prevPlan => prevPlan.filter(s => s.id !== slot.id));
      }
      
      Alert.alert('Success', 'Meal logged successfully!');
    } catch (error) {
      console.error('Error logging planned meal:', error);
      Alert.alert('Error', 'Failed to log meal');
    }
  };
  
  // Use useFocusEffect to refresh data when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      setLoading(true);
      
      // Define a function to call the async operation and handle cleanup
      const loadData = async () => {
        const unsubscribe = await fetchUserDataAndMealLogs();
        setLoading(false);
        // Return cleanup function
        return () => {
          if (typeof unsubscribe === 'function') {
            unsubscribe();
          }
        };
      };
      
      // Call the function immediately
      const cleanup = loadData();
      
      // Return a cleanup function that will call the cleanup returned by loadData
      return () => {
        // We need to handle the Promise returned by loadData
        cleanup.then(cleanupFn => {
          if (cleanupFn) {
            cleanupFn();
          }
        }).catch(err => {
          console.error("Error during cleanup:", err);
        });
      };
    }, [])
  );
  
  // Initial setup
  useEffect(() => {
    setLoading(true);
    
    // Define a function to call the async operation and handle cleanup
    const loadData = async () => {
      const unsubscribe = await fetchUserDataAndMealLogs();
      setLoading(false);
      return unsubscribe;
    };
    
    // Call the function immediately
    const cleanupPromise = loadData();
    
    // Return a cleanup function
    return () => {
      cleanupPromise.then(cleanup => {
        if (typeof cleanup === 'function') {
          cleanup();
        }
      }).catch(err => {
        console.error("Error during cleanup:", err);
      });
    };
  }, []);

  const welcomeMessage = `Welcome${userData?.name ? ', ' + userData.name : userData?.email ? ', ' + userData.email.split('@')[0] : ''}!`;

  const navigateToRestaurants = () => {
    router.push('/(app)/nearby-restaurants');
  };

  const navigateToMealLogging = (mealType?: string) => {
    if (mealType) {
      router.push({
        pathname: '/(app)/meal-logging',
        params: { mealType }
      });
    } else {
      router.push('/(app)/meal-logging');
    }
  };
  
  const navigateToMealHistory = () => {
    router.push('/(app)/meal-history');
  };

  const navigateToAnalytics = () => {
    router.push('/(app)/dining-analytics');
  };

  const navigateToSettings = () => {
    router.push('/(app)/settings');
  };

  const navigateToPlanMyDay = () => {
    router.push('/(app)/plan-my-day');
  };
  
  const renderRecentFoods = () => {
    if (recentMeals.length === 0) {
      return <Text style={[styles.emptyStateText, isDark && styles.emptyStateTextDark]}>No foods added yet</Text>;
    }
    
    return (
      <View style={styles.recentFoodsContainer}>
        {recentMeals.slice(0, 3).map((meal) => (
          <View key={meal.id} style={[styles.recentFoodItem, isDark && styles.recentFoodItemDark]}>
            <View style={styles.recentFoodInfo}>
              <Text style={[styles.recentFoodName, isDark && styles.textLight]}>{meal.foodName}</Text>
              <Text style={[styles.recentFoodLocation, isDark && styles.recentFoodLocationDark]}>
                {meal.mealType ? meal.mealType.charAt(0).toUpperCase() + meal.mealType.slice(1) : ''}
                {meal.mealType && meal.location?.name ? ' • ' : ''}
                {meal.location?.name || 'Custom meal'}
              </Text>
            </View>
            <View style={styles.recentFoodCalories}>
              <Text style={styles.calorieValue}>{Math.round(meal.calories)}</Text>
              <Text style={[styles.calorieLabel, isDark && styles.calorieLabelDark]}>cal</Text>
            </View>
          </View>
        ))}
        {recentMeals.length > 3 && (
          <TouchableOpacity 
            style={[styles.viewAllButton, isDark && styles.viewAllButtonDark]}
            onPress={navigateToMealHistory}
          >
            <Text style={[styles.viewAllText, isDark && styles.viewAllTextDark]}>View All</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderMacroProgress = () => {
    // Example targets (customize as needed)
    const dailyTarget = userData?.dailyCalorieTarget || 2000;
    const proteinTarget = dailyTarget * 0.25 / 4; // 4 calories per gram
    const carbsTarget = dailyTarget * 0.5 / 4;
    const fatTarget = dailyTarget * 0.25 / 9;
    
    return (
      <View style={styles.macroContainer}>
        <View style={styles.macroItem}>
          <View style={styles.macroHeader}>
            <Text style={[styles.macroLabel, isDark && styles.textLight]}>Protein</Text>
            <Text style={[
              styles.macroValue,
              isProteinExceeded && styles.exceededText
            ]}>
              {Math.round(totalProtein)}g
              <Text style={[styles.macroTarget, isDark && styles.macroTargetDark]}> / {Math.round(proteinTarget)}g</Text>
              {isProteinExceeded && <Text style={styles.exceededIndicator}> (Exceeded)</Text>}
            </Text>
          </View>
          <View style={[styles.macroProgressBar, isDark && styles.macroProgressBarDark]}>
            <View 
              style={[
                styles.macroProgress, 
                { 
                  width: `${Math.min(100, (totalProtein / proteinTarget) * 100)}%`, 
                  backgroundColor: isProteinExceeded ? '#e74c3c' : '#3498db' 
                }
              ]}
            />
          </View>
        </View>
        
        <View style={styles.macroItem}>
          <View style={styles.macroHeader}>
            <Text style={[styles.macroLabel, isDark && styles.textLight]}>Carbs</Text>
            <Text style={[
              styles.macroValue,
              isCarbsExceeded && styles.exceededText,
              isDark && styles.textLight
            ]}>
              {Math.round(totalCarbs)}g
              <Text style={[styles.macroTarget, isDark && styles.macroTargetDark]}> / {Math.round(carbsTarget)}g</Text>
              {isCarbsExceeded && <Text style={styles.exceededIndicator}> (Exceeded)</Text>}
            </Text>
          </View>
          <View style={[styles.macroProgressBar, isDark && styles.macroProgressBarDark]}>
            <View 
              style={[
                styles.macroProgress, 
                { 
                  width: `${Math.min(100, (totalCarbs / carbsTarget) * 100)}%`, 
                  backgroundColor: isCarbsExceeded ? '#e74c3c' : '#f39c12' 
                }
              ]}
            />
          </View>
        </View>
        
        <View style={styles.macroItem}>
          <View style={styles.macroHeader}>
            <Text style={[styles.macroLabel, isDark && styles.textLight]}>Fat</Text>
            <Text style={[
              styles.macroValue,
              isFatExceeded && styles.exceededText,
              isDark && styles.textLight
            ]}>
              {Math.round(totalFat)}g
              <Text style={[styles.macroTarget, isDark && styles.macroTargetDark]}> / {Math.round(fatTarget)}g</Text>
              {isFatExceeded && <Text style={styles.exceededIndicator}> (Exceeded)</Text>}
            </Text>
          </View>
          <View style={[styles.macroProgressBar, isDark && styles.macroProgressBarDark]}>
            <View 
              style={[
                styles.macroProgress, 
                { 
                  width: `${Math.min(100, (totalFat / fatTarget) * 100)}%`,
                  backgroundColor: isFatExceeded ? '#e74c3c' : '#e67e22' 
                }
              ]}
            />
          </View>
        </View>
      </View>
    );
  };

  // Format time for display (convert from 24h to 12h format)
  const formatTimeForDisplay = (time: string) => {
    if (!time) return "";
    
    const [hours, minutes] = time.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12; // convert 0 to 12 for 12 AM
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  // Render today's plan section
  const renderTodaysPlan = () => {
    if (todaysPlan.length === 0) {
      return (
        <View style={[styles.emptyPlanContainer, isDark && styles.emptyPlanContainerDark]}>
          <Text style={[styles.emptyPlanText, isDark && styles.textLight]}>
            No meal plan for today
          </Text>
          <TouchableOpacity
            style={styles.createPlanButton}
            onPress={navigateToPlanMyDay}
          >
            <Text style={styles.createPlanButtonText}>Create Plan</Text>
          </TouchableOpacity>
        </View>
      );
    }
    
    return (
      <View style={styles.planContainer}>
        {todaysPlan.map(slot => (
          <View key={slot.id} style={[styles.planItem, isDark && styles.planItemDark]}>
            <View style={styles.planItemHeader}>
              <Text style={[styles.planItemTitle, isDark && styles.textLight]}>{slot.name}</Text>
              <Text style={[styles.planItemTime, isDark && styles.planItemTimeDark]}>
                {formatTimeForDisplay(slot.time)}
              </Text>
            </View>
            
            {slot.menuItem && (
              <>
                <View style={styles.planItemDetails}>
                  <View style={styles.planItemFood}>
                    <Text style={[styles.planItemFoodName, isDark && styles.textLight]}>
                      {slot.menuItem.foodName}
                    </Text>
                    <View style={styles.planItemMacros}>
                      <Text style={styles.planItemCalories}>{Math.round(slot.menuItem.calories)} cal</Text>
                      <Text style={[styles.planItemMacro, isDark && styles.planItemMacroDark]}>
                        P: {Math.round(slot.menuItem.protein || 0)}g
                      </Text>
                      <Text style={[styles.planItemMacro, isDark && styles.planItemMacroDark]}>
                        C: {Math.round(slot.menuItem.carbs || 0)}g
                      </Text>
                      <Text style={[styles.planItemMacro, isDark && styles.planItemMacroDark]}>
                        F: {Math.round(slot.menuItem.fat || 0)}g
                      </Text>
                    </View>
                  </View>
                  
                  <TouchableOpacity
                    style={styles.planItemLogButton}
                    onPress={() => logPlannedMeal(slot)}
                  >
                    <Check size={16} color="#fff" />
                  </TouchableOpacity>
                </View>
                
                <View style={styles.planItemLocation}>
                  <Text style={[styles.planItemLocationText, isDark && styles.planItemLocationTextDark]}>
                    {slot.locationType === 'home' ? '🏠 Home' : '🍽️ Restaurant'}
                  </Text>
                </View>
              </>
            )}
          </View>
        ))}
      </View>
    );
  };

  const doDisplayDashboard = () => (
    <>
      <View style={[styles.header, isDark && styles.headerDark]}>
        <Text style={[styles.welcomeMessage, isDark && styles.welcomeMessageDark]}>{welcomeMessage}</Text>
        <TouchableOpacity onPress={navigateToSettings}>
          <Settings color={isDark ? "#2ecc71" : "#2ecc71"} size={24} />
        </TouchableOpacity>
      </View>
      
      <View style={[styles.calorieCard, isDark && styles.calorieCardDark]}>
        <View style={styles.calorieInfo}>
          <Text style={[styles.calorieTitle, isDark && styles.calorieTitleDark]}>Daily Calories</Text>
          <Text style={[
            styles.calorieValue,
            isCalorieExceeded ? styles.calorieValueExceeded : isDark ? styles.calorieValueDark : null
          ]}>
            {caloriesLeft < 0 ? '-' : ''}{Math.abs(Math.round(caloriesLeft))}
          </Text>
          <Text style={[styles.calorieSubtext, isDark && styles.calorieSubtextDark]}>
            {caloriesLeft >= 0 ? 'remaining' : 'over limit'}
          </Text>
          {isCalorieExceeded && (
            <View style={[styles.warningBadge, isDark && styles.warningBadgeDark]}>
              <Text style={styles.warningText}>Daily limit exceeded</Text>
            </View>
          )}
        </View>
        <View style={styles.calorieProgress}>
          <View style={[styles.progressBar, isDark && styles.progressBarDark]}>
            <View 
              style={[
                styles.progressFill, 
                { 
                  width: `${Math.min(100, (totalCalories / (userData?.dailyCalorieTarget || 2000)) * 100)}%`,
                  backgroundColor: isCalorieExceeded ? '#e74c3c' : '#2ecc71' 
                }
              ]} 
            />
          </View>
          <View style={styles.progressLabels}>
            <Text style={[styles.progressLabel, isDark && styles.progressLabelDark]}>{Math.round(totalCalories)} consumed</Text>
            <Text style={[styles.progressLabel, isDark && styles.progressLabelDark]}>
              {userData?.dailyCalorieTarget || 2000} goal
            </Text>
          </View>
        </View>
        
        {renderMacroProgress()}
        
        <TouchableOpacity 
          style={styles.analyticsButton}
          onPress={navigateToAnalytics}
        >
          <BarChart3 size={16} color="#fff" />
          <Text style={styles.analyticsButtonText}>View Full Analytics</Text>
        </TouchableOpacity>
      </View>
      
      <Text style={[styles.sectionTitle, isDark && styles.sectionTitleDark]}>Quick Actions</Text>
      <View style={styles.actionButtons}>
        <TouchableOpacity style={[styles.actionButton, isDark && styles.actionButtonDark]} onPress={navigateToRestaurants}>
          <Map color="#2ecc71" size={24} style={styles.actionIcon} />
          <Text style={[styles.actionButtonText, isDark && styles.actionButtonTextDark]}>Find Restaurants</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionButton, isDark && styles.actionButtonDark]} onPress={() => navigateToMealLogging()}>
          <UtensilsCrossed color="#2ecc71" size={24} style={styles.actionIcon} />
          <Text style={[styles.actionButtonText, isDark && styles.actionButtonTextDark]}>Log Custom Meal</Text>
        </TouchableOpacity>
      </View>
      
      {/* Plan My Day Button */}
      <TouchableOpacity 
        style={[styles.planMyDayButton, isDark && styles.planMyDayButtonDark]} 
        onPress={navigateToPlanMyDay}
      >
        <CalendarClock size={20} color="#fff" />
        <Text style={styles.planMyDayText}>Plan My Day</Text>
      </TouchableOpacity>
      
      {/* Today's Plan Section */}
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, isDark && styles.sectionTitleDark]}>Today's Plan</Text>
      </View>
      {renderTodaysPlan()}
      
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, isDark && styles.sectionTitleDark]}>Recent Foods</Text>
        <TouchableOpacity onPress={navigateToMealHistory}>
          <Text style={[styles.viewAllLink, isDark && styles.viewAllLinkDark]}>View All</Text>
        </TouchableOpacity>
      </View>
      {renderRecentFoods()}
    </>
  );

  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
      {loading ? (
        <View style={[styles.loadingContainer, isDark && styles.loadingContainerDark]}>
          <ActivityIndicator size="large" color="#2ecc71" />
          <Text style={[styles.loadingText, isDark && styles.textLight]}>Loading your dashboard...</Text>
        </View>
      ) : (
        <>
          <ScrollView 
            style={styles.scrollView} 
            contentContainerStyle={[styles.contentContainer, isDark && styles.contentContainerDark]}
            showsVerticalScrollIndicator={false}
          >
            {doDisplayDashboard()}
          </ScrollView>
        </>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainerDark: {
    backgroundColor: '#121212',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    marginTop: 12,
  },
  textLight: {
    color: '#f2f2f2',
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40, // Increased top padding for notch
    paddingBottom: 90, // Extra padding for tab bar
  },
  contentContainerDark: {
    backgroundColor: '#121212',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerDark: {
    borderBottomColor: '#2a2a2a',
  },
  welcomeMessage: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2ecc71',
  },
  welcomeMessageDark: {
    color: '#2ecc71',
  },
  calorieCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  calorieCardDark: {
    backgroundColor: '#1e1e1e',
    shadowColor: '#000',
  },
  calorieInfo: {
    alignItems: 'center',
    marginBottom: 15,
  },
  calorieTitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  calorieTitleDark: {
    color: '#aaa',
  },
  calorieValue: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#2ecc71',
  },
  calorieValueDark: {
    color: '#2ecc71',
  },
  calorieValueExceeded: {
    color: '#e74c3c',
  },
  calorieSubtext: {
    fontSize: 14,
    color: '#888',
  },
  calorieSubtextDark: {
    color: '#aaa',
  },
  warningBadge: {
    backgroundColor: '#ffebeb',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#ffcdd2',
  },
  warningBadgeDark: {
    backgroundColor: '#4e2c2c',
    borderColor: '#632f2f',
  },
  warningText: {
    color: '#e74c3c',
    fontSize: 12,
    fontWeight: 'bold',
  },
  calorieProgress: {
    marginTop: 10,
  },
  progressBar: {
    height: 10,
    backgroundColor: '#f0f0f0',
    borderRadius: 5,
    overflow: 'hidden',
  },
  progressBarDark: {
    backgroundColor: '#2a2a2a',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#2ecc71',
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 5,
  },
  progressLabel: {
    fontSize: 12,
    color: '#888',
  },
  progressLabelDark: {
    color: '#aaa',
  },
  macroContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  macroItem: {
    marginBottom: 10,
  },
  macroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  macroLabel: {
    fontSize: 14,
    color: '#666',
  },
  macroValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  exceededText: {
    color: '#e74c3c',
  },
  exceededIndicator: {
    fontSize: 12,
    fontWeight: 'normal',
    color: '#e74c3c',
  },
  macroTarget: {
    fontWeight: 'normal',
    color: '#999',
    fontSize: 12,
  },
  macroTargetDark: {
    color: '#777',
  },
  macroProgressBar: {
    height: 6,
    backgroundColor: '#f0f0f0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  macroProgressBarDark: {
    backgroundColor: '#2a2a2a',
  },
  macroProgress: {
    height: '100%',
  },
  analyticsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2ecc71',
    borderRadius: 8,
    paddingVertical: 10,
    marginTop: 16,
  },
  analyticsButtonText: {
    color: 'white',
    fontWeight: 'bold',
    marginLeft: 8,
  },
  planMyDayButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3498db',
    borderRadius: 8,
    paddingVertical: 12,
    marginBottom: 20,
  },
  planMyDayButtonDark: {
    backgroundColor: '#2980b9',
  },
  planMyDayText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 15,
    marginBottom: 10,
    color: '#333',
  },
  sectionTitleDark: {
    color: '#f2f2f2',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 15,
    marginBottom: 10,
  },
  viewAllLink: {
    color: '#2ecc71',
    fontWeight: 'bold',
  },
  viewAllLinkDark: {
    color: '#2ecc71',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  actionButton: {
    backgroundColor: 'white',
    width: '48%',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  actionButtonDark: {
    backgroundColor: '#1e1e1e',
    shadowColor: '#000',
  },
  actionIcon: {
    marginBottom: 8,
  },
  actionButtonText: {
    color: '#2ecc71',
    fontWeight: 'bold',
  },
  actionButtonTextDark: {
    color: '#2ecc71',
  },
  planContainer: {
    marginBottom: 20,
  },
  planItem: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  planItemDark: {
    backgroundColor: '#1e1e1e',
    shadowColor: '#000',
  },
  planItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  planItemTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  planItemTime: {
    fontSize: 13,
    color: '#666',
  },
  planItemTimeDark: {
    color: '#aaa',
  },
  planItemDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  planItemFood: {
    flex: 1,
  },
  planItemFoodName: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
  },
  planItemMacros: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  planItemCalories: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2ecc71',
    marginRight: 8,
  },
  planItemMacro: {
    fontSize: 12,
    color: '#666',
    marginRight: 8,
  },
  planItemMacroDark: {
    color: '#aaa',
  },
  planItemLogButton: {
    backgroundColor: '#2ecc71',
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planItemLocation: {
    marginTop: 8,
  },
  planItemLocationText: {
    fontSize: 12,
    color: '#666',
  },
  planItemLocationTextDark: {
    color: '#aaa',
  },
  emptyPlanContainer: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyPlanContainerDark: {
    backgroundColor: '#1e1e1e',
  },
  emptyPlanText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  createPlanButton: {
    backgroundColor: '#3498db',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  createPlanButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
  recentFoodsContainer: {
    marginBottom: 15,
  },
  recentFoodItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  recentFoodItemDark: {
    backgroundColor: '#1e1e1e',
    shadowColor: '#000',
  },
  recentFoodInfo: {
    flex: 1,
  },
  recentFoodName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  recentFoodLocation: {
    fontSize: 12,
    color: '#888',
  },
  recentFoodLocationDark: {
    color: '#aaa',
  },
  recentFoodCalories: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  calorieValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2ecc71',
  },
  calorieLabel: {
    fontSize: 12,
    color: '#888',
  },
  calorieLabelDark: {
    color: '#aaa',
  },
  viewAllButton: {
    backgroundColor: '#f0f0f0',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  viewAllButtonDark: {
    backgroundColor: '#2a2a2a',
  },
  viewAllText: {
    color: '#2ecc71',
    fontWeight: 'bold',
  },
  viewAllTextDark: {
    color: '#2ecc71',
  },
  emptyStateText: {
    textAlign: 'center',
    color: '#888',
    padding: 20,
    backgroundColor: 'white',
    borderRadius: 8,
    fontStyle: 'italic',
  },
  emptyStateTextDark: {
    backgroundColor: '#1e1e1e',
    color: '#aaa',
  }
});

export default DashboardScreen;