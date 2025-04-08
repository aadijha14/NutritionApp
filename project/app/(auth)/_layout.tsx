import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="signup" />
      <Stack.Screen name="otp-verification" />
      <Stack.Screen name="account-created" />
      <Stack.Screen name="login" />
      <Stack.Screen name="forgot-password" />
      <Stack.Screen name="password-reset" />
      <Stack.Screen name="profile-management" />
    </Stack>
  );
}