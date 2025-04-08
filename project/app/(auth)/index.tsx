// Landing Screen (app/(auth)/index.tsx)
import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import globalStyles from '../styles/globalStyles';

const LandingScreen: React.FC = () => {
  const doDisplayLanding = () => (
    <>
      <Text style={globalStyles.title}>Nutrition Tracker</Text>
      <Text style={globalStyles.subtitle}>
        Track your meals, monitor your nutrition, and reach your health goals
      </Text>
      <Image 
        source={{ uri: 'https://images.unsplash.com/photo-1490818387583-1baba5e638af?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80' }} 
        style={styles.image} 
      />
    </>
  );

  return (
    <View style={globalStyles.container}>
      {doDisplayLanding()}
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
  image: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginBottom: 24,
    maxWidth: 350,
  },
  loginButton: {
    backgroundColor: '#1d8348', // Darker green for distinction
  }
});

export default LandingScreen;