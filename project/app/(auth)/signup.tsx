// Sign Up Screen (app/(auth)/signup.tsx) - Restored UI, Integrated OTP Logic

import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  // Removed Image import as it wasn't used in the original provided code
  ActivityIndicator, // Added for loading state
  Alert             // Added for error alerts
} from 'react-native';
import { router } from 'expo-router';
import globalStyles from '../styles/globalStyles';
import { auth } from '../../firebaseConfig';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import axios from 'axios'; // Added for server calls

// --- Ensure this is your correct server URL ---
const SERVER_URL = 'http://172.20.10.2:4000'; 
// ---

const SignUpScreen: React.FC = () => {
  // Original State Variables
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  
  // State Variable needed for OTP logic
  const [loading, setLoading] = useState<boolean>(false); 

  // --- Original UI Structure ---
  const doDisplaySignUpFields = () => (
    <>
      <Text style={globalStyles.title}>Create Account</Text>
      <TextInput
        style={globalStyles.inputField}
        placeholder="Email" // Restored original placeholder
        keyboardType="email-address"
        autoCapitalize="none"
        onChangeText={setEmail} // Restored original onChangeText
        value={email}
        editable={!loading} // Disable input while loading
      />
      <TextInput
        style={globalStyles.inputField}
        placeholder="Password" // Restored original placeholder
        secureTextEntry
        onChangeText={setPassword} // Restored original onChangeText
        value={password}
        editable={!loading} // Disable input while loading
      />
      <TextInput
        style={globalStyles.inputField}
        placeholder="Confirm Password" // Restored original placeholder
        secureTextEntry
        onChangeText={setConfirmPassword} // Restored original onChangeText
        value={confirmPassword}
        editable={!loading} // Disable input while loading
      />
      {errorMessage ? <Text style={globalStyles.errorText}>{errorMessage}</Text> : null}
    </>
  );

  // --- Updated handleSignUp incorporating OTP logic ---
  const handleSignUp = async (/* Removed parameters as we use state directly */) => {
    // --- Validation from new version ---
    if (!email.trim() || !password || !confirmPassword) {
      setErrorMessage('Please fill in all fields.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage("Passwords don't match");
      return;
    }
     // Optional: Add password length check if desired
    if (password.length < 6) {
      setErrorMessage("Password must be at least 6 characters long.");
      return;
    }
    // --- End Validation ---

    setLoading(true);
    setErrorMessage(''); // Clear previous errors

    try {
      // Step 1: Create the user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      console.log('Firebase user created:', userCredential.user.uid);

      // Step 2: Request OTP email from your server
      try {
        const response = await axios.post(`${SERVER_URL}/send-otp`, {
          email: email,
          purpose: 'signup' // Indicate the reason for the OTP
        });

        if (response.data.success) {
          console.log('OTP email sent request successful');
          // Step 3: Navigate to OTP verification screen, passing the email
          router.push({
            pathname: '/(auth)/otp-verification',
            params: { email: email } // Pass email as parameter
          });
        } else {
          // Handle server-side error (e.g., email sending failed)
          const serverMsg = response.data.message || 'Failed to send verification email.';
          setErrorMessage(serverMsg);
          // Optional: Consider deleting the Firebase user if OTP sending fails critically
          // await userCredential.user.delete();
          Alert.alert("Signup Error", `${serverMsg} Please try signing up again later.`);
        }

      } catch (serverError: any) {
        console.error('Server error sending OTP:', serverError);
        const errMsg = 'Failed to connect to verification server. Please check network and try again.';
        setErrorMessage(errMsg);
         // Optional: Consider deleting the Firebase user if OTP sending fails critically
         // await userCredential.user.delete();
        Alert.alert("Network Error", errMsg);
      }

    } catch (authError: any) {
      // Handle Firebase Auth errors (e.g., email already in use)
      console.error('Firebase Auth error:', authError);
      if (authError.code === 'auth/email-already-in-use') {
        setErrorMessage('This email address is already registered.');
      } else if (authError.code === 'auth/invalid-email') {
         setErrorMessage('Please enter a valid email address.');
      } else {
        setErrorMessage(authError.message || 'An unexpected error occurred during sign up.');
      }
    } finally {
      setLoading(false); // Ensure loading is turned off
    }
  };

  // --- Original Return Structure with modifications for loading state ---
  return (
    <View style={globalStyles.container}>
      {doDisplaySignUpFields()}
      
      {/* Main Sign Up Button */}
      <TouchableOpacity
        onPress={handleSignUp} // Call the updated handler
        style={[globalStyles.button, loading && styles.buttonDisabled]} // Apply disabled style when loading
        disabled={loading} // Disable button when loading
      >
        {loading ? (
          <ActivityIndicator size="small" color="#ffffff" /> // Show spinner when loading
        ) : (
          <Text style={globalStyles.buttonText}>Sign Up</Text> // Original button text
        )}
      </TouchableOpacity>
      
      {/* Link to Login */}
      <TouchableOpacity 
        onPress={() => router.push('/(auth)/')} 
        disabled={loading} // Disable link when loading
      >
        <Text style={globalStyles.link}>Already have an account? Log in</Text>
      </TouchableOpacity>
    </View>
  );
};

// --- Styles needed for loading state ---
const styles = StyleSheet.create({
  buttonDisabled: {
    backgroundColor: '#cccccc', // Style for button when disabled/loading
  }
});


export default SignUpScreen;