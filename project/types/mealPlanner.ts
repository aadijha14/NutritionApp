// types/mealPlanner.ts
import { Timestamp } from 'firebase/firestore';

export interface MenuItem {
  id: string;
  foodName: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  createdBy?: string;
  createdAt?: Timestamp;
  location?: {
    name?: string;
    type?: string;
    placeId?: string;
  };
}

export interface MealSlot {
  id: string;
  name: string;
  time: string;
  locationType: 'home' | 'restaurant';
  menuItem: MenuItem | null;
  alternatives: MenuItem[];
  notify: boolean;
  budget: number;
  restaurantId?: string;
  restaurantName?: string;
}

export interface Restaurant {
  place_id: string;
  name: string;
  vicinity: string;
  formatted_address?: string;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
  photos?: Array<{ photo_reference: string }>;
  rating?: number;
  isFavorite?: boolean;
}

export interface MealPlan {
  slots: MealSlot[];
  createdAt: Timestamp;
  dietaryPreferences: string[];
}