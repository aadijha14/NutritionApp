// Sign Up Screen (app/(auth)/signup.tsx)
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { router } from 'expo-router';
import globalStyles from '../styles/globalStyles';
import { auth } from '../../firebaseConfig';
import { createUserWithEmailAndPassword } from 'firebase/auth';

const SignUpScreen: React.FC = () => {
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const doDisplaySignUpFields = () => (
    <>
      <Text style={globalStyles.title}>Create Account</Text>
      <TextInput
        style={globalStyles.inputField}
        placeholder="Email"
        keyboardType="email-address"
        autoCapitalize="none"
        onChangeText={setEmail}
        value={email}
      />
      <TextInput
        style={globalStyles.inputField}
        placeholder="Password"
        secureTextEntry
        onChangeText={setPassword}
        value={password}
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

  const handleSignUp = async (email: string, password: string) => {
    if (password !== confirmPassword) {
      setErrorMessage("Passwords don't match");
      return;
    }
    
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      router.push('/(auth)/otp-verification');
    } catch (error: any) {
      setErrorMessage(error.message);
    }
  };

  return (
    <View style={globalStyles.container}>
      {doDisplaySignUpFields()}
      <TouchableOpacity
        onPress={() => handleSignUp(email, password)}
        style={globalStyles.button}
      >
        <Text style={globalStyles.buttonText}>Sign Up</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => router.push('/(auth)/')}>
        <Text style={globalStyles.link}>Already have an account? Log in</Text>
      </TouchableOpacity>
    </View>
  );
};

export default SignUpScreen;