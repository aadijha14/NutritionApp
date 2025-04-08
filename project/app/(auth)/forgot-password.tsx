// Forgot Password Screen (app/(auth)/forgot-password.tsx)
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import globalStyles from '../styles/globalStyles';
import { auth } from '../../firebaseConfig';
import { sendPasswordResetEmail } from 'firebase/auth';

const ForgotPasswordScreen: React.FC = () => {
  const [forgotEmail, setForgotEmail] = useState<string>('');
  const [status, setStatus] = useState<{ message: string; isError: boolean } | null>(null);

  const doDisplayPasswordResetOptions = () => (
    <>
      <Text style={globalStyles.title}>Reset Password</Text>
      <Text style={globalStyles.subtitle}>Enter your email to receive a password reset link</Text>
      <TextInput
        style={globalStyles.inputField}
        placeholder="Enter your email"
        keyboardType="email-address"
        autoCapitalize="none"
        onChangeText={setForgotEmail}
        value={forgotEmail}
      />
      {status && (
        <Text style={status.isError ? globalStyles.errorText : styles.successText}>
          {status.message}
        </Text>
      )}
    </>
  );

  const handleForgotPassword = async () => {
    if (!forgotEmail.trim()) {
      setStatus({ message: 'Please enter your email', isError: true });
      return;
    }
    
    try {
      await sendPasswordResetEmail(auth, forgotEmail);
      setStatus({ 
        message: 'Password reset email sent. Please check your inbox.', 
        isError: false 
      });
      setTimeout(() => {
        router.push('/(auth)/password-reset');
      }, 2000);
    } catch (error: any) {
      setStatus({ message: error.message, isError: true });
    }
  };

  return (
    <View style={globalStyles.container}>
      {doDisplayPasswordResetOptions()}
      <TouchableOpacity onPress={handleForgotPassword} style={globalStyles.button}>
        <Text style={globalStyles.buttonText}>Reset Password</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
        <Text style={globalStyles.link}>Back to Login</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  successText: {
    color: '#2ecc71',
    marginVertical: 8,
    textAlign: 'center',
  }
});

export default ForgotPasswordScreen;