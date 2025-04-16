// Dining Analytics Screen (app/(app)/dining-analytics.tsx)
import React, { useState, useEffect, useContext } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ActivityIndicator, 
  ScrollView,
  Dimensions,
  Platform
} from 'react-native';
import { router } from 'expo-router';
import { auth, db } from '../../firebaseConfig';
import { collection, query, where, orderBy, getDocs, doc, getDoc } from 'firebase/firestore';
import { 
  ArrowLeft, 
  ChevronDown,
  Map as MapIcon
} from 'lucide-react-native';
import { 
  LineChart, 
  BarChart, 
  PieChart 
} from 'react-native-chart-kit';
import { ThemeContext } from '../../context/ThemeContext';

interface MealLog {
  id: string;
  foodName: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  date: Date;
  mealType?: string;
  location?: {
    name: string;
    type: string;
  };
}

interface DailyNutrition {
  date: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  mealCount: number;
}

interface WeeklyNutrition {
  week: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  mealCount: number;
}

interface UserData {
  dailyCalorieTarget?: number;
}

type DateRangeType = 'week' | 'month' | '3months' | 'year';

// Slightly reduce the width for chart alignment
const screenWidth = Dimensions.get('window').width - 50;

const DiningAnalyticsScreen: React.FC = () => {
  const { theme } = useContext(ThemeContext);
  const isDark = theme === 'dark';
  
  const [mealHistory, setMealHistory] = useState<MealLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Include '3months' in date range
  const [dateRange, setDateRange] = useState<DateRangeType>('week');
  const [showDateRangeDropdown, setShowDateRangeDropdown] = useState<boolean>(false);

  const [dailyData, setDailyData] = useState<DailyNutrition[]>([]);
  const [weeklyData, setWeeklyData] = useState<WeeklyNutrition[]>([]);
  const [activeMetric, setActiveMetric] = useState<'calories' | 'protein' | 'carbs' | 'fat'>('calories');
  const [userData, setUserData] = useState<UserData | null>(null);
  const [insights, setInsights] = useState<string[]>([]);

  const chartConfig = {
    backgroundColor: isDark ? '#1e1e1e' : '#ffffff',
    backgroundGradientFrom: isDark ? '#1e1e1e' : '#ffffff',
    backgroundGradientTo: isDark ? '#1e1e1e' : '#ffffff',
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(46, 204, 113, ${opacity})`,
    labelColor: (opacity = 1) =>
      isDark ? `rgba(255, 255, 255, ${opacity})` : `rgba(0, 0, 0, ${opacity})`,
    style: {
      borderRadius: 16,
    },
    propsForDots: {
      r: '5',
      strokeWidth: '2',
      stroke: '#2ecc71',
    },
    propsForLabels: {
      fontSize: 10,
      color: isDark ? '#f2f2f2' : '#333'
    },
  };

  useEffect(() => {
    fetchMealHistoryAndUserData();
  }, []);

  useEffect(() => {
    if (mealHistory.length > 0) {
      processMealData();
    }
  }, [mealHistory, dateRange]);

  const fetchMealHistoryAndUserData = async () => {
    if (!auth.currentUser) {
      setLoading(false);
      setError('You must be logged in to view analytics');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch user’s meal logs for last year
      const now = new Date();
      const oneYearAgo = new Date(now);
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      
      const mealsQuery = query(
        collection(db, 'mealLogs'),
        where('userId', '==', auth.currentUser.uid),
        where('date', '>=', oneYearAgo),
        orderBy('date', 'asc')
      );

      const snapshot = await getDocs(mealsQuery);
      const meals: MealLog[] = [];
      snapshot.forEach((docSnapshot) => {
        const data = docSnapshot.data();
        const mealDate = data.date?.toDate ? data.date.toDate() : new Date(data.date);
        meals.push({
          id: docSnapshot.id,
          foodName: data.foodName || '',
          calories: data.calories || 0,
          protein: data.protein || 0,
          carbs: data.carbs || 0,
          fat: data.fat || 0,
          date: mealDate,
          mealType: data.mealType || null,
          location: data.location || { name: 'Custom meal', type: 'custom' }
        });
      });
      
      setMealHistory(meals);
      
      // Fetch user data (like dailyCalorieTarget)
      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      if (userDoc.exists()) {
        setUserData(userDoc.data() as UserData);
      }
    } catch (err) {
      console.error('Error fetching meal data:', err);
      setError('Failed to fetch data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const processMealData = () => {
    const now = new Date();
    let startDate: Date;

    // Adjust logic for '3months'
    if (dateRange === 'week') {
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 7);
    } else if (dateRange === 'month') {
      startDate = new Date(now);
      startDate.setMonth(startDate.getMonth() - 1);
    } else if (dateRange === '3months') {
      startDate = new Date(now);
      startDate.setMonth(startDate.getMonth() - 3);
    } else {
      // year
      startDate = new Date(now);
      startDate.setFullYear(startDate.getFullYear() - 1);
    }

    const filteredMeals = mealHistory.filter(meal => meal.date >= startDate);
    const dailyMap = new Map<string, DailyNutrition>();

    filteredMeals.forEach(meal => {
      const dateStr = meal.date.toISOString().split('T')[0];
      if (!dailyMap.has(dateStr)) {
        dailyMap.set(dateStr, {
          date: dateStr,
          calories: 0,
          protein: 0,
          carbs: 0,
          fat: 0,
          mealCount: 0
        });
      }
      const day = dailyMap.get(dateStr);
      day.calories += meal.calories;
      day.protein += meal.protein;
      day.carbs += meal.carbs;
      day.fat += meal.fat;
      day.mealCount += 1;
    });

    const sortedDailyData = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));
    setDailyData(sortedDailyData);

    // For 'year', also compute weekly data
    if (dateRange === 'year') {
      const weeklyMap = new Map<string, WeeklyNutrition>();
      filteredMeals.forEach(meal => {
        const date = meal.date;
        const startOfYear = new Date(date.getFullYear(), 0, 1);
        const weekNum = Math.ceil((date.getTime() - startOfYear.getTime()) / 604800000);
        const weekStr = `${date.getFullYear()}-W${weekNum.toString().padStart(2, '0')}`;
        if (!weeklyMap.has(weekStr)) {
          weeklyMap.set(weekStr, {
            week: weekStr,
            calories: 0,
            protein: 0,
            carbs: 0,
            fat: 0,
            mealCount: 0
          });
        }
        const week = weeklyMap.get(weekStr);
        week.calories += meal.calories;
        week.protein += meal.protein;
        week.carbs += meal.carbs;
        week.fat += meal.fat;
        week.mealCount += 1;
      });
      const sortedWeeklyData = Array.from(weeklyMap.values()).sort((a, b) => a.week.localeCompare(b.week));
      setWeeklyData(sortedWeeklyData);
    }

    generateInsights(filteredMeals, dailyMap);
  };

  const generateInsights = (meals: MealLog[], dailyData: Map<string, DailyNutrition>) => {
    const generatedInsights: string[] = [];

    if (meals.length === 0) {
      generatedInsights.push("No meal data available for this period. Start logging your meals to see insights!");
      setInsights(generatedInsights);
      return;
    }

    // Summaries
    const totalCalories = meals.reduce((sum, meal) => sum + meal.calories, 0);
    const totalProtein = meals.reduce((sum, meal) => sum + meal.protein, 0);
    const totalCarbs = meals.reduce((sum, meal) => sum + meal.carbs, 0);
    const totalFat = meals.reduce((sum, meal) => sum + meal.fat, 0);

    const avgCaloriesPerDay = totalCalories / dailyData.size;
    const avgProteinPerDay = totalProtein / dailyData.size;
    const avgCarbsPerDay = totalCarbs / dailyData.size;
    const avgFatPerDay = totalFat / dailyData.size;

    // If user set a daily calorie target
    if (userData?.dailyCalorieTarget) {
      const targetCalories = userData.dailyCalorieTarget;
      const percentOfTarget = Math.round((avgCaloriesPerDay / targetCalories) * 100);
      if (percentOfTarget < 80) {
        generatedInsights.push(`Your daily calorie intake (${Math.round(avgCaloriesPerDay)} cal) is ${100 - percentOfTarget}% below your target of ${targetCalories} cal.`);
      } else if (percentOfTarget > 120) {
        generatedInsights.push(`Your daily calorie intake (${Math.round(avgCaloriesPerDay)} cal) is ${percentOfTarget - 100}% above your target of ${targetCalories} cal.`);
      } else {
        generatedInsights.push(`Your daily calorie intake (${Math.round(avgCaloriesPerDay)} cal) is close to your target of ${targetCalories} cal.`);
      }
    } else {
      generatedInsights.push(`Your average daily calorie intake is ${Math.round(avgCaloriesPerDay)} cal.`);
    }

    // Macro distribution
    const totalMacroCalories = (avgProteinPerDay * 4) + (avgCarbsPerDay * 4) + (avgFatPerDay * 9);
    if (totalMacroCalories > 0) {
      const proteinPercentage = Math.round((avgProteinPerDay * 4 / totalMacroCalories) * 100);
      const carbsPercentage = Math.round((avgCarbsPerDay * 4 / totalMacroCalories) * 100);
      const fatPercentage = Math.round((avgFatPerDay * 9 / totalMacroCalories) * 100);
      generatedInsights.push(`Your macro distribution is approximately ${proteinPercentage}% protein, ${carbsPercentage}% carbs, and ${fatPercentage}% fat.`);
    }

    // Meal type stats
    const breakfastCount = meals.filter(meal => meal.mealType === 'breakfast').length;
    const lunchCount = meals.filter(meal => meal.mealType === 'lunch').length;
    const dinnerCount = meals.filter(meal => meal.mealType === 'dinner').length;
    const snackCount = meals.filter(meal => meal.mealType === 'snack').length;
    const skipBreakfastRate = Math.round((1 - breakfastCount / dailyData.size) * 100);

    if (skipBreakfastRate > 50) {
      generatedInsights.push(`You skipped breakfast on ${skipBreakfastRate}% of days. Consider adding a nutritious breakfast to your routine.`);
    }
    if (snackCount > (breakfastCount + lunchCount + dinnerCount) / 2) {
      generatedInsights.push("You log snacks more frequently than regular meals. Try to focus on balanced main meals.");
    }

    // Restaurant vs home
    const restaurantCount = meals.filter(meal => meal.location?.type === 'restaurant').length;
    const restaurantPercentage = Math.round((restaurantCount / meals.length) * 100);
    generatedInsights.push(`${restaurantPercentage}% of your meals were at restaurants. ${
      restaurantPercentage > 50 
        ? "Consider preparing more meals at home for better nutritional control." 
        : "Good job balancing restaurant meals with home cooking!"
    }`);

    setInsights(generatedInsights);
  };

  const formatDateLabel = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const navigateToMapView = () => {
    router.push('/(app)/meal-history');
  };

  const getAverageNutrition = () => {
    if (dailyData.length === 0) return { calories: 0, protein: 0, carbs: 0, fat: 0 };
    const totalCalories = dailyData.reduce((sum, day) => sum + day.calories, 0);
    const totalProtein = dailyData.reduce((sum, day) => sum + day.protein, 0);
    const totalCarbs = dailyData.reduce((sum, day) => sum + day.carbs, 0);
    const totalFat = dailyData.reduce((sum, day) => sum + day.fat, 0);
    return {
      calories: Math.round(totalCalories / dailyData.length),
      protein: Math.round(totalProtein / dailyData.length),
      carbs: Math.round(totalCarbs / dailyData.length),
      fat: Math.round(totalFat / dailyData.length)
    };
  };

  const filterMealsByDateRange = () => {
    const now = new Date();
    let startDate: Date;
    if (dateRange === 'week') {
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 7);
    } else if (dateRange === 'month') {
      startDate = new Date(now);
      startDate.setMonth(startDate.getMonth() - 1);
    } else if (dateRange === '3months') {
      startDate = new Date(now);
      startDate.setMonth(startDate.getMonth() - 3);
    } else {
      // year
      startDate = new Date(now);
      startDate.setFullYear(startDate.getFullYear() - 1);
    }
    return mealHistory.filter(meal => meal.date >= startDate);
  };

  // Drop-down with higher zIndex to fix behind-component issue
  const renderDateRangeSelector = () => (
    <View style={[styles.dateRangeContainer]}>
      <TouchableOpacity 
        style={[styles.dateRangeSelector, isDark && styles.dateRangeSelectorDark]}
        onPress={() => setShowDateRangeDropdown(!showDateRangeDropdown)}
      >
        <Text style={[styles.dateRangeText, isDark && styles.textLight]}>
          {dateRange === 'week'
            ? 'Last 7 Days'
            : dateRange === 'month'
            ? 'Last 30 Days'
            : dateRange === '3months'
            ? 'Last 3 Months'
            : 'Last 12 Months'
          }
        </Text>
        <ChevronDown size={16} color={isDark ? "#f2f2f2" : "#666"} />
      </TouchableOpacity>

      {showDateRangeDropdown && (
        <View style={[
          styles.dateRangeDropdown,
          isDark && styles.dateRangeDropdownDark
        ]}>
          {/* 7 Days */}
          <TouchableOpacity 
            style={styles.dateRangeOption}
            onPress={() => {
              setDateRange('week');
              setShowDateRangeDropdown(false);
            }}
          >
            <Text
              style={
                dateRange === 'week'
                  ? [styles.selectedOptionText, isDark && styles.selectedOptionTextDark]
                  : [styles.optionText, isDark && styles.optionTextDark]
              }
            >
              Last 7 Days
            </Text>
          </TouchableOpacity>

          {/* 1 Month */}
          <TouchableOpacity 
            style={styles.dateRangeOption}
            onPress={() => {
              setDateRange('month');
              setShowDateRangeDropdown(false);
            }}
          >
            <Text
              style={
                dateRange === 'month'
                  ? [styles.selectedOptionText, isDark && styles.selectedOptionTextDark]
                  : [styles.optionText, isDark && styles.optionTextDark]
              }
            >
              Last 30 Days
            </Text>
          </TouchableOpacity>

          {/* 3 Months */}
          <TouchableOpacity 
            style={styles.dateRangeOption}
            onPress={() => {
              setDateRange('3months');
              setShowDateRangeDropdown(false);
            }}
          >
            <Text
              style={
                dateRange === '3months'
                  ? [styles.selectedOptionText, isDark && styles.selectedOptionTextDark]
                  : [styles.optionText, isDark && styles.optionTextDark]
              }
            >
              Last 3 Months
            </Text>
          </TouchableOpacity>

          {/* 1 Year */}
          <TouchableOpacity 
            style={styles.dateRangeOption}
            onPress={() => {
              setDateRange('year');
              setShowDateRangeDropdown(false);
            }}
          >
            <Text
              style={
                dateRange === 'year'
                  ? [styles.selectedOptionText, isDark && styles.selectedOptionTextDark]
                  : [styles.optionText, isDark && styles.optionTextDark]
              }
            >
              Last 12 Months
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  const renderMetricSelector = () => (
    <View style={[styles.metricSelectorContainer, isDark && styles.metricSelectorContainerDark]}>
      <TouchableOpacity 
        style={[styles.metricButton, activeMetric === 'calories' && styles.activeMetricButton]}
        onPress={() => setActiveMetric('calories')}
      >
        <Text
          style={[
            styles.metricText, 
            isDark && styles.metricTextDark,
            activeMetric === 'calories' && styles.activeMetricText
          ]}
        >
          Calories
        </Text>
      </TouchableOpacity>
      <TouchableOpacity 
        style={[styles.metricButton, activeMetric === 'protein' && styles.activeMetricButton]}
        onPress={() => setActiveMetric('protein')}
      >
        <Text
          style={[
            styles.metricText, 
            isDark && styles.metricTextDark,
            activeMetric === 'protein' && styles.activeMetricText
          ]}
        >
          Protein
        </Text>
      </TouchableOpacity>
      <TouchableOpacity 
        style={[styles.metricButton, activeMetric === 'carbs' && styles.activeMetricButton]}
        onPress={() => setActiveMetric('carbs')}
      >
        <Text
          style={[
            styles.metricText, 
            isDark && styles.metricTextDark,
            activeMetric === 'carbs' && styles.activeMetricText
          ]}
        >
          Carbs
        </Text>
      </TouchableOpacity>
      <TouchableOpacity 
        style={[styles.metricButton, activeMetric === 'fat' && styles.activeMetricButton]}
        onPress={() => setActiveMetric('fat')}
      >
        <Text
          style={[
            styles.metricText, 
            isDark && styles.metricTextDark,
            activeMetric === 'fat' && styles.activeMetricText
          ]}
        >
          Fat
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderAvgNutritionCard = () => {
    const avg = getAverageNutrition();
    return (
      <View style={[styles.avgNutritionCard, isDark && styles.cardDark]}>
        <Text style={[styles.cardTitle, isDark && styles.cardTitleDark]}>
          Daily Average
        </Text>
        <View style={styles.avgNutritionGrid}>
          <View style={styles.avgNutritionItem}>
            <Text style={styles.avgNutritionValue}>
              {avg.calories}
            </Text>
            <Text style={[styles.avgNutritionLabel, isDark && styles.labelDark]}>
              Calories
            </Text>
          </View>
          <View style={styles.avgNutritionItem}>
            <Text style={styles.avgNutritionValue}>
              {avg.protein}g
            </Text>
            <Text style={[styles.avgNutritionLabel, isDark && styles.labelDark]}>
              Protein
            </Text>
          </View>
          <View style={styles.avgNutritionItem}>
            <Text style={styles.avgNutritionValue}>
              {avg.carbs}g
            </Text>
            <Text style={[styles.avgNutritionLabel, isDark && styles.labelDark]}>
              Carbs
            </Text>
          </View>
          <View style={styles.avgNutritionItem}>
            <Text style={styles.avgNutritionValue}>
              {avg.fat}g
            </Text>
            <Text style={[styles.avgNutritionLabel, isDark && styles.labelDark]}>
              Fat
            </Text>
          </View>
        </View>
      </View>
    );
  };

  const renderTrendChart = () => {
    if (dateRange === 'year' && weeklyData.length > 0) {
      // Weekly chart for the last year
      const metricData = weeklyData.map(week => week[activeMetric]);
      const labels = weeklyData.map((week, index) => 
        index % Math.ceil(weeklyData.length / 5) === 0 ? week.week.split('-')[1].replace('W', '') : ''
      );
      const chartData = {
        labels,
        datasets: [
          {
            data: metricData,
            color: (opacity = 1) => `rgba(46, 204, 113, ${opacity})`,
            strokeWidth: 2
          }
        ],
        legend: [`Weekly ${activeMetric.charAt(0).toUpperCase() + activeMetric.slice(1)}`]
      };
      return (
        <View style={[styles.chartContainer, isDark && styles.cardDark]}>
          <Text style={[styles.chartTitle, isDark && styles.cardTitleDark]}>
            {activeMetric.charAt(0).toUpperCase() + activeMetric.slice(1)} Trends
          </Text>
          <View style={styles.chartWrapper}>
            <LineChart
              data={chartData}
              width={screenWidth}
              height={220}
              chartConfig={chartConfig}
              bezier
              style={styles.chart}
            />
          </View>
        </View>
      );
    } else if (dailyData.length > 0) {
      // For week, month, and 3months, use daily data
      const numberOfDays = dateRange === 'week' ? 7 : dateRange === 'month' ? 30 : 90;
      const displayData = dailyData.slice(-numberOfDays);
      const metricData = displayData.map(day => day[activeMetric]);
      const labels = displayData.map((day, index) => 
        index % Math.ceil(displayData.length / 5) === 0 ? formatDateLabel(day.date) : ''
      );
      const chartData = {
        labels,
        datasets: [
          {
            data: metricData,
            color: (opacity = 1) => `rgba(46, 204, 113, ${opacity})`,
            strokeWidth: 2
          }
        ],
        legend: [`Daily ${activeMetric.charAt(0).toUpperCase() + activeMetric.slice(1)}`]
      };
      return (
        <View style={[styles.chartContainer, isDark && styles.cardDark]}>
          <Text style={[styles.chartTitle, isDark && styles.cardTitleDark]}>
            {activeMetric.charAt(0).toUpperCase() + activeMetric.slice(1)} Trends
          </Text>
          <View style={styles.chartWrapper}>
            <LineChart
              data={chartData}
              width={screenWidth}
              height={220}
              chartConfig={chartConfig}
              bezier
              style={styles.chart}
            />
          </View>
        </View>
      );
    }
    return (
      <View style={[styles.emptyChartContainer, isDark && styles.cardDark]}>
        <Text style={[styles.emptyChartText, isDark && styles.emptyChartTextDark]}>
          Not enough data to display trends
        </Text>
      </View>
    );
  };

  const renderMacroDistributionChart = () => {
    if (dailyData.length === 0) {
      return (
        <View style={[styles.emptyChartContainer, isDark && styles.cardDark]}>
          <Text style={[styles.emptyChartText, isDark && styles.emptyChartTextDark]}>
            Not enough data to display macro distribution
          </Text>
        </View>
      );
    }
    const avg = getAverageNutrition();
    const proteinCalories = avg.protein * 4;
    const carbsCalories = avg.carbs * 4;
    const fatCalories = avg.fat * 9;
    const totalCalories = proteinCalories + carbsCalories + fatCalories;

    if (totalCalories === 0) {
      return (
        <View style={[styles.emptyChartContainer, isDark && styles.cardDark]}>
          <Text style={[styles.emptyChartText, isDark && styles.emptyChartTextDark]}>
            Not enough data to display macro distribution
          </Text>
        </View>
      );
    }
    const data = [
      {
        name: 'Protein',
        value: proteinCalories,
        color: '#3498db',
        legendFontColor: isDark ? '#f2f2f2' : '#333',
        legendFontSize: 12
      },
      {
        name: 'Carbs',
        value: carbsCalories,
        color: '#f39c12',
        legendFontColor: isDark ? '#f2f2f2' : '#333',
        legendFontSize: 12
      },
      {
        name: 'Fat',
        value: fatCalories,
        color: '#e74c3c',
        legendFontColor: isDark ? '#f2f2f2' : '#333',
        legendFontSize: 12
      }
    ];
    return (
      <View style={[styles.chartContainer, isDark && styles.cardDark]}>
        <Text style={[styles.chartTitle, isDark && styles.cardTitleDark]}>
          Macro Distribution (Calories)
        </Text>
        <PieChart
          data={data}
          width={screenWidth}
          height={220}
          chartConfig={chartConfig}
          accessor="value"
          backgroundColor="transparent"
          paddingLeft="30"
          absolute
        />
      </View>
    );
  };

  const renderMealLocationChart = () => {
    const meals = filterMealsByDateRange();
    const restaurantCount = meals.filter(meal => meal.location?.type === 'restaurant').length;
    const homeCount = meals.filter(meal => meal.location?.type === 'custom').length;

    if (meals.length === 0 || (restaurantCount === 0 && homeCount === 0)) {
      return (
        <View style={[styles.emptyChartContainer, isDark && styles.cardDark]}>
          <Text style={[styles.emptyChartText, isDark && styles.emptyChartTextDark]}>
            Not enough data to display meal locations
          </Text>
        </View>
      );
    }
    const data = [
      {
        name: 'Restaurant',
        value: restaurantCount,
        color: '#ff6b6b',
        legendFontColor: isDark ? '#f2f2f2' : '#333',
        legendFontSize: 12
      },
      {
        name: 'Home',
        value: homeCount,
        color: '#2ecc71',
        legendFontColor: isDark ? '#f2f2f2' : '#333',
        legendFontSize: 12
      }
    ];
    return (
      <View style={[styles.chartContainer, isDark && styles.cardDark]}>
        <Text style={[styles.chartTitle, isDark && styles.cardTitleDark]}>
          Meal Location Distribution
        </Text>
        <PieChart
          data={data}
          width={screenWidth}
          height={220}
          chartConfig={chartConfig}
          accessor="value"
          backgroundColor="transparent"
          paddingLeft="30"
          absolute
        />
        <TouchableOpacity 
          style={styles.viewMapButton}
          onPress={navigateToMapView}
        >
          <MapIcon size={16} color="#fff" />
          <Text style={styles.viewMapButtonText}>View Location Map</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderMealCountByTypeChart = () => {
    const meals = filterMealsByDateRange();
    const breakfastCount = meals.filter(meal => meal.mealType === 'breakfast').length;
    const lunchCount = meals.filter(meal => meal.mealType === 'lunch').length;
    const dinnerCount = meals.filter(meal => meal.mealType === 'dinner').length;
    const snackCount = meals.filter(meal => meal.mealType === 'snack').length;
    const otherCount = meals.filter(meal => !meal.mealType).length;

    if (meals.length === 0) {
      return (
        <View style={[styles.emptyChartContainer, isDark && styles.cardDark]}>
          <Text style={[styles.emptyChartText, isDark && styles.emptyChartTextDark]}>
            Not enough data to display meal types
          </Text>
        </View>
      );
    }
    const data = {
      labels: ['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Other'],
      datasets: [
        {
          data: [breakfastCount, lunchCount, dinnerCount, snackCount, otherCount],
        }
      ]
    };
    return (
      <View style={[styles.chartContainer, isDark && styles.cardDark]}>
        <Text style={[styles.chartTitle, isDark && styles.cardTitleDark]}>
          Meal Distribution by Type
        </Text>
        <BarChart
          data={data}
          width={screenWidth}
          height={220}
          chartConfig={{
            ...chartConfig,
            barPercentage: 0.7,
          }}
          style={styles.chart}
          fromZero
        />
      </View>
    );
  };

  const renderInsights = () => {
    if (insights.length === 0) {
      return (
        <View style={[styles.emptyInsightsContainer, isDark && styles.cardDark]}>
          <Text style={[styles.emptyInsightsText, isDark && styles.emptyInsightsTextDark]}>
            Log more meals to receive personalized insights about your nutrition patterns.
          </Text>
        </View>
      );
    }
    return (
      <View style={[styles.insightsContainer, isDark && styles.cardDark]}>
        <Text style={[styles.insightsTitle, isDark && styles.cardTitleDark]}>
          Personalized Insights
        </Text>
        {insights.map((insight, index) => (
          <View key={index} style={[styles.insightItem, isDark && styles.insightItemDark]}>
            <Text style={[styles.insightText, isDark && styles.insightTextDark]}>
              {insight}
            </Text>
          </View>
        ))}
      </View>
    );
  };

  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
      <View style={[styles.header, isDark && styles.headerDark]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color="#2ecc71" />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, isDark && styles.textLight]}>
          Nutrition Analytics
        </Text>
        {renderDateRangeSelector()}
      </View>

      {loading ? (
        <View style={[styles.loadingContainer, isDark && styles.loadingContainerDark]}>
          <ActivityIndicator size="large" color="#2ecc71" />
          <Text style={[styles.loadingText, isDark && styles.textLight]}>
            Loading analytics...
          </Text>
        </View>
      ) : error ? (
        <View style={[styles.errorContainer, isDark && styles.errorContainerDark]}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={fetchMealHistoryAndUserData}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : mealHistory.length === 0 ? (
        <View style={[styles.emptyContainer, isDark && styles.emptyContainerDark]}>
          <Text style={[styles.emptyText, isDark && styles.textLight]}>
            No meal data found
          </Text>
          <TouchableOpacity
            style={styles.addMealButton}
            onPress={() => router.push('/(app)/meal-logging')}
          >
            <Text style={styles.addMealButtonText}>Log Your First Meal</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView 
          style={[styles.scrollView, isDark && styles.scrollViewDark]} 
          contentContainerStyle={styles.contentContainer}
        >
          {renderAvgNutritionCard()}
          {renderMetricSelector()}
          {renderTrendChart()}
          {renderMacroDistributionChart()}
          {renderMealCountByTypeChart()}
          {renderMealLocationChart()}
          {renderInsights()}
          <View style={styles.bottomSpacer} />
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  // Container / Layout
  container: {
    flex: 1,
    backgroundColor: '#f9f9f9',
  },
  containerDark: {
    backgroundColor: '#121212',
  },
  scrollView: {
    flex: 1,
  },
  scrollViewDark: {
    backgroundColor: '#121212',
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingBottom: 90, // extra space for bottom tab bar
  },
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    paddingBottom: 16,
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    // ensure children can appear above other components
    zIndex: 99,
    overflow: 'visible',
  },
  headerDark: {
    backgroundColor: '#1e1e1e',
    shadowColor: '#000',
  },
  backButton: {
    padding: 4,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2ecc71',
    flex: 1,
  },
  textLight: {
    color: '#f2f2f2',
  },
  // Date Range Selector
  dateRangeContainer: {
    position: 'relative',
    zIndex: 9999, // ensure dropdown above all
  },
  dateRangeSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
  },
  dateRangeSelectorDark: {
    backgroundColor: '#2a2a2a',
  },
  dateRangeText: {
    fontSize: 14,
    color: '#333',
    marginRight: 4,
  },
  dateRangeDropdown: {
    position: 'absolute',
    top: 40,
    right: 0,
    backgroundColor: 'white',
    borderRadius: 8,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
    width: 140,
    zIndex: 9999,
  },
  dateRangeDropdownDark: {
    backgroundColor: '#1e1e1e',
    shadowColor: '#000',
  },
  dateRangeOption: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  optionText: {
    fontSize: 14,
    color: '#333',
  },
  optionTextDark: {
    color: '#f2f2f2',
  },
  selectedOptionText: {
    fontSize: 14,
    color: '#2ecc71',
    fontWeight: 'bold',
  },
  selectedOptionTextDark: {
    color: '#2ecc71',
  },
  // Loading / Error / Empty states
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainerDark: {
    backgroundColor: '#121212',
  },
  loadingText: {
    marginTop: 16,
    color: '#666',
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorContainerDark: {
    backgroundColor: '#121212',
  },
  errorText: {
    color: '#ff6b6b',
    marginBottom: 16,
    textAlign: 'center',
    fontSize: 16,
  },
  retryButton: {
    backgroundColor: '#2ecc71',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyContainerDark: {
    backgroundColor: '#121212',
  },
  emptyText: {
    color: '#666',
    marginBottom: 16,
    fontSize: 16,
  },
  addMealButton: {
    backgroundColor: '#2ecc71',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  addMealButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  // Average Nutrition
  avgNutritionCard: {
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
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  cardTitleDark: {
    color: '#f2f2f2',
  },
  avgNutritionGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  avgNutritionItem: {
    alignItems: 'center',
  },
  avgNutritionValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2ecc71',
    marginBottom: 4,
  },
  avgNutritionLabel: {
    fontSize: 12,
    color: '#666',
  },
  labelDark: {
    color: '#aaa',
  },
  // Metric Selector
  metricSelectorContainer: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
    overflow: 'hidden',
  },
  metricSelectorContainerDark: {
    backgroundColor: '#1e1e1e',
  },
  metricButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  activeMetricButton: {
    backgroundColor: '#2ecc71',
  },
  metricText: {
    fontSize: 14,
    color: '#666',
  },
  metricTextDark: {
    color: '#aaa',
  },
  activeMetricText: {
    color: 'white',
    fontWeight: 'bold',
  },
  // Chart Containers
  chartContainer: {
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
  chartWrapper: {
    alignItems: 'center',
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  chart: {
    // Slight left shift to fit labels
    borderRadius: 12,
    marginLeft: -8,
  },
  emptyChartContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 180,
  },
  emptyChartText: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
  },
  emptyChartTextDark: {
    color: '#aaa',
  },
  // Meal Location
  viewMapButton: {
    flexDirection: 'row',
    backgroundColor: '#2ecc71',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignItems: 'center',
    marginTop: 16,
    alignSelf: 'center',
  },
  viewMapButtonText: {
    color: 'white',
    fontWeight: 'bold',
    marginLeft: 8,
  },
  // Insights
  insightsContainer: {
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
  insightsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  insightItem: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#2ecc71',
  },
  insightItemDark: {
    backgroundColor: '#252525',
    borderLeftColor: '#2ecc71',
  },
  insightText: {
    color: '#333',
    fontSize: 14,
    lineHeight: 20,
  },
  insightTextDark: {
    color: '#e0e0e0',
  },
  emptyInsightsContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 100,
  },
  emptyInsightsText: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  emptyInsightsTextDark: {
    color: '#aaa',
  },
  // Bottom spacer
  bottomSpacer: {
    height: 80, // extra space for the bottom tab bar
  },
});

export default DiningAnalyticsScreen;