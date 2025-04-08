// OTP Verification Screen (app/(auth)/otp-verification.tsx)
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import globalStyles from '../styles/globalStyles';

const OTPVerificationScreen: React.FC = () => {
  const [otpCode, setOtpCode] = useState<string>('');
  const [verificationStatus, setVerificationStatus] = useState<string>('');

  const doDisplayOTPInputFields = () => (
    <>
      <Text style={globalStyles.title}>Verify Your Account</Text>
      <Text style={globalStyles.subtitle}>Enter the verification code sent to your email</Text>
      <TextInput
        style={[globalStyles.inputField, styles.otpInput]}
        placeholder="Enter OTP"
        keyboardType="numeric"
        maxLength={6}
        onChangeText={setOtpCode}
        value={otpCode}
      />
      {verificationStatus ? <Text style={globalStyles.errorText}>{verificationStatus}</Text> : null}
    </>
  );

  const handleVerifyOTP = () => {
    // For demo purposes, any 6-digit code will work
    if (otpCode.length === 6) {
      router.push('/(auth)/account-created');
    } else {
      setVerificationStatus('Please enter a valid 6-digit code');
    }
  };

  return (
    <View style={globalStyles.container}>
      {doDisplayOTPInputFields()}
      <TouchableOpacity onPress={handleVerifyOTP} style={globalStyles.button}>
        <Text style={globalStyles.buttonText}>Verify OTP</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => {
        setOtpCode('');
        setVerificationStatus('A new verification code has been sent');
      }}>
        <Text style={globalStyles.link}>Resend Code</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  otpInput: {
    textAlign: 'center',
    letterSpacing: 2,
    fontSize: 20,
  }
});

export default OTPVerificationScreen;