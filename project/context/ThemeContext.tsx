// ThemeContext.tsx
import React, { createContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { auth, db } from '../firebaseConfig';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

type ThemeContextType = {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  isDark: boolean;
};

export const ThemeContext = createContext<ThemeContextType>({
  theme: 'light',
  toggleTheme: () => {},
  isDark: false,
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const deviceColorScheme = useColorScheme();
  const [theme, setTheme] = useState<'light' | 'dark'>(deviceColorScheme === 'dark' ? 'dark' : 'light');

  // Fetch user preferences from Firestore on mount
  useEffect(() => {
    const fetchUserPreferences = async () => {
      if (auth.currentUser) {
        try {
          const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
          
          if (userDoc.exists() && userDoc.data().darkMode !== undefined) {
            setTheme(userDoc.data().darkMode ? 'dark' : 'light');
          }
        } catch (error) {
          console.error('Error fetching user theme preferences:', error);
        }
      }
    };
    
    fetchUserPreferences();
  }, []);

  const toggleTheme = async () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    
    // Save the preference to Firestore if user is logged in
    if (auth.currentUser) {
      try {
        await updateDoc(doc(db, 'users', auth.currentUser.uid), {
          darkMode: newTheme === 'dark'
        });
      } catch (error) {
        console.error('Error saving theme preference:', error);
      }
    }
  };

  return (
    <ThemeContext.Provider value={{ 
      theme, 
      toggleTheme,
      isDark: theme === 'dark'
    }}>
      {children}
    </ThemeContext.Provider>
  );
};