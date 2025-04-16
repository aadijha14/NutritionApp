// app/(app)/styles/_layout.tsx

import { useEffect, useState, useContext } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet, TouchableOpacity, Text, Platform } from 'react-native';
import { router, usePathname } from 'expo-router';
import { Search, Plus, ChartPie as PieChart, Clock, Settings } from 'lucide-react-native';
import { ThemeProvider } from '../context/ThemeContext';
import { ThemeContext } from '../context/ThemeContext';

function TabBar() {
  const { theme } = useContext(ThemeContext);
  const isDark = theme === 'dark';
  const pathname = usePathname();

  // Debug log to see the actual pathname
  console.log('Current pathname:', pathname);

  // Decide if a tab is "active"
  const isActive = (route: string) => {
    if (route === 'dashboard' && pathname === '/(app)/dashboard') return true;
    if (route === 'search' && pathname === '/(app)/nearby-restaurants') return true;
    if (route === 'history' && pathname === '/(app)/meal-history') return true;
    if (route === 'profile' && pathname === '/(app)/settings') return true;
    return false;
  };

  // Navigation helper
  const navigateTo = (route: string) => {
    switch (route) {
      case 'dashboard':
        router.push('/(app)/dashboard');
        break;
      case 'search':
        router.push('/(app)/nearby-restaurants');
        break;
      case 'add':
        router.push('/(app)/meal-logging');
        break;
      case 'history':
        router.push('/(app)/meal-history');
        break;
      case 'profile':
        router.push('/(app)/settings');
        break;
    }
  };

  // Hide tab bar on auth routes
  if (
    pathname === '/' ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/signup') ||
    pathname.startsWith('/forgot-password') ||
    pathname.startsWith('/otp-verification') ||
    pathname.startsWith('/password-reset') ||
    pathname.startsWith('/account-created') ||
    pathname.startsWith('/profile-management')
  ) {
    return null;
  }

  return (
    <View style={[styles.tabBar, isDark && styles.tabBarDark]}>
      <TouchableOpacity style={styles.tab} onPress={() => navigateTo('dashboard')}>
        <PieChart
          color={isActive('dashboard') ? '#2ecc71' : isDark ? '#aaa' : '#888'}
          size={24}
        />
        <Text
          style={
            isActive('dashboard')
              ? styles.tabText
              : [styles.inactiveTabText, isDark && styles.inactiveTabTextDark]
          }
        >
          Dashboard
        </Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.tab} onPress={() => navigateTo('search')}>
        <Search
          color={isActive('search') ? '#2ecc71' : isDark ? '#aaa' : '#888'}
          size={24}
        />
        <Text
          style={
            isActive('search')
              ? styles.tabText
              : [styles.inactiveTabText, isDark && styles.inactiveTabTextDark]
          }
        >
          Search
        </Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.addButton} onPress={() => navigateTo('add')}>
        <Plus color="#fff" size={24} />
      </TouchableOpacity>

      <TouchableOpacity style={styles.tab} onPress={() => navigateTo('history')}>
        <Clock
          color={isActive('history') ? '#2ecc71' : isDark ? '#aaa' : '#888'}
          size={24}
        />
        <Text
          style={
            isActive('history')
              ? styles.tabText
              : [styles.inactiveTabText, isDark && styles.inactiveTabTextDark]
          }
        >
          History
        </Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.tab} onPress={() => navigateTo('profile')}>
        <Settings
          color={isActive('profile') ? '#2ecc71' : isDark ? '#aaa' : '#888'}
          size={24}
        />
        <Text
          style={
            isActive('profile')
              ? styles.tabText
              : [styles.inactiveTabText, isDark && styles.inactiveTabTextDark]
          }
        >
          Profile
        </Text>
      </TouchableOpacity>
    </View>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="(app)" options={{ headerShown: false }} />
          <Stack.Screen name="+not-found" options={{ title: 'Oops!' }} />
        </Stack>
        <StatusBar style="auto" />
        <TabBar />
      </>
    </ThemeProvider>
  );
}

// Styles
const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    backgroundColor: 'white',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  tabBarDark: {
    backgroundColor: '#1e1e1e',
    borderTopColor: '#2a2a2a',
  },
  tab: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  tabText: {
    fontSize: 12,
    marginTop: 2,
    color: '#2ecc71',
    fontWeight: 'bold',
  },
  inactiveTabText: {
    fontSize: 12,
    marginTop: 2,
    color: '#888',
  },
  inactiveTabTextDark: {
    color: '#aaa',
  },
  addButton: {
    backgroundColor: '#2ecc71',
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
});