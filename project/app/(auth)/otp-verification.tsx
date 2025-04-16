//(auth)/otp-verification.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import globalStyles from '../styles/globalStyles';
import axios from 'axios';

// --- Server URL ---
const SERVER_URL = 'http://172.20.10.2:4000'; // Use your actual server URL
// ---

const OTPVerificationScreen: React.FC = () => {
  const [otpCode, setOtpCode] = useState<string>('');
  const [verificationStatus, setVerificationStatus] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [resendLoading, setResendLoading] = useState<boolean>(false);

  // Get parameters passed from previous screen
  const { email, purpose } = useLocalSearchParams<{ email: string; purpose: string }>();

  useEffect(() => {
    // Validate required parameters
    if (!email || !purpose) {
      Alert.alert("Error", "Required information (email or purpose) missing. Please start the process again.", [
        { text: "OK", onPress: () => router.replace('/(auth)/') } // Go back to login/signup choice
      ]);
      setVerificationStatus('Error: Missing required parameters.');
    } else if (purpose !== 'signup' && purpose !== 'reset') {
       Alert.alert("Error", "Invalid purpose specified. Please start the process again.", [
        { text: "OK", onPress: () => router.replace('/(auth)/') } 
      ]);
       setVerificationStatus('Error: Invalid purpose.');
    }
  }, [email, purpose]);

  const getTitle = () => {
    return purpose === 'reset' ? 'Verify Email for Reset' : 'Verify Your Account';
  }

  const getButtonText = () => {
      return purpose === 'reset' ? 'Verify for Reset' : 'Verify Account';
  }


  const doDisplayOTPInputFields = () => (
    <>
      <Text style={globalStyles.title}>{getTitle()}</Text>
      <Text style={globalStyles.subtitle}>
        Enter the 6-digit verification code sent to:
      </Text>
      <Text style={styles.emailText}>{email || 'your email'}</Text>
      <TextInput
        style={[globalStyles.inputField, styles.otpInput]}
        placeholder="------"
        placeholderTextColor="#cccccc"
        keyboardType="numeric"
        maxLength={6}
        onChangeText={(text) => { setOtpCode(text); setVerificationStatus(''); }}
        value={otpCode}
        textContentType="oneTimeCode"
        autoFocus={true}
      />
      {verificationStatus ? <Text style={globalStyles.errorText}>{verificationStatus}</Text> : null}
    </>
  );

  const handleVerifyOTP = async () => {
    if (!email || !purpose) {
       setVerificationStatus('Error: Missing required parameters.');
       return;
    }
    if (otpCode.length !== 6) {
      setVerificationStatus('Please enter the 6-digit code');
      return;
    }

    setLoading(true);
    setVerificationStatus('');

    try {
      const response = await axios.post(`${SERVER_URL}/verify-otp`, {
        email: email,
        otp: otpCode,
        // Optionally send purpose if server needs it for different validation logic
        // purpose: purpose 
      });

      if (response.data.success) {
        console.log(`OTP verified successfully for purpose: ${purpose}`);
        
        // Navigate based on the purpose
        if (purpose === 'signup') {
            router.replace('/(auth)/account-created'); 
        } else if (purpose === 'reset') {
            // Navigate to password reset screen, passing the verified email
            router.replace({
               pathname: '/(auth)/password-reset',
               params: { email: email } 
            });
        } else {
             // Should not happen due to useEffect check, but handle defensively
             setVerificationStatus('Error: Unknown purpose after verification.');
        }

      } else {
        setVerificationStatus(response.data.message || 'Invalid or expired OTP.');
      }
    } catch (error: any) {
      console.error('Server error verifying OTP:', error);
      setVerificationStatus('Failed to connect to verification server.');
      Alert.alert("Network Error", "Could not reach the verification server. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (!email || !purpose) {
       setVerificationStatus('Error: Missing required parameters.');
       return;
    }
    setResendLoading(true);
    setVerificationStatus('');

    try {
        // Send the correct purpose to the server
        const response = await axios.post(`${SERVER_URL}/send-otp`, {
          email: email,
          purpose: purpose // Pass the original purpose ('signup' or 'reset')
        });

        if (response.data.success) {
          setVerificationStatus('A new verification code has been sent.');
          setOtpCode('');
        } else {
          setVerificationStatus(response.data.message || 'Failed to resend OTP.');
           Alert.alert("Error", "Could not resend verification email. Please try again later.");
        }

      } catch (serverError: any) {
        console.error('Server error resending OTP:', serverError);
        setVerificationStatus('Failed to connect to verification server.');
         Alert.alert("Network Error", "Could not reach the verification server. Please check your connection and try again.");
      } finally {
          setResendLoading(false);
      }
  };


  return (
    <View style={globalStyles.container}>
      {doDisplayOTPInputFields()}
      <TouchableOpacity
        onPress={handleVerifyOTP}
        style={[globalStyles.button, loading && styles.buttonDisabled]}
        disabled={loading || resendLoading}
      >
        {loading ? (
           <ActivityIndicator size="small" color="#ffffff" />
        ) : (
          <Text style={globalStyles.buttonText}>{getButtonText()}</Text> // Dynamic button text
        )}
      </TouchableOpacity>
      <TouchableOpacity onPress={handleResendOtp} disabled={resendLoading || loading}>
        <Text style={[globalStyles.link, (resendLoading || loading) && styles.linkDisabled]}>
           {resendLoading ? 'Sending...' : 'Resend Code'}
        </Text>
      </TouchableOpacity>
       {/* Optional: Add a back button if needed, maybe depends on purpose */}
       {purpose === 'reset' && (
            <TouchableOpacity onPress={() => router.back()} disabled={loading || resendLoading}>
                <Text style={[globalStyles.link, styles.backLink, (resendLoading || loading) && styles.linkDisabled]}>
                    Back
                </Text>
            </TouchableOpacity>
       )}
    </View>
  );
};

const styles = StyleSheet.create({
  otpInput: {
    textAlign: 'center',
    letterSpacing: 8,
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 10,
    marginBottom: 20,
  },
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
      marginTop: 15, // Add space above back link
   }
});

export default OTPVerificationScreen;