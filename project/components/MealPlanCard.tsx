// MealPlanCard.tsx
import React, { useState, useContext } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, Platform } from 'react-native';
import {
  Clock,
  Chrome as Home,
  UtensilsCrossed,
  Bell,
  Pizza,
  MapPin
} from 'lucide-react-native';
import { ThemeContext } from '../context/ThemeContext';
import { MealSlot } from '../types/mealPlanner';
import * as Notifications from 'expo-notifications';

let DateTimePicker: any;
if (Platform.OS !== 'web') {
  try {
    DateTimePicker = require('@react-native-community/datetimepicker').default;
  } catch (error) {
    console.error('Failed to load DateTimePicker:', error);
  }
}

interface MealPlanCardProps {
  slot: MealSlot;
  onTimeChange: (slotId: string, time: string) => void;
  onToggleLocation: (slotId: string) => void;
  onSwap: (slotId: string) => void;
  onToggleNotify: (slotId: string, notify: boolean) => void;
}

const MealPlanCard: React.FC<MealPlanCardProps> = ({
  slot,
  onTimeChange,
  onToggleLocation,
  onSwap,
  onToggleNotify
}) => {
  const { theme } = useContext(ThemeContext);
  const isDark = theme === 'dark';

  const [showTimePicker, setShowTimePicker] = useState<boolean>(false);

  // Convert "HH:MM" to Date
  const getTimeAsDate = (timeString: string) => {
    if (!timeString) return new Date();
    const parts = timeString.split(':');
    if (parts.length < 2) return new Date();
    const [hours, minutes] = parts.map(Number);
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    return date;
  };

  // Format "HH:MM" -> "hh:mm AM/PM"
  const formatTimeForDisplay = (time: string) => {
    if (!time) return 'No time set';
    const [hoursStr, minutesStr] = time.split(':');
    const hours = parseInt(hoursStr, 10);
    const minutes = parseInt(minutesStr, 10);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  // When user picks a time from the OS time picker
  const handleTimeChange = async (event: any, selectedDate?: Date) => {
    setShowTimePicker(false); // hide after selection on Android
    if (selectedDate) {
      const hours = selectedDate.getHours().toString().padStart(2, '0');
      const minutes = selectedDate.getMinutes().toString().padStart(2, '0');
      const timeString = `${hours}:${minutes}`;

      // store in parent's state
      onTimeChange(slot.id, timeString);

      // If the user has toggled "Remind Me", schedule a local notification
      if (slot.notify) {
        // If the time is in the past, schedule for next day
        let triggerDate = new Date(selectedDate);
        const now = new Date();
        if (triggerDate <= now) {
          triggerDate.setDate(triggerDate.getDate() + 1);
        }
        await Notifications.scheduleNotificationAsync({
          content: {
            title: "Meal Reminder",
            body: `Reminder for your ${slot.name} meal.`,
          },
          trigger: triggerDate,
        });
      }
    }
  };

  // Toggle the notify switch
  const handleToggleNotify = async (value: boolean) => {
    onToggleNotify(slot.id, value);
    if (value && slot.time) {
      // If user just toggled on, and there's already a time, schedule now
      const dateObj = getTimeAsDate(slot.time);
      const now = new Date();
      if (dateObj <= now) {
        dateObj.setDate(dateObj.getDate() + 1);
      }
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "Meal Reminder",
          body: `Reminder for your ${slot.name} meal.`,
        },
        trigger: dateObj,
      });
    }
  };

  // Render the dish name, macros, and restaurant info if any
  const renderMenuItem = () => {
    if (!slot.menuItem) {
      return (
        <View style={[styles.emptyMenuItem, isDark && styles.emptyMenuItemDark]}>
          <Pizza size={24} color={isDark ? '#555' : '#ccc'} />
          <Text style={[styles.emptyMenuItemText, isDark && styles.emptyMenuItemTextDark]}>
            No meal suggestion available
          </Text>
        </View>
      );
    }
    return (
      <View style={[styles.menuItem, isDark && styles.menuItemDark]}>
        <Text style={[styles.menuItemName, isDark && styles.textLight]}>
          {slot.menuItem.foodName || 'No dish available'}
        </Text>
        {/* If restaurant */}
        {slot.locationType === 'restaurant' && slot.menuItem.restaurantName ? (
          <View style={styles.restaurantInfo}>
            <MapPin size={16} color={isDark ? '#aaa' : '#666'} />
            <View style={styles.restaurantInfoTextContainer}>
              <Text style={[styles.restaurantName, isDark && styles.textLight]}>
                {slot.menuItem.restaurantName}
              </Text>
              <Text style={[styles.restaurantAddress, isDark && styles.textLight]}>
                {slot.menuItem.restaurantAddress}
              </Text>
            </View>
          </View>
        ) : null}
        <View style={styles.nutritionInfo}>
          <Text style={styles.calorieText}>
            {slot.menuItem.calories != null ? Math.round(slot.menuItem.calories) : 0} cal
          </Text>
          <View style={styles.macros}>
            <Text style={[styles.macroText, isDark && styles.macroTextDark]}>
              P: {slot.menuItem.protein != null ? Math.round(slot.menuItem.protein) : 0}g
            </Text>
            <Text style={[styles.macroText, isDark && styles.macroTextDark]}>
              C: {slot.menuItem.carbs != null ? Math.round(slot.menuItem.carbs) : 0}g
            </Text>
            <Text style={[styles.macroText, isDark && styles.macroTextDark]}>
              F: {slot.menuItem.fat != null ? Math.round(slot.menuItem.fat) : 0}g
            </Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.card, isDark && styles.cardDark]}>
      {/* Header with meal name and time */}
      <View style={styles.header}>
        <View style={styles.slotInfo}>
          <Text style={[styles.slotName, isDark && styles.textLight]}>
            {slot.name}
          </Text>
          <TouchableOpacity 
            style={styles.timeButton}
            onPress={() => setShowTimePicker(true)}
          >
            <Clock size={14} color={isDark ? '#aaa' : '#666'} />
            <Text style={[styles.timeText, isDark && styles.timeTextDark]}>
              {formatTimeForDisplay(slot.time)}
            </Text>
          </TouchableOpacity>
        </View>
        {/* location type (home or restaurant) toggles in parent's code, 
            but we show the user's target budget for reference if you like */}
      </View>

      {/* Location toggle row */}
      <View style={[styles.locationToggle, isDark && styles.locationToggleDark]}>
        <TouchableOpacity
          style={[
            styles.locationOption,
            slot.locationType === 'home' && styles.activeLocationOption,
            slot.locationType === 'home' && isDark && styles.activeLocationOptionDark
          ]}
          onPress={() => slot.locationType !== 'home' && onToggleLocation(slot.id)}
        >
          <Home
            size={16}
            color={
              slot.locationType === 'home'
                ? '#2ecc71'
                : isDark
                ? '#aaa'
                : '#888'
            }
          />
          <Text
            style={[
              styles.locationOptionText,
              slot.locationType === 'home' && styles.activeLocationText,
              isDark && styles.locationOptionTextDark
            ]}
          >
            Home
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.locationOption,
            slot.locationType === 'restaurant' && styles.activeLocationOption,
            slot.locationType === 'restaurant' && isDark && styles.activeLocationOptionDark
          ]}
          onPress={() => slot.locationType !== 'restaurant' && onToggleLocation(slot.id)}
        >
          <UtensilsCrossed
            size={16}
            color={
              slot.locationType === 'restaurant'
                ? '#2ecc71'
                : isDark
                ? '#aaa'
                : '#888'
            }
          />
          <Text
            style={[
              styles.locationOptionText,
              slot.locationType === 'restaurant' && styles.activeLocationText,
              isDark && styles.locationOptionTextDark
            ]}
          >
            Restaurant
          </Text>
        </TouchableOpacity>
      </View>

      {/* Dish info */}
      {renderMenuItem()}

      {/* Footer with "Remind me" toggle */}
      <View style={styles.footer}>
        <View style={styles.notifyContainer}>
          <Bell size={16} color={isDark ? '#aaa' : '#666'} />
          <Text style={[styles.notifyText, isDark && styles.notifyTextDark]}>Remind Me</Text>
          <Switch
            value={slot.notify}
            onValueChange={handleToggleNotify}
            trackColor={{ false: isDark ? '#555' : '#ddd', true: '#2ecc7199' }}
            thumbColor={slot.notify ? '#2ecc71' : isDark ? '#888' : '#f4f3f4'}
            ios_backgroundColor={isDark ? '#555' : '#ddd'}
          />
        </View>
      </View>

      {/* Show time picker (Platform-specific) */}
      {showTimePicker && Platform.OS !== 'web' && DateTimePicker && (
        <DateTimePicker
          value={getTimeAsDate(slot.time)}
          mode="time"
          display="default"
          onChange={handleTimeChange}
        />
      )}

      {/* Web time picker fallback */}
      {showTimePicker && Platform.OS === 'web' && (
        <View style={[styles.webTimePickerContainer, isDark && styles.webTimePickerContainerDark]}>
          <TouchableOpacity
            style={styles.webTimePickerCloseButton}
            onPress={() => setShowTimePicker(false)}
          >
            <Text style={styles.webTimePickerCloseText}>Close</Text>
          </TouchableOpacity>
          <input
            type="time"
            value={slot.time}
            onChange={async (e) => {
              const val = e.target.value; // "HH:MM"
              onTimeChange(slot.id, val);
              setShowTimePicker(false);
              // If notify is on, schedule
              if (slot.notify) {
                let dateObj = getTimeAsDate(val);
                const now = new Date();
                if (dateObj <= now) {
                  dateObj.setDate(dateObj.getDate() + 1);
                }
                await Notifications.scheduleNotificationAsync({
                  content: {
                    title: "Meal Reminder",
                    body: `Reminder for your ${slot.name} meal.`,
                  },
                  trigger: dateObj,
                });
              }
            }}
            style={{
              padding: 10,
              fontSize: 16,
              width: '100%',
              border: '1px solid #ccc',
              borderRadius: 8,
              backgroundColor: isDark ? '#2a2a2a' : '#f5f5f5',
              color: isDark ? '#f2f2f2' : '#333'
            }}
          />
        </View>
      )}
    </View>
  );
};

//////////////////////////////////////////////////////////////////////////
// STYLES
//////////////////////////////////////////////////////////////////////////
const styles = StyleSheet.create({
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  cardDark: {
    backgroundColor: '#1e1e1e',
    shadowColor: '#000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  slotInfo: {
    flexDirection: 'column',
  },
  slotName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  timeButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 4,
  },
  timeTextDark: {
    color: '#aaa',
  },
  locationToggle: {
    flexDirection: 'row',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    marginBottom: 16,
    padding: 4,
  },
  locationToggleDark: {
    backgroundColor: '#2a2a2a',
  },
  locationOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 6,
  },
  activeLocationOption: {
    backgroundColor: '#ebfbf0',
  },
  activeLocationOptionDark: {
    backgroundColor: '#1c3427',
  },
  locationOptionText: {
    marginLeft: 6,
    fontSize: 14,
    color: '#888',
  },
  locationOptionTextDark: {
    color: '#aaa',
  },
  activeLocationText: {
    color: '#2ecc71',
    fontWeight: 'bold',
  },
  menuItem: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  menuItemDark: {
    backgroundColor: '#252525',
  },
  menuItemName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  emptyMenuItem: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 24,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#eee',
    borderStyle: 'dashed',
  },
  emptyMenuItemDark: {
    backgroundColor: '#252525',
    borderColor: '#333',
  },
  emptyMenuItemText: {
    marginTop: 8,
    color: '#999',
    fontSize: 14,
    textAlign: 'center',
  },
  emptyMenuItemTextDark: {
    color: '#777',
  },
  restaurantInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  restaurantInfoTextContainer: {
    marginLeft: 6,
  },
  restaurantName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  restaurantAddress: {
    fontSize: 12,
    color: '#666',
  },
  nutritionInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  calorieText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2ecc71',
  },
  macros: {
    flexDirection: 'row',
  },
  macroText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 8,
  },
  macroTextDark: {
    color: '#aaa',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  notifyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  notifyText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 6,
    marginRight: 8,
  },
  notifyTextDark: {
    color: '#aaa',
  },
  webTimePickerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
    padding: 20,
  },
  webTimePickerContainerDark: {
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
  webTimePickerCloseButton: {
    alignSelf: 'flex-end',
    backgroundColor: '#2ecc71',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 5,
    marginBottom: 10,
  },
  webTimePickerCloseText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  cardDark: {
    backgroundColor: '#1e1e1e',
  },
  textLight: {
    color: '#f2f2f2',
  },
});

export default MealPlanCard;