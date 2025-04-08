// Password Reset Screen (app/(auth)/password-reset.tsx)
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import globalStyles from '../styles/globalStyles';
import { auth } from '../../firebaseConfig';
import { updatePassword } from 'firebase/auth';

const PasswordResetScreen: React.FC = () => {
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const doDisplayPasswordResetFields = () => (
    <>
      <Text style={globalStyles.title}>Create New Password</Text>
      <Text style={globalStyles.subtitle}>Please enter and confirm your new password</Text>
      <TextInput
        style={globalStyles.inputField}
        placeholder="New Password"
        secureTextEntry
        onChangeText={setNewPassword}
        value={newPassword}
      />
      <TextInput
        style={globalStyles.inputField}
        placeholder="Confirm Password"
        secureTextEntry
        onChangeText={setConfirmPassword}
        value={confirmPassword}
      />
      {errorMessage ? <Text style={globalStyles.errorText}>{errorMessage}</Text> : null}
    </>
  );

  const handlePasswordReset = async (newPassword: string) => {
    if (newPassword !== confirmPassword) {
      setErrorMessage("Passwords don't match");
      return;
    }
    
    if (newPassword.length < 6) {
      setErrorMessage("Password must be at least 6 characters");
      return;
    }
    
    if (auth.currentUser) {
      try {
        await updatePassword(auth.currentUser, newPassword);
        router.push('/(app)/dashboard');
      } catch (error: any) {
        setErrorMessage(error.message);
      }
    } else {
      // For demo purposes (since we might not have a signed-in user)
      setErrorMessage("Please login first to reset your password");
      setTimeout(() => {
        router.push('/(auth)/login');
      }, 2000);
    }
  };

  return (
    <View style={globalStyles.container}>
      {doDisplayPasswordResetFields()}
      <TouchableOpacity 
        onPress={() => handlePasswordReset(newPassword)} 
        style={globalStyles.button}
      >
        <Text style={globalStyles.buttonText}>Update Password</Text>
      </TouchableOpacity>
    </View>
  );
};

export default PasswordResetScreen;