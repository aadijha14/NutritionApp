// MealPlanCard.tsx
import React, { useState, useContext } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, Platform } from 'react-native';
import {
  Clock,
  ArrowRightLeft,
  Chrome as Home,
  UtensilsCrossed,
  Bell,
  Check,
  Pizza,
  MapPin
} from 'lucide-react-native';
import { MealSlot } from '../types/mealPlanner';
import { ThemeContext } from '../context/ThemeContext';

// Conditionally import DateTimePicker based on platform
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
  onQuickLog: (slotId: string) => void;
}

const MealPlanCard: React.FC<MealPlanCardProps> = ({
  slot,
  onTimeChange,
  onToggleLocation,
  onSwap,
  onToggleNotify,
  onQuickLog
}) => {
  const { theme } = useContext(ThemeContext);
  const isDark = theme === 'dark';
  
  const [showTimePicker, setShowTimePicker] = useState(false);
  
  // Convert string time (HH:MM) to Date object safely
  const getTimeAsDate = (timeString: string) => {
    if (!timeString) return new Date();
    const parts = timeString.split(':');
    if (parts.length < 2) return new Date();
    const [hours, minutes] = parts.map(Number);
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    return date;
  };
  
  // Handle time change from picker
  const handleTimeChange = (event: any, selectedDate?: Date) => {
    setShowTimePicker(Platform.OS === 'ios'); // hide picker on Android after selection
    
    if (selectedDate) {
      const hours = selectedDate.getHours().toString().padStart(2, '0');
      const minutes = selectedDate.getMinutes().toString().padStart(2, '0');
      const timeString = `${hours}:${minutes}`;
      onTimeChange(slot.id, timeString);
    }
  };
  
  // Format time for display; fallback if time is missing
  const formatTimeForDisplay = (time: string) => {
    if (!time) return 'No time set';
    const parts = time.split(':');
    if (parts.length < 2) return time;
    const [hours, minutes] = parts.map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  const renderMenuItem = () => {
    if (!slot.menuItem) {
      return (
        <View style={[styles.emptyMenuItem, isDark && styles.emptyMenuItemDark]}>
          <Pizza size={24} color={isDark ? "#555" : "#ccc"} />
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
        <View style={styles.nutritionInfo}>
          <Text style={styles.calorieText}>
            {slot.menuItem.calories != null ? Math.round(slot.menuItem.calories) : '0'} cal
          </Text>
          <View style={styles.macros}>
            <Text style={[styles.macroText, isDark && styles.macroTextDark]}>
              P: {slot.menuItem.protein != null ? Math.round(slot.menuItem.protein) : '0'}g
            </Text>
            <Text style={[styles.macroText, isDark && styles.macroTextDark]}>
              C: {slot.menuItem.carbs != null ? Math.round(slot.menuItem.carbs) : '0'}g
            </Text>
            <Text style={[styles.macroText, isDark && styles.macroTextDark]}>
              F: {slot.menuItem.fat != null ? Math.round(slot.menuItem.fat) : '0'}g
            </Text>
          </View>
        </View>
        {slot.menuItem.location?.name && (
          <View style={styles.locationInfo}>
            <MapPin size={12} color={isDark ? "#aaa" : "#666"} />
            <Text style={[styles.locationText, isDark && styles.locationTextDark]}>
              {slot.menuItem.location.name}
            </Text>
          </View>
        )}
        {slot.alternatives && slot.alternatives.length > 0 && (
          <TouchableOpacity 
            style={[styles.swapButton, isDark && styles.swapButtonDark]} 
            onPress={() => onSwap(slot.id)}
          >
            <ArrowRightLeft size={14} color={isDark ? "#2ecc71" : "#2ecc71"} />
            <Text style={styles.swapButtonText}>
              Swap ({slot.alternatives.length})
            </Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity 
          style={styles.quickLogButton}
          onPress={() => onQuickLog(slot.id)}
        >
          <Check size={14} color="#fff" />
          <Text style={styles.quickLogButtonText}>Quick Log</Text>
        </TouchableOpacity>
      </View>
    );
  };
  
  return (
    <View style={[styles.card, isDark && styles.cardDark]}>
      <View style={styles.header}>
        <View style={styles.slotInfo}>
          <Text style={[styles.slotName, isDark && styles.textLight]}>
            {slot.name || 'Meal'}
          </Text>
          <TouchableOpacity 
            style={styles.timeButton}
            onPress={() => setShowTimePicker(true)}
          >
            <Clock size={14} color={isDark ? "#aaa" : "#666"} />
            <Text style={[styles.timeText, isDark && styles.timeTextDark]}>
              {formatTimeForDisplay(slot.time)}
            </Text>
          </TouchableOpacity>
        </View>
        <View style={styles.budgetBadge}>
          <Text style={styles.budgetText}>
            Target: {slot.budget != null ? slot.budget : '0'} cal
          </Text>
        </View>
      </View>
      
      <View style={[styles.locationToggle, isDark && styles.locationToggleDark]}>
        <TouchableOpacity
          style={[
            styles.locationOption,
            slot.locationType === 'home' && styles.activeLocationOption,
            slot.locationType === 'home' && isDark && styles.activeLocationOptionDark
          ]}
          onPress={() => slot.locationType !== 'home' && onToggleLocation(slot.id)}
        >
          <Home size={16} color={slot.locationType === 'home' ? (isDark ? '#2ecc71' : '#2ecc71') : (isDark ? '#aaa' : '#888')} />
          <Text style={[
            styles.locationOptionText,
            slot.locationType === 'home' && styles.activeLocationText,
            isDark && styles.locationOptionTextDark
          ]}>
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
          <UtensilsCrossed size={16} color={slot.locationType === 'restaurant' ? (isDark ? '#2ecc71' : '#2ecc71') : (isDark ? '#aaa' : '#888')} />
          <Text style={[
            styles.locationOptionText,
            slot.locationType === 'restaurant' && styles.activeLocationText,
            isDark && styles.locationOptionTextDark
          ]}>
            Restaurant
          </Text>
        </TouchableOpacity>
      </View>
      
      {renderMenuItem()}
      
      <View style={styles.footer}>
        <View style={styles.notifyContainer}>
          <Bell size={16} color={isDark ? "#aaa" : "#666"} />
          <Text style={[styles.notifyText, isDark && styles.notifyTextDark]}>Remind Me</Text>
          <Switch
            value={slot.notify}
            onValueChange={(value) => onToggleNotify(slot.id, value)}
            trackColor={{ false: isDark ? '#555' : '#ddd', true: '#2ecc7199' }}
            thumbColor={slot.notify ? '#2ecc71' : isDark ? '#888' : '#f4f3f4'}
            ios_backgroundColor={isDark ? '#555' : '#ddd'}
          />
        </View>
      </View>
      
      {/* Time Picker Modal for Native Platforms */}
      {showTimePicker && Platform.OS !== 'web' && DateTimePicker && (
        <DateTimePicker
          value={getTimeAsDate(slot.time)}
          mode="time"
          display="default"
          onChange={handleTimeChange}
        />
      )}
      
      {/* Web Time Picker Alternative */}
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
            onChange={(e) => {
              onTimeChange(slot.id, e.target.value);
              setShowTimePicker(false);
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
  budgetBadge: {
    backgroundColor: '#f0fff4',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#c6f6d5',
  },
  budgetText: {
    fontSize: 12,
    color: '#2ecc71',
    fontWeight: 'bold',
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
  nutritionInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
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
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  locationText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  locationTextDark: {
    color: '#aaa',
  },
  swapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    marginBottom: 8,
  },
  swapButtonDark: {
    backgroundColor: '#2a2a2a',
  },
  swapButtonText: {
    fontSize: 12,
    color: '#2ecc71',
    fontWeight: 'bold',
    marginLeft: 4,
  },
  quickLogButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2ecc71',
    paddingVertical: 8,
    borderRadius: 8,
  },
  quickLogButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
    marginLeft: 6,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    zIndex: 1000,
  },
  webTimePickerContainerDark: {
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  webTimePickerCloseButton: {
    alignSelf: 'flex-end',
    marginBottom: 10,
    backgroundColor: '#2ecc71',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 5,
  },
  webTimePickerCloseText: {
    color: 'white',
    fontWeight: 'bold',
  },
  textLight: {
    color: '#f2f2f2',
  },
});

export default MealPlanCard;