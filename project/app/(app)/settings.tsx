// Settings Screen (app/(app)/settings.tsx)
import React, { useState, useEffect, useContext } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TextInput, 
  TouchableOpacity, 
  Switch, 
  Alert,
  ActivityIndicator,
  Platform
} from 'react-native';
import { router } from 'expo-router';
import { auth, db } from '../../firebaseConfig';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { updateEmail, signOut } from 'firebase/auth';
import { ArrowLeft, Save, Mail, User, Scale, Ruler, Calendar, CircleUser as UserCircle, Activity, Heart, AtSign, Bell, Moon, LogOut } from 'lucide-react-native';
import { ThemeContext } from '../../context/ThemeContext';

interface UserSettings {
  name?: string;
  email?: string;
  weight?: number;
  height?: number;
  age?: number;
  sex?: string;
  activityLevel?: string;
  dietaryPreferences?: string[];
  tdee?: number;
  dailyCalorieTarget?: number;
  goalType?: 'maintain' | 'lose' | 'gain';
  notifications?: boolean;
  mealReminders?: boolean;
  darkMode?: boolean;
}

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

const GOAL_TYPES = [
  { value: 'lose', label: 'Lose Weight', adjustment: -500 },
  { value: 'maintain', label: 'Maintain Weight', adjustment: 0 },
  { value: 'gain', label: 'Gain Weight', adjustment: 500 }
];

const SettingsScreen: React.FC = () => {
  const [settings, setSettings] = useState<UserSettings>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDietary, setSelectedDietary] = useState<string[]>([]);
  const [editEmail, setEditEmail] = useState<boolean>(false);
  const [newEmail, setNewEmail] = useState<string>('');
  const [confirmChanges, setConfirmChanges] = useState<boolean>(false);

  const { theme, toggleTheme } = useContext(ThemeContext);
  const isDark = theme === 'dark';

  useEffect(() => {
    fetchUserSettings();
  }, []);

  const fetchUserSettings = async () => {
    if (!auth.currentUser) {
      setLoading(false);
      setError('You must be logged in to view settings');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data() as UserSettings;
        setSettings(userData);
        setSelectedDietary(userData.dietaryPreferences || []);
        setNewEmail(userData.email || auth.currentUser.email || '');
      } else {
        // If user doc doesn't exist, initialize with default values
        const defaultSettings: UserSettings = {
          email: auth.currentUser.email || '',
          notifications: true,
          mealReminders: true,
          darkMode: isDark,
          dietaryPreferences: [],
          goalType: 'maintain'
        };
        setSettings(defaultSettings);
        setNewEmail(auth.currentUser.email || '');
      }
    } catch (error) {
      console.error('Error fetching user settings:', error);
      setError('Failed to load settings. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Update darkMode setting when theme changes
  useEffect(() => {
    setSettings(prev => ({
      ...prev,
      darkMode: isDark
    }));
  }, [isDark]);

  const calculateTDEE = (
    weight: number,
    height: number,
    age: number,
    sex: string,
    activityLevel: string
  ): number => {
    // Mifflin-St Jeor Equation
    let bmr =
      sex.toLowerCase() === 'male'
        ? 10 * weight + 6.25 * height - 5 * age + 5
        : 10 * weight + 6.25 * height - 5 * age - 161;
    
    const activityOption = ACTIVITY_LEVELS.find(level => level.value === activityLevel);
    const activityMultiplier = activityOption ? activityOption.multiplier : 1.2;
    
    return Math.round(bmr * activityMultiplier);
  };

  const calculateDailyTarget = (tdee: number, goalType: string): number => {
    const goal = GOAL_TYPES.find(g => g.value === goalType);
    const adjustment = goal ? goal.adjustment : 0;
    return Math.max(1200, tdee + adjustment); // Ensure minimum healthy calorie intake
  };

  const handleSaveSettings = async () => {
    if (!auth.currentUser) {
      Alert.alert('Error', 'You must be logged in to save settings');
      return;
    }

    // Form validation
    if (settings.weight && (settings.weight < 30 || settings.weight > 300)) {
      Alert.alert('Error', 'Please enter a valid weight (30-300 kg)');
      return;
    }

    if (settings.height && (settings.height < 120 || settings.height > 250)) {
      Alert.alert('Error', 'Please enter a valid height (120-250 cm)');
      return;
    }

    if (settings.age && (settings.age < 13 || settings.age > 100)) {
      Alert.alert('Error', 'Please enter a valid age (13-100 years)');
      return;
    }

    setSaving(true);
    
    try {
      let updatedSettings = { ...settings };
      
      // Update dietary preferences
      updatedSettings.dietaryPreferences = selectedDietary;
      
      // Recalculate TDEE and daily target if biometric data changed
      if (settings.weight && settings.height && settings.age && settings.sex && settings.activityLevel) {
        const newTDEE = calculateTDEE(
          settings.weight,
          settings.height,
          settings.age,
          settings.sex,
          settings.activityLevel
        );
        
        updatedSettings.tdee = newTDEE;
        updatedSettings.dailyCalorieTarget = calculateDailyTarget(
          newTDEE, 
          settings.goalType || 'maintain'
        );
      }
      
      // Update email if changed
      if (editEmail && newEmail !== auth.currentUser.email && newEmail.trim()) {
        try {
          await updateEmail(auth.currentUser, newEmail);
          updatedSettings.email = newEmail;
        } catch (error) {
          console.error('Error updating email:', error);
          Alert.alert('Error', 'Failed to update email. You may need to reauthenticate.');
        }
      }
      
      // Save to Firestore
      await updateDoc(doc(db, 'users', auth.currentUser.uid), updatedSettings);
      
      setSettings(updatedSettings);
      Alert.alert('Success', 'Settings saved successfully');
      setEditEmail(false);
      setConfirmChanges(false);
    } catch (error) {
      console.error('Error saving settings:', error);
      Alert.alert('Error', 'Failed to save settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const toggleDietaryPreference = (id: string) => {
    if (selectedDietary.includes(id)) {
      setSelectedDietary(selectedDietary.filter(item => item !== id));
    } else {
      setSelectedDietary([...selectedDietary, id]);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      router.push('/(auth)/');
    } catch (error) {
      console.error('Error signing out:', error);
      Alert.alert('Error', 'Failed to sign out. Please try again.');
    }
  };

  const handleDarkModeToggle = (value: boolean) => {
    setSettings({...settings, darkMode: value});
    toggleTheme();
  };

  const handleConfirmChanges = () => {
    // Calculate TDEE to show preview
    if (settings.weight && settings.height && settings.age && settings.sex && settings.activityLevel) {
      const newTDEE = calculateTDEE(
        settings.weight,
        settings.height,
        settings.age,
        settings.sex,
        settings.activityLevel
      );
      
      const newDailyTarget = calculateDailyTarget(
        newTDEE, 
        settings.goalType || 'maintain'
      );
      
      Alert.alert(
        'Confirm Changes',
        `Based on your updated information:\n\nYour TDEE: ${newTDEE} calories\nYour daily target: ${newDailyTarget} calories\n\nSave these changes?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Save', onPress: handleSaveSettings }
        ]
      );
    } else {
      handleSaveSettings();
    }
  };

  const renderPersonalSection = () => (
    <View style={[styles.section, isDark && styles.sectionDark]}>
      <Text style={[styles.sectionTitle, isDark && styles.textLight]}>Profile Information</Text>
      
      <View style={styles.inputGroup}>
        <View style={styles.inputLabel}>
          <User size={16} color={isDark ? "#aaa" : "#666"} />
          <Text style={[styles.label, isDark && styles.textLight]}>Full Name</Text>
        </View>
        <TextInput
          style={[styles.input, isDark && styles.inputDark]}
          value={settings.name || ''}
          onChangeText={(text) => setSettings({...settings, name: text})}
          placeholder="Enter your name"
          placeholderTextColor={isDark ? "#777" : undefined}
        />
      </View>
      
      <View style={styles.inputGroup}>
        <View style={styles.inputLabel}>
          <Mail size={16} color={isDark ? "#aaa" : "#666"} />
          <Text style={[styles.label, isDark && styles.textLight]}>Email</Text>
          {!editEmail && (
            <TouchableOpacity 
              style={styles.editButton} 
              onPress={() => setEditEmail(true)}
            >
              <Text style={styles.editButtonText}>Edit</Text>
            </TouchableOpacity>
          )}
        </View>
        {editEmail ? (
          <View style={styles.emailEditContainer}>
            <TextInput
              style={[styles.input, styles.emailInput, isDark && styles.inputDark]}
              value={newEmail}
              onChangeText={setNewEmail}
              placeholder="Enter new email"
              placeholderTextColor={isDark ? "#777" : undefined}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <TouchableOpacity 
              style={[styles.cancelButton, isDark && styles.cancelButtonDark]}
              onPress={() => {
                setEditEmail(false);
                setNewEmail(settings.email || auth.currentUser?.email || '');
              }}
            >
              <Text style={[styles.cancelButtonText, isDark && styles.textLight]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <Text style={[styles.infoText, isDark && styles.infoTextDark]}>{settings.email || auth.currentUser?.email}</Text>
        )}
      </View>
    </View>
  );

  const renderBiometricSection = () => (
    <View style={[styles.section, isDark && styles.sectionDark]}>
      <Text style={[styles.sectionTitle, isDark && styles.textLight]}>Biometric Information</Text>
      
      <View style={styles.inputGroup}>
        <View style={styles.inputLabel}>
          <Scale size={16} color={isDark ? "#aaa" : "#666"} />
          <Text style={[styles.label, isDark && styles.textLight]}>Weight (kg)</Text>
        </View>
        <TextInput
          style={[styles.input, isDark && styles.inputDark]}
          value={settings.weight ? settings.weight.toString() : ''}
          onChangeText={(text) => {
            const weight = parseFloat(text);
            if (!isNaN(weight) || text === '') {
              setSettings({...settings, weight: text === '' ? undefined : weight});
            }
          }}
          placeholder="Enter your weight"
          placeholderTextColor={isDark ? "#777" : undefined}
          keyboardType="numeric"
        />
      </View>
      
      <View style={styles.inputGroup}>
        <View style={styles.inputLabel}>
          <Ruler size={16} color={isDark ? "#aaa" : "#666"} />
          <Text style={[styles.label, isDark && styles.textLight]}>Height (cm)</Text>
        </View>
        <TextInput
          style={[styles.input, isDark && styles.inputDark]}
          value={settings.height ? settings.height.toString() : ''}
          onChangeText={(text) => {
            const height = parseFloat(text);
            if (!isNaN(height) || text === '') {
              setSettings({...settings, height: text === '' ? undefined : height});
            }
          }}
          placeholder="Enter your height"
          placeholderTextColor={isDark ? "#777" : undefined}
          keyboardType="numeric"
        />
      </View>
      
      <View style={styles.inputGroup}>
        <View style={styles.inputLabel}>
          <Calendar size={16} color={isDark ? "#aaa" : "#666"} />
          <Text style={[styles.label, isDark && styles.textLight]}>Age</Text>
        </View>
        <TextInput
          style={[styles.input, isDark && styles.inputDark]}
          value={settings.age ? settings.age.toString() : ''}
          onChangeText={(text) => {
            const age = parseInt(text);
            if (!isNaN(age) || text === '') {
              setSettings({...settings, age: text === '' ? undefined : age});
            }
          }}
          placeholder="Enter your age"
          placeholderTextColor={isDark ? "#777" : undefined}
          keyboardType="numeric"
        />
      </View>
      
      <View style={styles.inputGroup}>
        <View style={styles.inputLabel}>
          <UserCircle size={16} color={isDark ? "#aaa" : "#666"} />
          <Text style={[styles.label, isDark && styles.textLight]}>Sex</Text>
        </View>
        <View style={styles.radioGroup}>
          <TouchableOpacity 
            style={[
              styles.radioButton, 
              settings.sex === 'male' && styles.radioButtonSelected,
              isDark && styles.radioButtonDark,
              settings.sex === 'male' && isDark && styles.radioButtonDarkSelected
            ]}
            onPress={() => setSettings({...settings, sex: 'male'})}
          >
            <Text style={[
              styles.radioText, 
              settings.sex === 'male' && styles.radioTextSelected,
              isDark && styles.radioTextDark,
              settings.sex === 'male' && isDark && styles.radioTextDarkSelected
            ]}>Male</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[
              styles.radioButton, 
              settings.sex === 'female' && styles.radioButtonSelected,
              isDark && styles.radioButtonDark,
              settings.sex === 'female' && isDark && styles.radioButtonDarkSelected
            ]}
            onPress={() => setSettings({...settings, sex: 'female'})}
          >
            <Text style={[
              styles.radioText, 
              settings.sex === 'female' && styles.radioTextSelected,
              isDark && styles.radioTextDark,
              settings.sex === 'female' && isDark && styles.radioTextDarkSelected
            ]}>Female</Text>
          </TouchableOpacity>
        </View>
      </View>
      
      <View style={styles.inputGroup}>
        <View style={styles.inputLabel}>
          <Activity size={16} color={isDark ? "#aaa" : "#666"} />
          <Text style={[styles.label, isDark && styles.textLight]}>Activity Level</Text>
        </View>
        <View style={styles.activityLevelContainer}>
          {ACTIVITY_LEVELS.map((level) => (
            <TouchableOpacity
              key={level.value}
              style={[
                styles.activityLevelButton,
                settings.activityLevel === level.value && styles.activityLevelSelected,
                isDark && styles.activityLevelButtonDark,
                settings.activityLevel === level.value && isDark && styles.activityLevelDarkSelected
              ]}
              onPress={() => setSettings({...settings, activityLevel: level.value})}
            >
              <View style={styles.activityLevelHeader}>
                <Text style={[
                  styles.activityLevelLabel,
                  settings.activityLevel === level.value && styles.activityLevelLabelSelected,
                  isDark && styles.textLight
                ]}>{level.label}</Text>
              </View>
              <Text style={[
                styles.activityLevelDesc, 
                isDark && styles.activityLevelDescDark
              ]}>{level.description}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );

  const renderNutritionSection = () => (
    <View style={[styles.section, isDark && styles.sectionDark]}>
      <Text style={[styles.sectionTitle, isDark && styles.textLight]}>Nutrition Settings</Text>
      
      <View style={styles.inputGroup}>
        <View style={styles.inputLabel}>
          <Heart size={16} color={isDark ? "#aaa" : "#666"} />
          <Text style={[styles.label, isDark && styles.textLight]}>Dietary Preferences</Text>
        </View>
        <View style={styles.dietaryContainer}>
          {DIETARY_PREFERENCES.map((pref) => (
            <TouchableOpacity
              key={pref.id}
              style={[
                styles.dietaryOption,
                selectedDietary.includes(pref.id) && styles.dietaryOptionSelected,
                isDark && styles.dietaryOptionDark,
                selectedDietary.includes(pref.id) && isDark && styles.dietaryOptionDarkSelected
              ]}
              onPress={() => toggleDietaryPreference(pref.id)}
            >
              <Text style={[
                styles.dietaryLabel,
                selectedDietary.includes(pref.id) && styles.dietaryLabelSelected,
                isDark && styles.dietaryLabelDark,
                selectedDietary.includes(pref.id) && isDark && styles.dietaryLabelDarkSelected
              ]}>{pref.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      
      <View style={styles.inputGroup}>
        <View style={styles.inputLabel}>
          <Activity size={16} color={isDark ? "#aaa" : "#666"} />
          <Text style={[styles.label, isDark && styles.textLight]}>Weight Goal</Text>
        </View>
        <View style={styles.goalTypeContainer}>
          {GOAL_TYPES.map((goal) => (
            <TouchableOpacity
              key={goal.value}
              style={[
                styles.goalTypeButton,
                settings.goalType === goal.value && styles.goalTypeSelected,
                isDark && styles.goalTypeButtonDark,
                settings.goalType === goal.value && isDark && styles.goalTypeDarkSelected
              ]}
              onPress={() => setSettings({...settings, goalType: goal.value as any})}
            >
              <Text style={[
                styles.goalTypeLabel,
                settings.goalType === goal.value && styles.goalTypeLabelSelected,
                isDark && styles.goalTypeLabelDark,
                settings.goalType === goal.value && isDark && styles.goalTypeLabelDarkSelected
              ]}>{goal.label}</Text>
              <Text style={[
                styles.goalTypeAdjustment,
                isDark && styles.goalTypeAdjustmentDark
              ]}>
                {goal.adjustment > 0 ? '+' : ''}
                {goal.adjustment !== 0 ? `${goal.adjustment} cal/day` : 'No adjustment'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      
      <View style={[styles.infoCard, isDark && styles.infoCardDark]}>
        <Text style={[styles.infoTitle, isDark && styles.infoTitleDark]}>Current Nutritional Information</Text>
        <View style={styles.infoRow}>
          <Text style={[styles.infoLabel, isDark && styles.textLight]}>TDEE (Total Daily Energy Expenditure):</Text>
          <Text style={[styles.infoValue, isDark && styles.infoValueDark]}>{settings.tdee || '—'} cal</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={[styles.infoLabel, isDark && styles.textLight]}>Daily Target:</Text>
          <Text style={[styles.infoValue, isDark && styles.infoValueDark]}>{settings.dailyCalorieTarget || '—'} cal</Text>
        </View>
        <Text style={[styles.infoNote, isDark && styles.infoNoteDark]}>
          Update your biometric information to recalculate these values.
        </Text>
      </View>
    </View>
  );

  const renderAppSection = () => (
    <View style={[styles.section, isDark && styles.sectionDark]}>
      <Text style={[styles.sectionTitle, isDark && styles.textLight]}>App Settings</Text>
      
      <View style={styles.settingRow}>
        <View style={styles.settingInfo}>
          <Bell size={18} color={isDark ? "#aaa" : "#666"} />
          <Text style={[styles.settingLabel, isDark && styles.textLight]}>Notifications</Text>
        </View>
        <Switch
          value={settings.notifications || false}
          onValueChange={(value) => setSettings({...settings, notifications: value})}
          trackColor={{ false: isDark ? '#555' : '#ddd', true: '#2ecc7199' }}
          thumbColor={settings.notifications ? '#2ecc71' : isDark ? '#888' : '#f4f3f4'}
          ios_backgroundColor={isDark ? '#555' : '#ddd'}
        />
      </View>
      
      <View style={styles.settingRow}>
        <View style={styles.settingInfo}>
          <AtSign size={18} color={isDark ? "#aaa" : "#666"} />
          <Text style={[styles.settingLabel, isDark && styles.textLight]}>Meal Reminders</Text>
        </View>
        <Switch
          value={settings.mealReminders || false}
          onValueChange={(value) => setSettings({...settings, mealReminders: value})}
          trackColor={{ false: isDark ? '#555' : '#ddd', true: '#2ecc7199' }}
          thumbColor={settings.mealReminders ? '#2ecc71' : isDark ? '#888' : '#f4f3f4'}
          ios_backgroundColor={isDark ? '#555' : '#ddd'}
        />
      </View>
      
      <View style={styles.settingRow}>
        <View style={styles.settingInfo}>
          <Moon size={18} color={isDark ? "#aaa" : "#666"} />
          <Text style={[styles.settingLabel, isDark && styles.textLight]}>Dark Mode</Text>
        </View>
        <Switch
          value={settings.darkMode || false}
          onValueChange={handleDarkModeToggle}
          trackColor={{ false: isDark ? '#555' : '#ddd', true: '#2ecc7199' }}
          thumbColor={settings.darkMode ? '#2ecc71' : isDark ? '#888' : '#f4f3f4'}
          ios_backgroundColor={isDark ? '#555' : '#ddd'}
        />
      </View>
      
      <TouchableOpacity 
        style={[styles.logoutButton, isDark && styles.logoutButtonDark]}
        onPress={handleSignOut}
      >
        <LogOut size={18} color="#ff6b6b" />
        <Text style={styles.logoutText}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.loadingContainer, isDark && styles.containerDark]}>
        <ActivityIndicator size="large" color="#2ecc71" />
        <Text style={[styles.loadingText, isDark && styles.textLight]}>Loading settings...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
      <View style={[styles.header, isDark && styles.headerDark]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.push('/(app)/dashboard')}
        >
          <ArrowLeft size={24} color="#2ecc71" />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, isDark && styles.textLight]}>Settings</Text>
        <TouchableOpacity
          style={styles.saveButton}
          onPress={handleConfirmChanges}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#2ecc71" />
          ) : (
            <Save size={24} color="#2ecc71" />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 90 }]} // Extra padding for tab bar
      >
        {error && (
          <View style={[styles.errorContainer, isDark && styles.errorContainerDark]}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={fetchUserSettings}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {renderPersonalSection()}
        {renderBiometricSection()}
        {renderNutritionSection()}
        {renderAppSection()}
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  section: {
    marginTop: 16,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  sectionDark: {
    backgroundColor: '#1e1e1e',
    shadowColor: '#000',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2ecc71',
    marginBottom: 16,
  },
  textLight: {
    color: '#f2f2f2',
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginLeft: 8,
  },
  input: {
    backgroundColor: '#f5f5f5',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#eee',
  },
  inputDark: {
    backgroundColor: '#2a2a2a',
    borderColor: '#333',
    color: '#f2f2f2',
  },
  radioGroup: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  radioButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2ecc71',
    marginRight: 12,
  },
  radioButtonDark: {
    borderColor: '#2ecc71',
    backgroundColor: '#2a2a2a',
  },
  radioButtonSelected: {
    backgroundColor: '#2ecc71',
  },
  radioButtonDarkSelected: {
    backgroundColor: '#2ecc71',
  },
  radioText: {
    color: '#2ecc71',
    fontWeight: '500',
  },
  radioTextDark: {
    color: '#2ecc71',
  },
  radioTextSelected: {
    color: 'white',
  },
  radioTextDarkSelected: {
    color: 'white',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    color: '#666',
    fontSize: 16,
  },
  errorContainer: {
    margin: 16,
    padding: 16,
    backgroundColor: '#ffe0e0',
    borderRadius: 8,
    alignItems: 'center',
  },
  errorContainerDark: {
    backgroundColor: '#4e2c2c',
  },
  errorText: {
    color: '#d63031',
    marginBottom: 8,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#2ecc71',
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 20,
  },
  retryButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  activityLevelContainer: {
    marginTop: 8,
  },
  activityLevelButton: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#eee',
    padding: 12,
    marginBottom: 8,
  },
  activityLevelButtonDark: {
    backgroundColor: '#2a2a2a',
    borderColor: '#333',
  },
  activityLevelSelected: {
    borderColor: '#2ecc71',
    backgroundColor: '#f0fff4',
  },
  activityLevelDarkSelected: {
    borderColor: '#2ecc71',
    backgroundColor: '#1c3427',
  },
  activityLevelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  activityLevelLabel: {
    fontWeight: 'bold',
    color: '#333',
  },
  activityLevelLabelSelected: {
    color: '#2ecc71',
  },
  activityLevelDesc: {
    fontSize: 12,
    color: '#666',
  },
  activityLevelDescDark: {
    color: '#aaa',
  },
  dietaryContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  dietaryOption: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginRight: 8,
    marginBottom: 8,
  },
  dietaryOptionDark: {
    borderColor: '#444',
  },
  dietaryOptionSelected: {
    backgroundColor: '#2ecc71',
    borderColor: '#2ecc71',
  },
  dietaryOptionDarkSelected: {
    backgroundColor: '#2ecc71',
    borderColor: '#2ecc71',
  },
  dietaryLabel: {
    fontSize: 14,
    color: '#666',
  },
  dietaryLabelDark: {
    color: '#ddd',
  },
  dietaryLabelSelected: {
    color: 'white',
    fontWeight: '500',
  },
  dietaryLabelDarkSelected: {
    color: 'white',
    fontWeight: '500',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingLabel: {
    fontSize: 16,
    marginLeft: 12,
    color: '#333',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#fff0f0',
  },
  logoutButtonDark: {
    backgroundColor: '#432626',
  },
  logoutText: {
    color: '#ff6b6b',
    fontWeight: 'bold',
    marginLeft: 8,
  },
  infoCard: {
    backgroundColor: '#f0f9ff',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  infoCardDark: {
    backgroundColor: '#1a2a35',
  },
  infoTitle: {
    fontWeight: 'bold',
    color: '#0984e3',
    marginBottom: 8,
  },
  infoTitleDark: {
    color: '#64b5f6',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  infoLabel: {
    color: '#333',
  },
  infoValue: {
    fontWeight: 'bold',
    color: '#0984e3',
  },
  infoValueDark: {
    color: '#64b5f6',
  },
  infoNote: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 8,
  },
  infoNoteDark: {
    color: '#aaa',
  },
  infoText: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    fontSize: 16,
    color: '#666',
  },
  infoTextDark: {
    backgroundColor: '#2a2a2a',
    color: '#ddd',
  },
  editButton: {
    marginLeft: 'auto',
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
  },
  editButtonText: {
    fontSize: 12,
    color: '#2ecc71',
    fontWeight: 'bold',
  },
  emailEditContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  emailInput: {
    flex: 1,
    marginRight: 8,
  },
  cancelButton: {
    paddingHorizontal: 10,
    paddingVertical: 12,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
  },
  cancelButtonDark: {
    backgroundColor: '#2a2a2a',
  },
  cancelButtonText: {
    fontSize: 14,
    color: '#666',
  },
  goalTypeContainer: {
    marginTop: 8,
  },
  goalTypeButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#eee',
    padding: 12,
    marginBottom: 8,
  },
  goalTypeButtonDark: {
    backgroundColor: '#2a2a2a',
    borderColor: '#333',
  },
  goalTypeSelected: {
    borderColor: '#2ecc71',
    backgroundColor: '#f0fff4',
  },
  goalTypeDarkSelected: {
    borderColor: '#2ecc71',
    backgroundColor: '#1c3427',
  },
  goalTypeLabel: {
    fontWeight: 'bold',
    color: '#333',
  },
  goalTypeLabelDark: {
    color: '#f2f2f2',
  },
  goalTypeLabelSelected: {
    color: '#2ecc71',
  },
  goalTypeLabelDarkSelected: {
    color: '#2ecc71',
  },
  goalTypeAdjustment: {
    fontSize: 14,
    color: '#666',
  },
  goalTypeAdjustmentDark: {
    color: '#aaa',
  },
});

export default SettingsScreen;