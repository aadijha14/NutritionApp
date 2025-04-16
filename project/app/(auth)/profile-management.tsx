// Profile Management Screen (app/(auth)/profile-management.tsx) - FINAL VERSION with Centered Inputs
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  StatusBar
} from 'react-native';
import { router } from 'expo-router';
import globalStyles from '../styles/globalStyles'; // Assuming you have this
import { db, auth } from '../../firebaseConfig';
import { doc, setDoc } from 'firebase/firestore';

// --- Constants ---
interface ActivityLevelOption {
  value: string;
  label: string;
  description: string;
  multiplier: number;
}
interface DietaryPreference {
  id: string;
  label: string;
}
interface GoalTypeOption {
  value: 'lose' | 'maintain' | 'gain';
  label: string;
  adjustment: number;
}
const ACTIVITY_LEVELS: ActivityLevelOption[] = [
  { value: 'sedentary', label: 'Sedentary', description: 'Little or no exercise', multiplier: 1.2 },
  { value: 'light', label: 'Light', description: 'Light exercise 1-3 days/week', multiplier: 1.375 },
  { value: 'moderate', label: 'Moderate', description: 'Moderate exercise 3-5 days/week', multiplier: 1.55 },
  { value: 'active', label: 'Active', description: 'Hard exercise 6-7 days/week', multiplier: 1.725 },
  { value: 'veryActive', label: 'Very Active', description: 'Very hard exercise & physical job', multiplier: 1.9 }
];
const DIETARY_PREFERENCES: DietaryPreference[] = [
  { id: 'vegetarian', label: 'Vegetarian' },
  { id: 'vegan', label: 'Vegan' },
  { id: 'glutenFree', label: 'Gluten Free' },
  { id: 'dairyFree', label: 'Dairy Free' },
  { id: 'ketogenic', label: 'Ketogenic' },
  { id: 'paleo', label: 'Paleo' },
];
const GOAL_TYPES: GoalTypeOption[] = [
  { value: 'lose', label: 'Lose Weight', adjustment: -500 },
  { value: 'maintain', label: 'Maintain Weight', adjustment: 0 },
  { value: 'gain', label: 'Gain Weight', adjustment: 500 }
];
// --- End Constants ---

const ProfileManagementScreen: React.FC = () => {
  // State Variables
  const [weight, setWeight] = useState<string>('');
  const [height, setHeight] = useState<string>('');
  const [age, setAge] = useState<string>('');
  const [sex, setSex] = useState<'male' | 'female' | ''>('');
  const [activityLevel, setActivityLevel] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [selectedDietary, setSelectedDietary] = useState<string[]>([]);
  const [goalType, setGoalType] = useState<'lose' | 'maintain' | 'gain' | ''>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);

  // --- Helper Functions ---
  const calculateTDEE = (
    weightKg: number,
    heightCm: number,
    ageYears: number,
    userSex: string,
    userActivityLevel: string
  ): number => {
    if (!weightKg || !heightCm || !ageYears || !userSex || !userActivityLevel) {
      return 0; // Not enough info
    }
    // Mifflin-St Jeor Equation
    let bmr =
      userSex.toLowerCase() === 'male'
        ? 10 * weightKg + 6.25 * heightCm - 5 * ageYears + 5
        : 10 * weightKg + 6.25 * heightCm - 5 * ageYears - 161;

    const activityOption = ACTIVITY_LEVELS.find(level => level.value === userActivityLevel);
    const activityMultiplier = activityOption ? activityOption.multiplier : 1.2; // Default to sedentary if not found

    return Math.round(bmr * activityMultiplier);
  };

  const calculateDailyTarget = (tdee: number, selectedGoalType: string): number => {
    // Ensure selectedGoalType is valid before finding the goal
    const validGoalTypes: Array<'lose' | 'maintain' | 'gain'> = ['lose', 'maintain', 'gain'];
    if (tdee <= 0 || !validGoalTypes.includes(selectedGoalType as any)) return tdee > 0 ? tdee : 0; // Return TDEE if valid, else 0

    const goal = GOAL_TYPES.find(g => g.value === selectedGoalType);
    const adjustment = goal ? goal.adjustment : 0; // Default to maintain if goal not found
    const target = tdee + adjustment;

    // Ensure minimum healthy calorie intake (adjust threshold if needed)
    return Math.max(1200, target);
  };

  const toggleDietaryPreference = (id: string) => {
    setErrorMessage(''); // Clear error on interaction
    if (selectedDietary.includes(id)) {
      setSelectedDietary(selectedDietary.filter(item => item !== id));
    } else {
      setSelectedDietary([...selectedDietary, id]);
    }
  };
  // --- End Helper Functions ---

  // --- Submit Handler ---
  const handleProfileSubmit = async () => {
    // --- Validation ---
    if (!name.trim()) { setErrorMessage('Please enter your name'); return; }
    if (!weight || !height || !age) { setErrorMessage('Please enter your weight, height, and age'); return; }
    if (!sex) { setErrorMessage('Please select your sex'); return; }
    if (!activityLevel) { setErrorMessage('Please select your activity level'); return; }
    if (!goalType) { setErrorMessage('Please select your weight goal'); return; }

    const weightNum = parseFloat(weight);
    const heightNum = parseFloat(height);
    const ageNum = parseInt(age, 10);

    if (isNaN(weightNum) || weightNum <= 0 || isNaN(heightNum) || heightNum <= 0 || isNaN(ageNum) || ageNum <= 0) { setErrorMessage('Please enter valid numbers for weight, height, and age'); return; }
    if (weightNum < 30 || weightNum > 300) { setErrorMessage('Please enter a valid weight (30-300 kg)'); return; }
    if (heightNum < 120 || heightNum > 250) { setErrorMessage('Please enter a valid height (120-250 cm)'); return; }
    if (ageNum < 13 || ageNum > 100) { setErrorMessage('Please enter a valid age (13-100 years)'); return; }

    setErrorMessage('');
    setSaving(true);

    // --- Calculations ---
    const calculatedTDEE = calculateTDEE(weightNum, heightNum, ageNum, sex, activityLevel);
    const currentGoalType = goalType || 'maintain'; // Use selected or default
    const calculatedDailyTarget = calculateDailyTarget(calculatedTDEE, currentGoalType);

    // --- Firestore Update ---
    if (auth.currentUser) {
      try {
        const userData = {
          name: name.trim(),
          email: auth.currentUser.email,
          weight: weightNum,
          height: heightNum,
          age: ageNum,
          sex,
          activityLevel,
          dietaryPreferences: selectedDietary,
          goalType: currentGoalType,
          tdee: calculatedTDEE,
          dailyCalorieTarget: calculatedDailyTarget,
          notifications: true,
          mealReminders: true,
          darkMode: false,
          createdAt: new Date(),
        };

        const userDocRef = doc(db, 'users', auth.currentUser.uid);
        await setDoc(userDocRef, userData, { merge: true }); // Use merge: true

        router.replace('/(app)/dashboard');

      } catch (error: any) {
        console.error("Error saving profile: ", error);
        setErrorMessage(`Failed to save profile: ${error.message}`);
        Alert.alert("Save Error", `Could not save your profile. Please try again. \n${error.message}`);
      } finally {
        setSaving(false);
      }
    } else {
      setErrorMessage('Authentication error. Please log in again.');
      setSaving(false);
      Alert.alert("Authentication Error", "You are not logged in. Please sign out and sign in again.");
    }
  };
  // --- End Submit Handler ---

  // --- Render ---
  return (
    <ScrollView
      style={styles.scrollContainer}
      contentContainerStyle={styles.scrollContentContainer}
      keyboardShouldPersistTaps="handled"
    >
      {/* Add StatusBar padding */}
      <View style={{ height: Platform.OS === 'android' ? StatusBar.currentHeight : 40 }} />

      <View style={[globalStyles.container, styles.contentContainer]}>
        <Text style={[globalStyles.title, styles.mainTitle]}>Complete Your Profile</Text>
        <Text style={[globalStyles.subtitle, styles.subtitle]}>
          Tell us a bit about yourself for personalized nutrition tracking.
        </Text>

        {/* --- Full Name --- */}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, styles.centeredLabel]}>Full Name</Text>
          {/* Wrap TextInput in a View for centering */}
          <View style={styles.centeredInputContainer}>
            <TextInput
              style={[globalStyles.inputField, styles.inputFieldSizing]} // Keep text left, control width
              placeholder="Enter your full name"
              placeholderTextColor="#aaa"
              onChangeText={setName}
              value={name}
              autoCapitalize="words"
            />
          </View>
        </View>

        {/* --- Biometrics --- */}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, styles.centeredLabel]}>Weight (kg)</Text>
           {/* Wrap TextInput in a View for centering */}
          <View style={styles.centeredInputContainer}>
            <TextInput
              style={[globalStyles.inputField, styles.inputFieldSizing]} // Keep text left, control width
              placeholder="e.g., 70"
              placeholderTextColor="#aaa"
              keyboardType="numeric"
              onChangeText={setWeight}
              value={weight}
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, styles.centeredLabel]}>Height (cm)</Text>
           {/* Wrap TextInput in a View for centering */}
          <View style={styles.centeredInputContainer}>
            <TextInput
              style={[globalStyles.inputField, styles.inputFieldSizing]} // Keep text left, control width
              placeholder="e.g., 175"
              placeholderTextColor="#aaa"
              keyboardType="numeric"
              onChangeText={setHeight}
              value={height}
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, styles.centeredLabel]}>Age</Text>
           {/* Wrap TextInput in a View for centering */}
          <View style={styles.centeredInputContainer}>
            <TextInput
              style={[globalStyles.inputField, styles.inputFieldSizing]} // Keep text left, control width
              placeholder="e.g., 30"
              placeholderTextColor="#aaa"
              keyboardType="numeric"
              onChangeText={setAge}
              value={age}
            />
          </View>
        </View>

        {/* --- Sex --- */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Sex</Text>
          <View style={styles.radioOptionsRow}>
            <TouchableOpacity
              style={[styles.radioButton, sex === 'male' && styles.radioButtonSelected]}
              onPress={() => { setSex('male'); setErrorMessage(''); }}
            >
              <Text style={[styles.radioText, sex === 'male' && styles.radioTextSelected]}>Male</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.radioButton, sex === 'female' && styles.radioButtonSelected]}
              onPress={() => { setSex('female'); setErrorMessage(''); }}
            >
              <Text style={[styles.radioText, sex === 'female' && styles.radioTextSelected]}>Female</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* --- Activity Level --- */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Activity Level</Text>
          {ACTIVITY_LEVELS.map((level) => (
            <TouchableOpacity
              key={level.value}
              style={[ styles.selectionButton, activityLevel === level.value && styles.selectionButtonSelected ]}
              onPress={() => { setActivityLevel(level.value); setErrorMessage(''); }}
            >
              <Text style={[ styles.selectionButtonLabel, activityLevel === level.value && styles.selectionButtonLabelSelected ]}>{level.label}</Text>
              <Text style={styles.selectionButtonDesc}>{level.description}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* --- Dietary Preferences --- */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Dietary Preferences (Optional)</Text>
           <View style={styles.dietaryContainer}>
            {DIETARY_PREFERENCES.map((pref) => (
              <TouchableOpacity
                key={pref.id}
                style={[ styles.dietaryOption, selectedDietary.includes(pref.id) && styles.dietaryOptionSelected ]}
                onPress={() => toggleDietaryPreference(pref.id)}
              >
                <Text style={[ styles.dietaryLabel, selectedDietary.includes(pref.id) && styles.dietaryLabelSelected ]}>{pref.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* --- Weight Goal --- */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Weight Goal</Text>
           {GOAL_TYPES.map((goal) => (
            <TouchableOpacity
              key={goal.value}
              style={[ styles.selectionButton, goalType === goal.value && styles.selectionButtonSelected ]}
              onPress={() => { setGoalType(goal.value); setErrorMessage(''); }}
            >
              <View style={styles.goalContent}>
                <Text style={[ styles.selectionButtonLabel, goalType === goal.value && styles.selectionButtonLabelSelected ]}>{goal.label}</Text>
                <Text style={[ styles.goalAdjustment, goalType === goal.value && styles.goalAdjustmentSelected ]}>
                  ({goal.adjustment > 0 ? '+' : ''}
                  {goal.adjustment !== 0 ? `${goal.adjustment} kcal/day` : 'Maintain'})
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* --- Error Message --- */}
        {errorMessage ? <Text style={[globalStyles.errorText, styles.errorText]}>{errorMessage}</Text> : null}

        {/* --- Submit Button (Centered) --- */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            onPress={handleProfileSubmit}
            style={[globalStyles.button, styles.submitButton]}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={globalStyles.buttonText}>Continue</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
};

// --- Styles ---
const styles = StyleSheet.create({
  scrollContainer: {
    flex: 1,
    backgroundColor: '#f9f9f9',
  },
  scrollContentContainer: {
    flexGrow: 1,
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    alignItems: 'stretch',
    justifyContent: 'flex-start',
  },
  mainTitle: {
    marginTop: 10,
    textAlign: 'center', // Center the main title as well
  },
  subtitle: {
      marginBottom: 30,
      textAlign: 'center',
      color: '#666',
  },
  inputGroup: {
    marginBottom: 25,
    width: '100%',
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  centeredLabel: {
    textAlign: 'center', // Center specific labels
  },
  // New style to center the TextInput container
  centeredInputContainer: {
    width: '100%',
    alignItems: 'center', // Center children (the TextInput) horizontally
  },
  // Style to control TextInput width and ensure left alignment
  inputFieldSizing: {
      width: '90%', // Make input slightly less than full width
      maxWidth: 400,
      textAlign: 'left', // Explicitly keep placeholder and text left-aligned
      letterSpacing: 0, // Prevent unwanted spacing
      // Inherit other styles from globalStyles.inputField
  },
  radioOptionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
  },
  radioButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#2ecc71',
    marginHorizontal: 5,
    alignItems: 'center',
    backgroundColor: '#fff',
    minWidth: 120,
  },
  radioButtonSelected: {
    backgroundColor: '#e0f8e3',
    borderColor: '#2ecc71',
  },
  radioText: {
    color: '#2ecc71',
    fontWeight: '600',
    fontSize: 15,
  },
  radioTextSelected: {
    color: '#1a8c4a',
  },
  selectionButton: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#ddd',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 10,
    alignItems: 'flex-start',
  },
  selectionButtonSelected: {
    borderColor: '#2ecc71',
    backgroundColor: '#f0fff4',
  },
  selectionButtonLabel: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#333',
  },
  selectionButtonLabelSelected: {
    color: '#2ecc71',
  },
  selectionButtonDesc: {
    fontSize: 13,
    color: '#666',
    marginTop: 3,
  },
  dietaryContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
    justifyContent: 'center'
  },
  dietaryOption: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 16,
    paddingVertical: 7,
    paddingHorizontal: 14,
    margin: 4,
    backgroundColor: '#fff',
  },
  dietaryOptionSelected: {
    backgroundColor: '#2ecc71',
    borderColor: '#2ecc71',
  },
  dietaryLabel: {
    fontSize: 14,
    color: '#555',
  },
  dietaryLabelSelected: {
    color: 'white',
    fontWeight: '500',
  },
  goalContent: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      width: '100%',
  },
  goalAdjustment: {
      fontSize: 13,
      color: '#666',
  },
  goalAdjustmentSelected: {
      color: '#2ecc71',
      fontWeight: '500',
  },
  errorText: {
      marginTop: -15,
      marginBottom: 20,
      textAlign: 'center',
      color: '#d8000c'
  },
  buttonContainer: {
    width: '100%',
    alignItems: 'center',
    marginTop: 25,
  },
  submitButton: {
     width: '85%',
     maxWidth: 320,
     paddingVertical: 15,
  }
});

export default ProfileManagementScreen;