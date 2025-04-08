import { Stack } from 'expo-router';

export default function AppLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="dashboard" />
      <Stack.Screen name="nearby-restaurants" />
      <Stack.Screen name="restaurant-details" />
      <Stack.Screen name="meal-logging" />
      <Stack.Screen name="restaurant-directions" />
      <Stack.Screen name="meal-history" />
      <Stack.Screen name="dining-analytics" />
      <Stack.Screen name="favorite-restaurants" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="plan-my-day" />
    </Stack>
  );
}