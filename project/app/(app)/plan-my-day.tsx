// PlanMyDayScreen.tsx
import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  TextInput,
  KeyboardAvoidingView
} from 'react-native';
import { router } from 'expo-router';
import { auth, db } from '../../firebaseConfig';
import {
  doc,
  getDoc,
  collection,
  serverTimestamp,
  updateDoc,
  setDoc,
  getDocs
} from 'firebase/firestore';
import {
  ArrowLeft,
  LayoutGrid,
  Calendar,
  Check,
  FileCheck,
  Heart,
  CircleAlert as AlertCircle,
  Utensils
} from 'lucide-react-native';
import * as Notifications from 'expo-notifications';
import { ThemeContext } from '../../context/ThemeContext';
import MealPlanCard from '../../components/MealPlanCard';
import { MealSlot } from '../../types/mealPlanner';

//////////////////////////////////////////////////////////////////////////
// DeepSeek Constants (Using DeepSeek API)
//////////////////////////////////////////////////////////////////////////
const DEEPSEEK_BASE_URL = 'https://api.deepseek.com';
const DEEPSEEK_API_KEY = 'sk-95593a35636148368ec4a6d868bf1bb8';

// Set notification handler for foreground notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const PlanMyDayScreen: React.FC = () => {
  const { theme } = useContext(ThemeContext);
  const isDark = theme === 'dark';

  //////////////////////////////////////////////////////////////////////
  // Local State
  //////////////////////////////////////////////////////////////////////
  const [dietaryPreferences, setDietaryPreferences] = useState<string[]>([]);
  const [availablePreferences] = useState<{ id: string; label: string }[]>([
    { id: 'vegetarian', label: 'Vegetarian' },
    { id: 'vegan', label: 'Vegan' },
    { id: 'glutenFree', label: 'Gluten Free' },
    { id: 'dairyFree', label: 'Dairy Free' },
    { id: 'ketogenic', label: 'Ketogenic' },
    { id: 'paleo', label: 'Paleo' },
  ]);

  const [dailyCalorieTarget, setDailyCalorieTarget] = useState<number>(2000);
  const [todayCalories, setTodayCalories] = useState<number>(0);
  const remainingCalories = Math.max(0, dailyCalorieTarget - todayCalories);

  // Meal settings: which mode per meal.
  const [mealSettings, setMealSettings] = useState<{
    breakfast: 'home' | 'restaurant';
    lunch: 'home' | 'restaurant';
    snack: 'home' | 'restaurant';
    dinner: 'home' | 'restaurant';
  }>({
    breakfast: 'home',
    lunch: 'home',
    snack: 'home',
    dinner: 'home'
  });

  // Final meal slots and UI states.
  const [slots, setSlots] = useState<MealSlot[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  // isPlanSaved is used to indicate if the plan as loaded from Firestore is saved.
  // It will be marked false on any user edit/regeneration to allow saving.
  const [isPlanSaved, setIsPlanSaved] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Plan feedback and single-meal swap reasons.
  const [planFeedback, setPlanFeedback] = useState<string>('');
  const [swapReasons, setSwapReasons] = useState<{ [key: string]: string }>({});
  const [swappingMeal, setSwappingMeal] = useState<string | null>(null);

  //////////////////////////////////////////////////////////////////////
  // Initialization: load user data and saved plan (if any) for today
  //////////////////////////////////////////////////////////////////////
  useEffect(() => {
    const init = async () => {
      if (!auth.currentUser) {
        setLoading(false);
        setError('You must be logged in to use PlanMyDay.');
        return;
      }
      try {
        // Load user document data.
        const userRef = doc(db, 'users', auth.currentUser.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const userData = userSnap.data();
          if (userData.dietaryPreferences) {
            setDietaryPreferences(userData.dietaryPreferences);
          }
          if (typeof userData.dailyCalorieTarget === 'number') {
            setDailyCalorieTarget(userData.dailyCalorieTarget);
          }
          if (typeof userData.todayCalories === 'number') {
            setTodayCalories(userData.todayCalories);
          }
        }
        // Check if plan exists for today.
        const today = new Date().toISOString().split('T')[0];
        const planRef = doc(db, `users/${auth.currentUser.uid}/plans`, today);
        const planSnap = await getDoc(planRef);
        if (planSnap.exists()) {
          const savedPlan = planSnap.data();
          setSlots(savedPlan.slots || []);
          setIsPlanSaved(true);
        }
      } catch (err) {
        console.error('PlanMyDayScreen init error:', err);
        setError('Initialization failed. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  //////////////////////////////////////////////////////////////////////
  // Utility: Convert degrees to radians and calculate distance.
  //////////////////////////////////////////////////////////////////////
  const toRad = (deg: number) => deg * (Math.PI / 180);
  const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // in km
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Default location (for example, near NTU)
  const LATITUDE = 1.355049655134308;
  const LONGITUDE = 103.68518139204353;

  //////////////////////////////////////////////////////////////////////
  // Fetch nearby restaurant items from Firestore (all restaurants within 2 km)
  //////////////////////////////////////////////////////////////////////
  const fetchNearbyMenuItems = async (): Promise<any[]> => {
    try {
      const snapshot = await getDocs(collection(db, 'restaurants'));
      const nearbyItems: any[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.location && data.items) {
          const dist = getDistance(
            data.location.lat,
            data.location.lng,
            LATITUDE,
            LONGITUDE
          );
          if (dist < 2.0) {
            data.items.forEach((item: any) => {
              nearbyItems.push({
                ...item,
                restaurantName: data.name,
                restaurantAddress: data.address || ''
              });
            });
          }
        }
      });
      return nearbyItems;
    } catch (error) {
      console.error('fetchNearbyMenuItems error:', error);
      return [];
    }
  };

  //////////////////////////////////////////////////////////////////////
  // Group restaurant items by restaurant (using "restaurantName" and "restaurantAddress")
  //////////////////////////////////////////////////////////////////////
  const groupItemsByRestaurant = (items: any[]): { [key: string]: any[] } => {
    const grouped: { [key: string]: any[] } = {};
    items.forEach((item) => {
      const rName = item.restaurantName || 'Unknown';
      const rAddr = item.restaurantAddress || 'N/A';
      const key = `${rName}__${rAddr}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(item);
    });
    return grouped;
  };

  //////////////////////////////////////////////////////////////////////
  // Generate Meal Plan using DeepSeek API (with grouping for restaurants)
  //////////////////////////////////////////////////////////////////////
  const generateMealPlan = async (feedback: string = ''): Promise<MealSlot[]> => {
    // Five guaranteed meals.
    const guaranteedMeals = ['breakfast', 'lunch', 'snack', 'dinner', 'snack'];

    // Gather all restaurant menu items.
    const nearbyMenuItems = await fetchNearbyMenuItems();
    // Group restaurant items to avoid repeating restaurant name/address.
    const restaurantGroups = groupItemsByRestaurant(nearbyMenuItems);

    // Build available dishes text for each meal.
    const availableByMeal: { [key: string]: string } = {};
    guaranteedMeals.forEach((meal) => {
      const setting = mealSettings[meal as keyof typeof mealSettings] || 'home';
      if (setting === 'restaurant') {
        if (Object.keys(restaurantGroups).length === 0) {
          availableByMeal[meal] = 'No restaurant data found.';
        } else {
          let block = '';
          for (const key in restaurantGroups) {
            const [rName, rAddr] = key.split('__');
            block += `\nRestaurant: ${rName}, ${rAddr}\n`;
            const dishes = restaurantGroups[key];
            for (const dish of dishes) {
              block += `  - ${dish.foodName} (${dish.calories} cal, P:${dish.protein || 0}g C:${dish.carbs || 0}g F:${dish.fat || 0}g)\n`;
            }
          }
          availableByMeal[meal] = block.trim();
        }
      } else {
        availableByMeal[meal] =
          'User will cook at home. You can invent a dish with realistic macros.';
      }
    });

    const dietLabels = dietaryPreferences.length ? dietaryPreferences.join(', ') : 'None';

    // Create the system and user prompts for DeepSeek.
    const systemPrompt = `
You are a meal recommendation assistant.
Only return answers in the exact format specified below.
Never guess the calories for restaurant items; use the data provided.
Include macros (protein, carbs, fat) for each dish.
Ignore meal timing constraints.
    `;

    let userPrompt = `
Generate a meal plan for today with these constraints:

**Calories Remaining**: ${remainingCalories}
**Dietary Preferences**: ${dietLabels}
**User Feedback**: ${feedback || 'None'}

We have five guaranteed meals:
1) Breakfast
2) Lunch
3) Snack
4) Dinner
5) Snack

If needed, feel free to add an extra snack.

For each meal, use exactly this format (no time required):

---
**Meal**: <meal name>
**Dish**: <dish name>
**Calories**: <kcal>
**Protein**: <g>
**Carbs**: <g>
**Fat**: <g>
**Restaurant**: <restaurant name or 'home'>
**Address**: <restaurant address or 'N/A'>
**Why this dish**: <short reason>
---

Available dishes per meal:
    `;

    guaranteedMeals.forEach((meal) => {
      userPrompt += `\n🍽️ ${meal.toUpperCase()} (${mealSettings[meal as keyof typeof mealSettings] || 'home'}):\n${availableByMeal[meal]}\n`;
    });

    // Log for debugging.
    console.log('Sending Plan Generation Request to DeepSeek...');
    console.log('System Prompt:', systemPrompt);
    console.log('User Prompt:', userPrompt);

    try {
      const response = await fetch(`${DEEPSEEK_BASE_URL}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${DEEPSEEK_API_KEY}`
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.7
        })
      });

      if (!response.ok) {
        const text = await response.text();
        console.error('DeepSeek API response not ok:', text);
        throw new Error(`DeepSeek API Error: ${response.status} - ${text}`);
      }

      const completionData = await response.json();
      console.log('DeepSeek API response:', completionData);

      const rawResponse = completionData.choices?.[0]?.message?.content || '';
      console.log('Raw GPT response:', rawResponse);

      const sections = rawResponse.split('---').filter((sec: string) => sec.trim() !== '');
      const newSlots: MealSlot[] = [];

      sections.forEach((section, idx) => {
        const mealMatch = section.match(/\*\*Meal\*\*:\s*(.+)/);
        const dishMatch = section.match(/\*\*Dish\*\*:\s*(.+)/);
        const calMatch = section.match(/\*\*Calories\*\*:\s*(.+)/);
        const proteinMatch = section.match(/\*\*Protein\*\*:\s*(.+)/);
        const carbsMatch = section.match(/\*\*Carbs\*\*:\s*(.+)/);
        const fatMatch = section.match(/\*\*Fat\*\*:\s*(.+)/);
        const restaurantMatch = section.match(/\*\*Restaurant\*\*:\s*(.+)/);
        const addressMatch = section.match(/\*\*Address\*\*:\s*(.+)/);
        const whyMatch = section.match(/\*\*Why this dish\*\*:\s*(.+)/);

        if (
          mealMatch &&
          dishMatch &&
          calMatch &&
          proteinMatch &&
          carbsMatch &&
          fatMatch &&
          restaurantMatch &&
          addressMatch &&
          whyMatch
        ) {
          newSlots.push({
            id: Date.now().toString() + '-' + idx,
            name: mealMatch[1].trim(),
            time: '',
            locationType:
              restaurantMatch[1].trim().toLowerCase() === 'home' ? 'home' : 'restaurant',
            menuItem: {
              foodName: dishMatch[1].trim(),
              calories: parseInt(calMatch[1].trim(), 10),
              protein: parseInt(proteinMatch[1].trim(), 10) || 0,
              carbs: parseInt(carbsMatch[1].trim(), 10) || 0,
              fat: parseInt(fatMatch[1].trim(), 10) || 0,
              restaurantName:
                restaurantMatch[1].trim() === 'home'
                  ? ''
                  : restaurantMatch[1].trim(),
              restaurantAddress: addressMatch[1].trim()
            },
            reason: whyMatch[1].trim(),
            notify: false,
            alternatives: []
          });
        }
      });

      console.log('Parsed Meal Plan Slots:', newSlots);
      return newSlots;
    } catch (err: any) {
      console.error('Error generating meal plan:', err);
      throw err;
    }
  };

  //////////////////////////////////////////////////////////////////////
  // Handle Entire Plan Generation
  //////////////////////////////////////////////////////////////////////
  const handleGeneratePlan = async () => {
    if (remainingCalories <= 0) {
      Alert.alert('No calories remaining', 'You have used up your calories for today.');
      return;
    }
    setIsGenerating(true);
    setError(null);
    try {
      const newSlots = await generateMealPlan(planFeedback);
      if (!newSlots || newSlots.length === 0) {
        setError('No meal plan returned. Try again or modify your feedback.');
      } else {
        setSlots(newSlots);
        // Mark the plan as edited (unsaved)
        setIsPlanSaved(false);
      }
    } catch (err: any) {
      setError(`Meal plan generation failed. ${err.message || ''}`);
    } finally {
      setIsGenerating(false);
    }
  };

  //////////////////////////////////////////////////////////////////////
  // Single Meal Swap Handler
  //////////////////////////////////////////////////////////////////////
  const handleSwapMeal = async (slotId: string, swapReason: string) => {
    const slot = slots.find((s) => s.id === slotId);
    if (!slot) return;
    setSwappingMeal(slotId);

    let availableDishes = '';
    if (slot.locationType === 'restaurant') {
      try {
        const nearbyItems = await fetchNearbyMenuItems();
        const restaurantGroups = groupItemsByRestaurant(nearbyItems);
        if (Object.keys(restaurantGroups).length === 0) {
          availableDishes = 'No restaurant data found.';
        } else {
          let block = '';
          for (const key in restaurantGroups) {
            const [rName, rAddr] = key.split('__');
            block += `\nRestaurant: ${rName}, ${rAddr}\n`;
            const dishes = restaurantGroups[key];
            for (const dish of dishes) {
              block += `  - ${dish.foodName} (${dish.calories} cal, P:${dish.protein || 0}g C:${dish.carbs || 0}g F:${dish.fat || 0}g)\n`;
            }
          }
          availableDishes = block.trim();
        }
      } catch (err) {
        console.error('Error fetching restaurant items for swap:', err);
      }
    } else {
      availableDishes = 'User will cook at home. Provide realistic macros.';
    }

    const systemMsg = `
You are a meal swapping assistant.
Only return the swapped meal in the exact format provided.
Include macros (protein, carbs, fat).
Use only the provided restaurant data if applicable.
Ignore meal timing constraints.
    `;
    const userMsg = `
I want to swap one meal.

**Meal to swap**: ${slot.name}
**Reason**: ${swapReason || 'None'}
**Calories Remaining**: ${remainingCalories}
**Dietary Preferences**: ${dietaryPreferences.join(', ') || 'None'}
**Meal Setting**: ${slot.locationType}

Here are available dishes for this meal:
${availableDishes}

Only return this exact format:
---
**Meal**: ${slot.name}
**Dish**: <dish name>
**Calories**: <kcal>
**Protein**: <g>
**Carbs**: <g>
**Fat**: <g>
**Restaurant**: <restaurant name or 'home'>
**Address**: <restaurant address or 'N/A'>
**Why this dish**: <reason>
---
    `;
    const messages = [
      { role: 'system', content: systemMsg },
      { role: 'user', content: userMsg }
    ];

    try {
      const response = await fetch(`${DEEPSEEK_BASE_URL}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${DEEPSEEK_API_KEY}`
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages,
          temperature: 0.7
        })
      });

      if (!response.ok) {
        const text = await response.text();
        console.error('DeepSeek Swap Meal API response not ok:', text);
        throw new Error(`DeepSeek swap meal error: ${response.status} - ${text}`);
      }

      const completionData = await response.json();
      console.log('DeepSeek Swap Meal response:', completionData);
      const rawResponse = completionData.choices?.[0]?.message?.content || '';
      console.log('Raw Swap Meal response:\n', rawResponse);

      const section = rawResponse.split('---').find((s: string) => s.trim() !== '');
      if (section) {
        const dishMatch = section.match(/\*\*Dish\*\*:\s*(.+)/);
        const calMatch = section.match(/\*\*Calories\*\*:\s*(.+)/);
        const proteinMatch = section.match(/\*\*Protein\*\*:\s*(.+)/);
        const carbsMatch = section.match(/\*\*Carbs\*\*:\s*(.+)/);
        const fatMatch = section.match(/\*\*Fat\*\*:\s*(.+)/);
        const restaurantMatch = section.match(/\*\*Restaurant\*\*:\s*(.+)/);
        const addressMatch = section.match(/\*\*Address\*\*:\s*(.+)/);
        const whyMatch = section.match(/\*\*Why this dish\*\*:\s*(.+)/);

        if (
          dishMatch && calMatch &&
          proteinMatch && carbsMatch && fatMatch &&
          restaurantMatch && addressMatch && whyMatch
        ) {
          const newSlot = {
            ...slot,
            menuItem: {
              foodName: dishMatch[1].trim(),
              calories: parseInt(calMatch[1].trim(), 10),
              protein: parseInt(proteinMatch[1].trim(), 10) || 0,
              carbs: parseInt(carbsMatch[1].trim(), 10) || 0,
              fat: parseInt(fatMatch[1].trim(), 10) || 0,
              restaurantName: restaurantMatch[1].trim() === 'home' ? '' : restaurantMatch[1].trim(),
              restaurantAddress: addressMatch[1].trim()
            },
            reason: whyMatch[1].trim()
          };
          setSlots((curr) => curr.map((s) => (s.id === slotId ? newSlot : s)));
          // Mark plan as edited
          setIsPlanSaved(false);
        }
      }
    } catch (err) {
      console.error('Error swapping meal with DeepSeek:', err);
      Alert.alert('Error', 'Failed to swap meal');
    } finally {
      setSwappingMeal(null);
    }
  };

  //////////////////////////////////////////////////////////////////////
  // Save Plan to Firestore
  //////////////////////////////////////////////////////////////////////
  const handleSavePlan = async () => {
    if (!auth.currentUser) {
      Alert.alert('Login Required', 'Please log in first');
      return;
    }
    const today = new Date().toISOString().split('T')[0];
    try {
      await setDoc(doc(db, `users/${auth.currentUser.uid}/plans`, today), {
        slots: slots,
        createdAt: serverTimestamp()
      });
      setIsPlanSaved(true);
      Alert.alert('Success', 'Meal plan saved for today!', [
        { text: 'OK', onPress: () => router.push('/(app)/dashboard') }
      ]);
    } catch (err) {
      console.error('PlanMyDayScreen: error saving plan', err);
      Alert.alert('Error', 'Failed to save plan');
    }
  };

  //////////////////////////////////////////////////////////////////////
  // Rendering UI Sections
  //////////////////////////////////////////////////////////////////////
  const renderMealSettings = () => (
    <View style={[styles.section, isDark && styles.sectionDark]}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, isDark && styles.textLight]}>Meal Settings</Text>
        <Text style={[styles.sectionSubtitle, isDark && styles.subtitleDark]}>
          Choose Home or Restaurant for each meal
        </Text>
      </View>
      {['breakfast', 'lunch', 'snack', 'dinner'].map((meal) => (
        <View key={meal} style={styles.mealSettingRow}>
          <Text style={[styles.mealSettingLabel, isDark && styles.textLight]}>
            {meal === 'snack' ? 'Snack' : meal.charAt(0).toUpperCase() + meal.slice(1)}
          </Text>
          <View style={styles.mealSettingOptions}>
            <TouchableOpacity
              style={[
                styles.mealSettingOption,
                mealSettings[meal as keyof typeof mealSettings] === 'home' &&
                  styles.mealSettingOptionActive
              ]}
              onPress={() =>
                setMealSettings((prev) => ({
                  ...prev,
                  [meal]: 'home'
                }))
              }
            >
              <Text style={styles.mealSettingOptionText}>Home</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.mealSettingOption,
                mealSettings[meal as keyof typeof mealSettings] === 'restaurant' &&
                  styles.mealSettingOptionActive
              ]}
              onPress={() =>
                setMealSettings((prev) => ({
                  ...prev,
                  [meal]: 'restaurant'
                }))
              }
            >
              <Text style={styles.mealSettingOptionText}>Restaurant</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}
    </View>
  );

  const renderDietaryPreferences = () => (
    <View style={[styles.section, isDark && styles.sectionDark]}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, isDark && styles.textLight]}>
          Dietary Preferences
        </Text>
        <Text style={[styles.sectionSubtitle, isDark && styles.subtitleDark]}>
          Select your dietary preferences to customize your meal plan
        </Text>
      </View>
      <View style={styles.preferencesContainer}>
        {availablePreferences.map((pref) => (
          <TouchableOpacity
            key={pref.id}
            style={[
              styles.preferenceOption,
              dietaryPreferences.includes(pref.id) && styles.activePreference,
              isDark && styles.preferenceOptionDark,
              dietaryPreferences.includes(pref.id) && isDark && styles.activePreferenceDark
            ]}
            onPress={() =>
              setDietaryPreferences((curr) =>
                curr.includes(pref.id)
                  ? curr.filter((p) => p !== pref.id)
                  : [...curr, pref.id]
              )
            }
          >
            {dietaryPreferences.includes(pref.id) && (
              <View style={styles.checkmarkContainer}>
                <Check size={14} color="#fff" />
              </View>
            )}
            <Text
              style={[
                styles.preferenceText,
                dietaryPreferences.includes(pref.id) && styles.activePreferenceText,
                isDark && styles.preferenceTextDark,
                dietaryPreferences.includes(pref.id) && isDark && styles.activePreferenceTextDark
              ]}
            >
              {pref.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <TouchableOpacity
        style={styles.updateButton}
        onPress={async () => {
          if (!auth.currentUser) return;
          try {
            await updateDoc(doc(db, 'users', auth.currentUser.uid), { dietaryPreferences });
            Alert.alert('Saved', 'Dietary preferences updated.');
          } catch (err) {
            console.error('Error saving dietary preferences', err);
            Alert.alert('Error', 'Failed to save preferences');
          }
        }}
      >
        <Heart size={16} color="#fff" />
        <Text style={styles.updateButtonText}>Update Preferences</Text>
      </TouchableOpacity>
    </View>
  );

  const renderCalorieBudget = () => (
    <View style={[styles.section, isDark && styles.sectionDark]}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, isDark && styles.textLight]}>
          Today's Calorie Budget
        </Text>
      </View>
      <View style={[styles.calorieBudgetInfo, isDark && styles.calorieBudgetInfoDark]}>
        <View style={styles.budgetItem}>
          <Text style={[styles.budgetValue, isDark && styles.budgetValueDark]}>
            {dailyCalorieTarget}
          </Text>
          <Text style={[styles.budgetLabel, isDark && styles.budgetLabelDark]}>
            Daily Target
          </Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.budgetItem}>
          <Text style={[styles.budgetValue, { color: '#ff6b6b' }]}>{todayCalories}</Text>
          <Text style={[styles.budgetLabel, isDark && styles.budgetLabelDark]}>Consumed</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.budgetItem}>
          <Text style={[styles.budgetValue, { color: '#2ecc71' }]}>{remainingCalories}</Text>
          <Text style={[styles.budgetLabel, isDark && styles.budgetLabelDark]}>Remaining</Text>
        </View>
      </View>
    </View>
  );

  // Updated: Render meal slots.
  const renderMealSlots = () => (
    <View style={styles.slotsContainer}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, isDark && styles.textLight]}>Your Meal Plan</Text>
        <Text style={[styles.sectionSubtitle, isDark && styles.subtitleDark]}>
          Customize your meals for any time
        </Text>
      </View>
      {slots.length === 0 ? (
        <View style={[styles.emptySlots, isDark && styles.emptySlotsDark]}>
          <Calendar size={32} color={isDark ? '#aaa' : '#ccc'} />
          <Text style={[styles.emptySlotsText, isDark && styles.textLight]}>
            No meals set yet
          </Text>
          <Text style={[styles.emptySlotsSubtext, isDark && styles.emptySlotsSubtextDark]}>
            Generate a plan to see your meals!
          </Text>
          {!isGenerating && (
            <TouchableOpacity
              style={[styles.generateButton, styles.generateButtonLarge, { marginTop: 16 }]}
              onPress={handleGeneratePlan}
            >
              <LayoutGrid size={20} color="#fff" />
              <Text style={styles.generateButtonText}>Generate Plan</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        slots.map((slot) => (
          <View key={slot.id} style={[styles.mealSlotContainer, isDark && styles.sectionDark]}>
            {slot.menuItem ? (
              <>
                <MealPlanCard
                  slot={slot}
                  onTimeChange={(slotId: string, time: string) => {
                    setSlots((curr) =>
                      curr.map((s) => (s.id === slotId ? { ...s, time } : s))
                    );
                    setIsPlanSaved(false);
                  }}
                  onToggleLocation={(slotId: string) => {
                    setSlots((curr) =>
                      curr.map((s) =>
                        s.id === slotId
                          ? {
                              ...s,
                              locationType: s.locationType === 'home' ? 'restaurant' : 'home',
                              menuItem: null,
                              reason: ''
                            }
                          : s
                      )
                    );
                    setIsPlanSaved(false);
                  }}
                  onSwap={(slotId: string) => {
                    handleSwapMeal(slotId, swapReasons[slot.id] || '');
                  }}
                  onToggleNotify={(slotId: string, notify: boolean) => {
                    setSlots((curr) => curr.map((s) => (s.id === slotId ? { ...s, notify } : s)));
                  }}
                />
                {swappingMeal === slot.id ? (
                  <View style={styles.swappingContainer}>
                    <ActivityIndicator size="small" color="#2ecc71" />
                    <Text style={[styles.swappingText, isDark && styles.textLight]}>
                      Regenerating {slot.name}...
                    </Text>
                  </View>
                ) : (
                  <>
                    <View style={styles.reasonContainer}>
                      <Text style={[styles.reasonLabel, isDark && styles.textLight]}>Reason:</Text>
                      <Text style={[styles.reasonText, isDark && styles.textLight]}>{slot.reason}</Text>
                    </View>
                    <View style={styles.swapContainer}>
                      <TextInput
                        style={[styles.swapInput, isDark && styles.swapInputDark]}
                        placeholder={`Reason to re-gen ${slot.name}...`}
                        placeholderTextColor={isDark ? '#aaa' : '#666'}
                        value={swapReasons[slot.id] || ''}
                        onChangeText={(txt) =>
                          setSwapReasons((prev) => ({ ...prev, [slot.id]: txt }))
                        }
                      />
                      <TouchableOpacity
                        style={styles.swapButton}
                        onPress={() => handleSwapMeal(slot.id, swapReasons[slot.id] || '')}
                      >
                        <LayoutGrid size={18} color="#fff" />
                        <Text style={styles.swapButtonText}>Re-Gen Meal</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </>
            ) : (
              <View style={styles.completedContainer}>
                <Check size={16} color="#2ecc71" />
                <Text style={[styles.completedText, isDark && styles.textLight]}>Meal Completed</Text>
              </View>
            )}
          </View>
        ))
      )}

      {slots.length > 0 && !isGenerating && (
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={[styles.generateButton, styles.generateButtonLarge, { marginRight: 8 }]}
            onPress={handleGeneratePlan}
          >
            <LayoutGrid size={20} color="#fff" />
            <Text style={styles.generateButtonText}>Regenerate Plan</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.saveButton, isPlanSaved && styles.savedButton]}
            onPress={handleSavePlan}
          >
            <FileCheck size={20} color="#fff" />
            <Text style={styles.saveButtonText}>
              {isPlanSaved ? 'Plan Saved' : 'Save Plan'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {isGenerating && (
        <View style={styles.generatingContainer}>
          <ActivityIndicator size="large" color="#2ecc71" />
          <Text style={[styles.generatingText, isDark && styles.textLight]}>
            Generating your meal plan...
          </Text>
        </View>
      )}
      {error && (
        <View style={styles.errorContainer}>
          <AlertCircle size={20} color="#ff6b6b" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
    </View>
  );

  const renderPlanFeedback = () => {
    if (slots.length === 0) return null;
    return (
      <View style={[styles.section, isDark && styles.sectionDark]}>
        <Text style={[styles.sectionTitle, isDark && styles.textLight]}>Plan Feedback</Text>
        <TextInput
          style={[styles.feedbackInput, isDark && styles.feedbackInputDark]}
          placeholder="Enter any feedback or instructions for your meal plan..."
          placeholderTextColor={isDark ? '#aaa' : '#666'}
          value={planFeedback}
          onChangeText={setPlanFeedback}
          multiline
        />
      </View>
    );
  };

  //////////////////////////////////////////////////////////////////////
  // Main Render
  //////////////////////////////////////////////////////////////////////
  return (
    <KeyboardAvoidingView
      style={[styles.container, isDark && styles.containerDark]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={[styles.header, isDark && styles.headerDark]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color="#2ecc71" />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, isDark && styles.textLight]}>Plan My Day</Text>
        <Utensils size={24} color="#2ecc71" />
      </View>

      {loading ? (
        <View style={[styles.loadingContainer, isDark && styles.loadingContainerDark]}>
          <ActivityIndicator size="large" color="#2ecc71" />
          <Text style={[styles.loadingText, isDark && styles.textLight]}>
            Loading your meal planning options...
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {slots.length === 0 && renderMealSettings()}
          {renderDietaryPreferences()}
          {renderCalorieBudget()}
          {renderMealSlots()}
          {renderPlanFeedback()}
          <View style={styles.bottomSpacer} />
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
};

//////////////////////////////////////////////////////////////////////////
// STYLES
//////////////////////////////////////////////////////////////////////////
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9f9f9' },
  containerDark: { backgroundColor: '#121212' },

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
  headerDark: { backgroundColor: '#1e1e1e', shadowColor: '#000' },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#2ecc71' },
  textLight: { color: '#f2f2f2' },

  scrollView: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 90 },

  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingContainerDark: { backgroundColor: '#121212' },
  loadingText: { marginTop: 16, color: '#666', fontSize: 16 },

  section: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  sectionDark: { backgroundColor: '#1e1e1e', shadowColor: '#000' },
  sectionHeader: { marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 4 },
  sectionSubtitle: { fontSize: 14, color: '#666' },
  subtitleDark: { color: '#aaa' },

  mealSettingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    justifyContent: 'space-between'
  },
  mealSettingLabel: { fontSize: 16, fontWeight: '600', color: '#333' },
  mealSettingOptions: { flexDirection: 'row' },
  mealSettingOption: {
    backgroundColor: '#f0f0f0',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginRight: 8,
  },
  mealSettingOptionActive: { backgroundColor: '#2ecc71' },
  mealSettingOptionText: { fontSize: 14, color: '#333' },

  preferencesContainer: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 16 },
  preferenceOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#eee'
  },
  preferenceOptionDark: { backgroundColor: '#252525', borderColor: '#333' },
  activePreference: { backgroundColor: '#2ecc71', borderColor: '#2ecc71' },
  activePreferenceDark: { backgroundColor: '#2ecc71', borderColor: '#2ecc71' },
  checkmarkContainer: { marginRight: 4 },
  preferenceText: { fontSize: 14, color: '#666' },
  preferenceTextDark: { color: '#aaa' },
  activePreferenceText: { color: 'white', fontWeight: 'bold' },
  activePreferenceTextDark: { color: 'white', fontWeight: 'bold' },

  updateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2ecc71',
    borderRadius: 8,
    paddingVertical: 12
  },
  updateButtonText: { color: 'white', fontWeight: 'bold', fontSize: 16, marginLeft: 8 },

  calorieBudgetInfo: { flexDirection: 'row', borderRadius: 8, padding: 16 },
  calorieBudgetInfoDark: { backgroundColor: '#252525' },
  budgetItem: { flex: 1, alignItems: 'center' },
  budgetValue: { fontSize: 24, fontWeight: 'bold', color: '#333', marginBottom: 4 },
  budgetValueDark: { color: '#f2f2f2' },
  budgetLabel: { fontSize: 12, color: '#666' },
  budgetLabelDark: { color: '#aaa' },
  divider: { width: 1, backgroundColor: '#eee', marginHorizontal: 8 },

  slotsContainer: { marginBottom: 16 },
  emptySlots: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#f0f0f0',
    borderStyle: 'dashed'
  },
  emptySlotsDark: { backgroundColor: '#1e1e1e', borderColor: '#333' },
  emptySlotsText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#666',
    marginTop: 12,
    marginBottom: 8
  },
  emptySlotsSubtext: { fontSize: 14, color: '#888', textAlign: 'center' },
  emptySlotsSubtextDark: { color: '#777' },

  mealSlotContainer: {
    marginBottom: 16,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 12
  },

  // Style for completed (logged) meal view.
  completedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    justifyContent: 'center'
  },
  completedText: { fontSize: 16, fontWeight: 'bold', color: '#2ecc71', marginLeft: 6 },

  reasonContainer: { marginTop: 8 },
  reasonLabel: { fontSize: 14, fontWeight: 'bold' },
  reasonText: { fontSize: 14, marginTop: 4 },

  swapContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  swapInput: {
    flex: 1,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6
  },
  swapInputDark: { borderColor: '#555', color: '#f2f2f2' },
  swapButton: {
    backgroundColor: '#3498db',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginLeft: 8,
    flexDirection: 'row',
    alignItems: 'center'
  },
  swapButtonText: { color: 'white', fontWeight: 'bold', marginLeft: 6 },

  swappingContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  swappingText: { marginLeft: 8, fontSize: 14, color: '#666' },

  actionsContainer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3498db',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 10
  },
  generateButtonLarge: { paddingVertical: 14 },
  generateButtonText: { color: 'white', fontWeight: 'bold', fontSize: 16, marginLeft: 8 },

  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2ecc71',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 10
  },
  savedButton: { backgroundColor: '#27ae60' },
  saveButtonText: { color: 'white', fontWeight: 'bold', fontSize: 16, marginLeft: 8 },

  generatingContainer: { marginTop: 16, alignItems: 'center', justifyContent: 'center' },
  generatingText: { marginTop: 8, fontSize: 16, color: '#333' },

  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    borderRadius: 8,
    padding: 8,
    backgroundColor: '#ffe6e6'
  },
  errorText: { marginLeft: 8, color: '#ff6b6b' },

  feedbackInput: {
    minHeight: 60,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 8,
    textAlignVertical: 'top',
    backgroundColor: '#fff'
  },
  feedbackInputDark: {
    backgroundColor: '#252525',
    borderColor: '#555',
    color: '#f2f2f2'
  },

  bottomSpacer: { height: 80 }
});

export default PlanMyDayScreen;
