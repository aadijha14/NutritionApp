// Login Screen (app/(auth)/login.tsx)
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import globalStyles from '../styles/globalStyles';
import { auth } from '../../firebaseConfig';
import { signInWithEmailAndPassword } from 'firebase/auth';

const LoginScreen: React.FC = () => {
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const doDisplayLoginFields = () => (
    <>
      <Text style={globalStyles.title}>Welcome Back</Text>
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
      {errorMessage ? <Text style={globalStyles.errorText}>{errorMessage}</Text> : null}
    </>
  );

  const handleLogin = async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push('/(app)/dashboard');
    } catch (error: any) {
      setErrorMessage(error.message);
    }
  };

  return (
    <View style={globalStyles.container}>
      {doDisplayLoginFields()}
      <TouchableOpacity 
        onPress={() => handleLogin(email, password)} 
        style={globalStyles.button}
      >
        <Text style={globalStyles.buttonText}>Login</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => router.push('/(auth)/forgot-password')}>
        <Text style={globalStyles.link}>Forgot Password?</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => router.push('/(auth)/signup')}>
        <Text style={globalStyles.link}>Don't have an account? Sign Up</Text>
      </TouchableOpacity>
    </View>
  );
};

export default LoginScreen;