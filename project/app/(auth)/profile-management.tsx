// Profile Management Screen (app/(auth)/profile-management.tsx)
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { router } from 'expo-router';
import globalStyles from '../styles/globalStyles';
import { db, auth } from '../../firebaseConfig';
import { doc, setDoc } from 'firebase/firestore';

const ProfileManagementScreen: React.FC = () => {
  const [weight, setWeight] = useState<string>('');
  const [height, setHeight] = useState<string>('');
  const [age, setAge] = useState<string>('');
  const [sex, setSex] = useState<string>('');
  const [activityLevel, setActivityLevel] = useState<string>('');
  const [tdee, setTdee] = useState<number>(0);
  const [dailyCalorieTarget, setDailyCalorieTarget] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const doDisplayProfileFields = () => (
    <>
      <Text style={globalStyles.title}>Complete Your Profile</Text>
      <Text style={globalStyles.subtitle}>Let's set up your nutrition profile to get personalized recommendations</Text>
      
      <TextInput
        style={globalStyles.inputField}
        placeholder="Weight (kg)"
        keyboardType="numeric"
        onChangeText={setWeight}
        value={weight}
      />
      <TextInput
        style={globalStyles.inputField}
        placeholder="Height (cm)"
        keyboardType="numeric"
        onChangeText={setHeight}
        value={height}
      />
      <TextInput
        style={globalStyles.inputField}
        placeholder="Age"
        keyboardType="numeric"
        onChangeText={setAge}
        value={age}
      />
      
      <View style={styles.radioGroup}>
        <Text style={styles.label}>Sex:</Text>
        <View style={styles.radioOptions}>
          <TouchableOpacity 
            style={[styles.radioButton, sex === 'male' && styles.radioButtonSelected]} 
            onPress={() => setSex('male')}
          >
            <Text style={[styles.radioText, sex === 'male' && styles.radioTextSelected]}>Male</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.radioButton, sex === 'female' && styles.radioButtonSelected]} 
            onPress={() => setSex('female')}
          >
            <Text style={[styles.radioText, sex === 'female' && styles.radioTextSelected]}>Female</Text>
          </TouchableOpacity>
        </View>
      </View>
      
      <View style={styles.radioGroup}>
        <Text style={styles.label}>Activity Level:</Text>
        <TouchableOpacity 
          style={[styles.activityButton, activityLevel === 'sedentary' && styles.activityButtonSelected]} 
          onPress={() => setActivityLevel('sedentary')}
        >
          <Text style={styles.activityButtonText}>Sedentary</Text>
          <Text style={styles.activityDescription}>Little or no exercise</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.activityButton, activityLevel === 'light' && styles.activityButtonSelected]} 
          onPress={() => setActivityLevel('light')}
        >
          <Text style={styles.activityButtonText}>Light</Text>
          <Text style={styles.activityDescription}>Light exercise 1-3 days/week</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.activityButton, activityLevel === 'moderate' && styles.activityButtonSelected]} 
          onPress={() => setActivityLevel('moderate')}
        >
          <Text style={styles.activityButtonText}>Moderate</Text>
          <Text style={styles.activityDescription}>Moderate exercise 3-5 days/week</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.activityButton, activityLevel === 'active' && styles.activityButtonSelected]} 
          onPress={() => setActivityLevel('active')}
        >
          <Text style={styles.activityButtonText}>Active</Text>
          <Text style={styles.activityDescription}>Hard exercise 6-7 days/week</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.activityButton, activityLevel === 'veryActive' && styles.activityButtonSelected]} 
          onPress={() => setActivityLevel('veryActive')}
        >
          <Text style={styles.activityButtonText}>Very Active</Text>
          <Text style={styles.activityDescription}>Very hard exercise and physical job</Text>
        </TouchableOpacity>
      </View>
      
      {errorMessage ? <Text style={globalStyles.errorText}>{errorMessage}</Text> : null}
    </>
  );

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
    
    let activityMultiplier = 1;
    switch (activityLevel.toLowerCase()) {
      case 'sedentary':
        activityMultiplier = 1.2;
        break;
      case 'light':
        activityMultiplier = 1.375;
        break;
      case 'moderate':
        activityMultiplier = 1.55;
        break;
      case 'active':
        activityMultiplier = 1.725;
        break;
      case 'veryactive':
        activityMultiplier = 1.9;
        break;
      default:
        activityMultiplier = 1.2;
    }
    
    return Math.round(bmr * activityMultiplier);
  };

  const handleProfileSubmit = async () => {
    if (!weight || !height || !age || !sex || !activityLevel) {
      setErrorMessage('Please fill all fields');
      return;
    }
    
    const weightNum = parseFloat(weight);
    const heightNum = parseFloat(height);
    const ageNum = parseFloat(age);
    
    if (isNaN(weightNum) || isNaN(heightNum) || isNaN(ageNum)) {
      setErrorMessage('Please enter valid numbers');
      return;
    }
    
    const calculatedTDEE = calculateTDEE(weightNum, heightNum, ageNum, sex, activityLevel);
    setTdee(calculatedTDEE);
    setDailyCalorieTarget(calculatedTDEE);

    if (auth.currentUser) {
      try {
        await setDoc(doc(db, 'users', auth.currentUser.uid), {
          email: auth.currentUser.email,
          weight: weightNum,
          height: heightNum,
          age: ageNum,
          sex,
          activityLevel,
          tdee: calculatedTDEE,
          dailyCalorieTarget: calculatedTDEE,
        });
        router.push('/(app)/dashboard');
      } catch (error: any) {
        setErrorMessage(error.message);
      }
    } else {
      // For demo purposes (since we might not have a signed-in user)
      router.push('/(app)/dashboard');
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer}>
      <View style={[globalStyles.container, styles.contentContainer]}>
        {doDisplayProfileFields()}
        <TouchableOpacity onPress={handleProfileSubmit} style={[globalStyles.button, styles.submitButton]}>
          <Text style={globalStyles.buttonText}>Save Profile</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
  },
  contentContainer: {
    paddingVertical: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    marginVertical: 8,
    color: '#444',
  },
  radioGroup: {
    width: '100%',
    maxWidth: 300,
    marginVertical: 8,
  },
  radioOptions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  radioButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2ecc71',
    flex: 1,
    marginHorizontal: 5,
    alignItems: 'center',
  },
  radioButtonSelected: {
    backgroundColor: '#2ecc71',
  },
  radioText: {
    color: '#2ecc71',
    fontWeight: 'bold',
  },
  radioTextSelected: {
    color: 'white',
  },
  activityButton: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2ecc71',
    marginVertical: 4,
  },
  activityButtonSelected: {
    backgroundColor: '#2ecc71',
  },
  activityButtonText: {
    fontWeight: 'bold',
    color: '#2ecc71',
  },
  activityDescription: {
    fontSize: 12,
    color: '#555',
    marginTop: 2,
  },
  submitButton: {
    marginTop: 20,
  }
});

export default ProfileManagementScreen;