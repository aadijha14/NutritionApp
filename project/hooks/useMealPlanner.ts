import { useState, useEffect } from 'react';
import { auth, db } from '../firebaseConfig';
import { collection, query, where, getDocs, doc, getDoc, setDoc } from 'firebase/firestore';
import { MealSlot, MenuItem, Restaurant } from '../types/mealPlanner';

export interface UseMealPlannerProps {
  dietaryPreferences: string[];
  nearbyRestaurants?: Restaurant[];
}

export const useMealPlanner = ({ dietaryPreferences, nearbyRestaurants = [] }: UseMealPlannerProps) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [slots, setSlots] = useState<MealSlot[]>([]);
  const [remainingCalories, setRemainingCalories] = useState<number>(0);
  const [dailyCalorieTarget, setDailyCalorieTarget] = useState<number>(2000);
  const [todayCalories, setTodayCalories] = useState<number>(0);
  const [homeRecipes, setHomeRecipes] = useState<MenuItem[]>([]);
  const [restaurantItems, setRestaurantItems] = useState<Record<string, MenuItem[]>>({});
  const [timeSlots, setTimeSlots] = useState([
    { id: 'breakfast', name: 'Breakfast', startTime: '07:00', endTime: '10:00', defaultTime: '08:30' },
    { id: 'lunch', name: 'Lunch', startTime: '12:00', endTime: '14:00', defaultTime: '12:30' },
    { id: 'snack', name: 'Snack', startTime: '15:00', endTime: '17:00', defaultTime: '16:00' },
    { id: 'dinner', name: 'Dinner', startTime: '18:00', endTime: '20:00', defaultTime: '19:00' },
  ]);

  // Initialize meal planner data
  useEffect(() => {
    const initializePlanner = async () => {
      if (!auth.currentUser) {
        setError('You must be logged in to plan your day');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // Fetch timeframes from Firestore
        const timeframesDocRef = doc(db, 'timeframes', 'default');
        const timeframesDoc = await getDoc(timeframesDocRef);
        
        if (timeframesDoc.exists() && timeframesDoc.data().slots) {
          setTimeSlots(timeframesDoc.data().slots);
        }

        // Fetch user data for calorie budgeting
        const userRef = doc(db, 'users', auth.currentUser.uid);
        const userDoc = await getDoc(userRef);
        
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setDailyCalorieTarget(userData.dailyCalorieTarget || 2000);
          setTodayCalories(userData.todayCalories || 0);
          
          // Calculate remaining calories for the day
          const remaining = (userData.dailyCalorieTarget || 2000) - (userData.todayCalories || 0);
          setRemainingCalories(remaining > 0 ? remaining : 0);
        }

        // Fetch user's previous meals for home recipe suggestions
        await fetchHomeRecipes();

        // Fetch menu items for nearby restaurants
        await fetchRestaurantItems();

        // Filter available time slots based on current time
        // For testing, we'll use all slots regardless of time
        const availableSlots = timeSlots; // Use all slots for testing
        
        // Initialize meal plan slots
        const initializedSlots = availableSlots.map(slot => ({
          id: slot.id,
          name: slot.name,
          time: slot.defaultTime,
          locationType: 'home', // Default to home
          menuItem: null,
          alternatives: [],
          notify: false,
          budget: 0, // Will be calculated later
        }));

        setSlots(initializedSlots);
      } catch (error) {
        console.error('Error initializing meal planner:', error);
        setError('Failed to initialize meal planner. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    initializePlanner();
  }, [dietaryPreferences]);

  // Fetch user's previous meals for home recipe suggestions
  const fetchHomeRecipes = async () => {
    if (!auth.currentUser) return;

    try {
      // Query user's past meals from mealLogs
      const logsRef = collection(db, 'mealLogs');
      const q = query(
        logsRef, 
        where('userId', '==', auth.currentUser.uid),
        where('location.type', '==', 'custom')
      );
      
      const snapshot = await getDocs(q);
      
      const recipes: MenuItem[] = [];
      const uniqueNames = new Set<string>();
      
      snapshot.forEach(doc => {
        const data = doc.data();
        
        // Only add unique food names
        if (!uniqueNames.has(data.foodName)) {
          uniqueNames.add(data.foodName);
          
          recipes.push({
            id: doc.id,
            foodName: data.foodName,
            calories: data.calories,
            protein: data.protein,
            carbs: data.carbs,
            fat: data.fat,
            createdBy: data.userId,
            createdAt: data.createdAt
          });
        }
      });
      
      setHomeRecipes(recipes);
    } catch (error) {
      console.error('Error fetching home recipes:', error);
      setError('Failed to fetch home recipes');
    }
  };

  // Fetch menu items for nearby restaurants
  const fetchRestaurantItems = async () => {
    if (nearbyRestaurants.length === 0) return;
    
    try {
      const items: Record<string, MenuItem[]> = {};
      
      // Get menu items for each nearby restaurant
      for (const restaurant of nearbyRestaurants) {
        const restaurantRef = doc(db, 'restaurants', restaurant.place_id);
        const restaurantDoc = await getDoc(restaurantRef);
        
        if (restaurantDoc.exists() && restaurantDoc.data().items) {
          items[restaurant.place_id] = restaurantDoc.data().items;
        } else {
          items[restaurant.place_id] = [];
        }
      }
      
      setRestaurantItems(items);
    } catch (error) {
      console.error('Error fetching restaurant items:', error);
      setError('Failed to fetch restaurant menu items');
    }
  };

  // Get available time slots based on current time - For testing, use all slots
  const getAvailableTimeSlots = () => {
    // For testing, return all time slots regardless of current time
    return timeSlots;
  };

  // Check if an item conforms to dietary preferences
  const itemConformsTo = (item: MenuItem, preferences: string[]): boolean => {
    // This is a simplified check - in a real app, you would have more detailed data about each item
    // For now, we'll assume all home recipes conform to the user's preferences
    // For restaurant items, we would need additional metadata
    
    // Implement your logic here based on the actual data structure
    return true;
  };

  // Generate a meal plan based on available slots, calorie budget, and preferences
  const generateMealPlan = async () => {
    if (slots.length === 0) {
      setError('No available meal slots for today');
      return;
    }

    try {
      // Calculate per-slot calorie budget
      const perSlotBudget = Math.floor(remainingCalories / slots.length);
      
      // Update slots with calorie budgets
      const updatedSlots = [...slots].map(slot => ({
        ...slot,
        budget: perSlotBudget
      }));

      // For each slot, find suitable menu items
      const finalSlots: MealSlot[] = await Promise.all(updatedSlots.map(async slot => {
        // Get candidates based on location type
        let candidates: MenuItem[] = [];
        
        if (slot.locationType === 'home') {
          // Use home recipes
          candidates = [...homeRecipes];
        } else {
          // Use restaurant items
          // For simplicity, we'll use the first restaurant's items
          const firstRestaurantId = Object.keys(restaurantItems)[0];
          if (firstRestaurantId) {
            candidates = restaurantItems[firstRestaurantId] || [];
          }
        }
        
        // Filter by dietary preferences
        candidates = candidates.filter(item => itemConformsTo(item, dietaryPreferences));
        
        // Filter by calorie budget
        candidates = candidates.filter(item => item.calories <= slot.budget);
        
        // Sort by closest to budget and any other criteria
        candidates.sort((a, b) => {
          const diffA = Math.abs(slot.budget - a.calories);
          const diffB = Math.abs(slot.budget - b.calories);
          
          // Primary sort: closer to budget is better
          if (diffA !== diffB) return diffA - diffB;
          
          // Secondary sort: higher protein is better (simple nutritional priority)
          return (b.protein || 0) - (a.protein || 0);
        });
        
        return {
          ...slot,
          menuItem: candidates.length > 0 ? candidates[0] : null,
          alternatives: candidates.slice(1, 4)
        };
      }));
      
      setSlots(finalSlots);
    } catch (error) {
      console.error('Error generating meal plan:', error);
      setError('Failed to generate meal plan. Please try again.');
    }
  };

  // Function to update a slot's properties
  const updateSlot = (slotId: string, updates: Partial<MealSlot>) => {
    setSlots(currentSlots => 
      currentSlots.map(slot => 
        slot.id === slotId ? { ...slot, ...updates } : slot
      )
    );
  };

  // Function to swap a slot's main item with the next alternative
  const swapMenuItem = (slotId: string) => {
    setSlots(currentSlots => {
      return currentSlots.map(slot => {
        if (slot.id === slotId) {
          const allOptions = [
            ...(slot.menuItem ? [slot.menuItem] : []),
            ...slot.alternatives
          ];
          
          if (allOptions.length <= 1) return slot;
          
          // Rotate the items
          const rotatedOptions = [...allOptions.slice(1), allOptions[0]];
          
          return {
            ...slot,
            menuItem: rotatedOptions[0],
            alternatives: rotatedOptions.slice(1)
          };
        }
        return slot;
      });
    });
  };

  // Save the meal plan to Firestore
  const saveMealPlan = async () => {
    if (!auth.currentUser) {
      setError('You must be logged in to save a meal plan');
      return;
    }

    try {
      // Create today's key in format YYYY-MM-DD
      const today = new Date();
      const todayKey = today.toISOString().split('T')[0];
      
      // Save to Firestore
      const planRef = doc(db, `users/${auth.currentUser.uid}/plans`, todayKey);
      await setDoc(planRef, {
        slots: slots,
        createdAt: new Date(),
        dietaryPreferences
      });
      
      return true;
    } catch (error) {
      console.error('Error saving meal plan:', error);
      setError('Failed to save meal plan. Please try again.');
      return false;
    }
  };

  // Return all the needed values and functions
  return {
    loading,
    error,
    slots,
    remainingCalories,
    dailyCalorieTarget,
    todayCalories,
    homeRecipes,
    restaurantItems,
    updateSlot,
    generateMealPlan,
    swapMenuItem,
    saveMealPlan
  };
};

export default useMealPlanner;