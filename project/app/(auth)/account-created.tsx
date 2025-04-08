// Account Created Screen (app/(auth)/account-created.tsx)
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { router } from 'expo-router';
import globalStyles from '../styles/globalStyles';
import { CircleCheck as CheckCircle } from 'lucide-react-native';

const AccountCreatedScreen: React.FC = () => {
  const doDisplayAccountCreated = () => (
    <>
      <CheckCircle size={80} color="#2ecc71" style={styles.icon} />
      <Text style={globalStyles.title}>Account Created!</Text>
      <Text style={globalStyles.subtitle}>
        Your account has been successfully created. Continue to set up your profile.
      </Text>
    </>
  );

  const doRedirectToProfileManagement = () => {
    router.push('/(auth)/profile-management');
  };

  return (
    <View style={globalStyles.container}>
      {doDisplayAccountCreated()}
      <TouchableOpacity onPress={doRedirectToProfileManagement} style={globalStyles.button}>
        <Text style={globalStyles.buttonText}>Set Up Profile</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  icon: {
    marginBottom: 20,
  }
});

export default AccountCreatedScreen;