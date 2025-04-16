// Landing Screen (app/(auth)/index.tsx)
import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import globalStyles from '../styles/globalStyles';

const LandingScreen: React.FC = () => {
  return (
    <View style={globalStyles.container}>
      <Image
        source={require('../../assets/images/MealCareLogo.png')}
        style={styles.logo}
        resizeMode="contain"
      />
      <Text style={styles.appName}>MealCare</Text>
      <Text style={styles.tagline}>Caring for You, One Bite at a Time.</Text>

      <TouchableOpacity
        onPress={() => router.push('/(auth)/signup')}
        style={globalStyles.button}
      >
        <Text style={globalStyles.buttonText}>Sign Up</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => router.push('/(auth)/login')}
        style={[globalStyles.button, styles.loginButton]}
      >
        <Text style={globalStyles.buttonText}>Login</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  logo: {
    width: 300,
    height: 300,
    marginBottom: -40,
  },
  appName: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 8,
    textAlign: 'center',
  },
  tagline: {
    fontSize: 16,
    fontStyle: 'italic',
    color: '#555',
    textAlign: 'center',
    marginBottom: 30,
    paddingHorizontal: 20,
  },
  loginButton: {
    backgroundColor: '#1d8348', // Darker green
  },
});

export default LandingScreen;