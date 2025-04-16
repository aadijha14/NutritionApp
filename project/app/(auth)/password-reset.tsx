//(auth)/password-reset.tsx
import React, { useState, useEffect } from 'react';
import { 
    View, 
    Text, 
    TextInput, 
    TouchableOpacity, 
    StyleSheet,
    ActivityIndicator, // Added
    Alert             // Added
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router'; // Added useLocalSearchParams
import globalStyles from '../styles/globalStyles';
import axios from 'axios'; // Added

// --- Server URL ---
const SERVER_URL = 'http://172.20.10.2:4000'; // Use your actual server URL
// ---

const PasswordResetScreen: React.FC = () => {
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false); // Added loading state

  // Get the verified email passed from OTP screen
  const { email } = useLocalSearchParams<{ email: string }>();

   useEffect(() => {
    // Validate that email parameter exists
    if (!email) {
      Alert.alert("Error", "Verified email not found. Please restart the password reset process.", [
        { text: "OK", onPress: () => router.replace('/(auth)/forgot-password') } 
      ]);
      setErrorMessage('Error: Missing email parameter.');
    }
  }, [email]);


  const doDisplayPasswordResetFields = () => (
    <>
      <Text style={globalStyles.title}>Create New Password</Text>
      <Text style={globalStyles.subtitle}>Enter and confirm your new password for:</Text>
      <Text style={styles.emailText}>{email || 'your account'}</Text> 
      <TextInput
        style={globalStyles.inputField}
        placeholder="New Password (min. 6 characters)"
        secureTextEntry
        onChangeText={(text) => { setNewPassword(text); setErrorMessage(''); }}
        value={newPassword}
        editable={!loading}
      />
      <TextInput
        style={globalStyles.inputField}
        placeholder="Confirm New Password"
        secureTextEntry
        onChangeText={(text) => { setConfirmPassword(text); setErrorMessage(''); }}
        value={confirmPassword}
        editable={!loading}
      />
      {errorMessage ? <Text style={globalStyles.errorText}>{errorMessage}</Text> : null}
    </>
  );

  // Renamed function for clarity
  const handleUpdatePassword = async () => {
    // Check if email is present (verified by useEffect, but double-check)
     if (!email) {
       setErrorMessage('Error: Cannot reset password without a verified email.');
       return;
     }
     
    if (newPassword !== confirmPassword) {
      setErrorMessage("Passwords don't match");
      return;
    }
    
    if (newPassword.length < 6) {
      setErrorMessage("Password must be at least 6 characters");
      return;
    }
    
    setLoading(true);
    setErrorMessage('');

    try {
      // Call the NEW server endpoint to reset the password
      const response = await axios.post(`${SERVER_URL}/reset-password`, {
        email: email,
        newPassword: newPassword // Send email and new password
      });

      if (response.data.success) {
        Alert.alert("Success", "Your password has been updated successfully.", [
            { text: "OK", onPress: () => router.replace('/(auth)/') } // Navigate to login
        ]);
        // Optionally clear fields
        setNewPassword('');
        setConfirmPassword('');
      } else {
         // Handle server errors (e.g., user not found by admin, update failed)
         setErrorMessage(response.data.message || 'Failed to update password.');
         Alert.alert("Error", response.data.message || 'An unexpected error occurred.');
      }

    } catch (error: any) {
        console.error('Error resetting password:', error);
        setErrorMessage('Failed to connect to the server.');
        Alert.alert("Network Error", "Could not reach the server. Please check your connection.");
    } finally {
        setLoading(false);
    }
  };

  return (
    <View style={globalStyles.container}>
      {doDisplayPasswordResetFields()}
      <TouchableOpacity 
        onPress={handleUpdatePassword} 
        style={[globalStyles.button, loading && styles.buttonDisabled]}
        disabled={loading}
      >
         {loading ? (
          <ActivityIndicator size="small" color="#ffffff" />
        ) : (
           <Text style={globalStyles.buttonText}>Update Password</Text>
        )}
      </TouchableOpacity>
       {/* Optional: Add a back button if needed */}
       <TouchableOpacity onPress={() => router.back()} disabled={loading}>
            <Text style={[globalStyles.link, styles.backLink, loading && styles.linkDisabled]}>
                Cancel
            </Text>
        </TouchableOpacity>
    </View>
  );
};

// Add styles for loading state and email display
const styles = StyleSheet.create({
   emailText: {
      fontSize: 16,
      color: '#555555',
      textAlign: 'center',
      marginBottom: 20,
      fontWeight: '500',
  },
  buttonDisabled: {
    backgroundColor: '#cccccc',
  },
   linkDisabled: {
      color: '#aaaaaa', 
   },
    backLink: {
      marginTop: 15, 
   }
});


export default PasswordResetScreen;