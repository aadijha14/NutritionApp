// meal-recommendation.mjs
import OpenAI from "openai";
import readline from "readline";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";

// --------------------
// 1. Firebase config
// --------------------
const firebaseConfig = {
  apiKey: "AIzaSyAhhsZ2bmpr85rQ5p9PPwFmxd1KOZEEXuU",
  authDomain: "sc2006-75145.firebaseapp.com",
  projectId: "sc2006-75145",
  storageBucket: "sc2006-75145.appspot.com",
  messagingSenderId: "293976246944",
  appId: "1:293976246944:web:8111803c48e8aa710357c5",
  measurementId: "G-CJ6KL48GM2"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// --------------------
// 2. OpenAI (DeepSeek) init
// --------------------
const openai = new OpenAI({
  apiKey: "sk-95593a35636148368ec4a6d868bf1bb8", // your DeepSeek key
  baseURL: "https://api.deepseek.com"
});

// --------------------
// 3. Meal Times
// --------------------
// You can edit these to test different ranges.
const mealTimes = [
  { name: "breakfast", start: "08:00", end: "10:00" },
  { name: "lunch",     start: "12:00", end: "14:00" },
  { name: "snack",     start: "15:00", end: "16:00" },
  { name: "dinner",    start: "18:00", end: "20:00" }
];

/**
 * If DeepSeek decides to add an extra snack, it should schedule it
 * at a time that makes sense after dinner or between meals.
 */

// --------------------
// 4. Location (for distance calc)
// --------------------
const LATITUDE = 1.355049655134308;
const LONGITUDE = 103.68518139204353;

// --------------------
// 5. CLI Setup
// --------------------
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function ask(q) {
  return new Promise((res) => rl.question(q, res));
}

// --------------------
// 6. Distance Calculation
// --------------------
function getDistance(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => deg * (Math.PI / 180);
  const R = 6371; // radius of Earth in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// --------------------
// 7. Fetch Nearby Menu Items from Firestore
// --------------------
async function fetchNearbyMenuItems() {
  const snapshot = await getDocs(collection(db, "restaurants"));
  const nearbyItems = [];

  snapshot.forEach((doc) => {
    const data = doc.data();
    // Check distance within 2km
    if (data.location) {
      const dist = getDistance(
        data.location.lat,
        data.location.lng,
        LATITUDE,
        LONGITUDE
      );
      if (dist < 2.0 && data.items) {
        for (const item of data.items) {
          // Attach restaurant name AND address
          nearbyItems.push({
            ...item,
            restaurantName: data.name,
            restaurantAddress: data.address || ""
          });
        }
      }
    }
  });

  return nearbyItems;
}

// --------------------
// 8. Generate Meal Plan with DeepSeek
// --------------------
async function generateMealPlan(mealSettings, caloriesLeft, dietaryPreferences, feedback = "") {
  // Get possible items
  const menuItems = await fetchNearbyMenuItems();

  // Build a list of items for each meal (restaurant vs. home)
  const availableByMeal = {};
  for (const [meal, setting] of Object.entries(mealSettings)) {
    if (setting === "restaurant") {
      // Present only items from Firestore
      const items = menuItems.map(
        (i) =>
          `${i.foodName} (${i.calories} kcal) from ${i.restaurantName} [Address: ${i.restaurantAddress}]`
      );
      availableByMeal[meal] = items.length
        ? items.join("\n")
        : "No dishes found";
    } else {
      // "home" => user can cook or create anything
      availableByMeal[meal] = "User will cook at home. You can invent any realistic dish.";
    }
  }

  // Combine dietary preferences
  const dietLabels = dietaryPreferences.length
    ? dietaryPreferences.join(", ")
    : "None";

  // We also provide the meal times and instructions for extra snack
  const timeInstructions = mealTimes
    .map(
      (t) => `- ${t.name}: ${t.start} - ${t.end}`
    )
    .join("\n");

  /**
   * We tell DeepSeek:
   * 1. Use only the provided calorie counts from the data.
   * 2. If an extra snack is needed, schedule it after dinner or a healthy gap.
   * 3. Include the restaurant address if using restaurant items.
   * 4. Return results with the new "Time Range" field as well.
   */

  const messages = [
    {
      role: "system",
      content: `You are a meal recommendation assistant. 
Only return answers in the format specified by the user. 
Never guess the calories for restaurant items; use the data provided.`
    },
    {
      role: "user",
      content: `
Generate a meal plan for today with these constraints:

**Calories Remaining**: ${caloriesLeft} kcal
**Dietary Preferences**: ${dietLabels}
**User Feedback**: ${feedback || "None"}

We have four guaranteed meals: breakfast, lunch, snack, dinner.
Time ranges:
${timeInstructions}

If you need to add an extra snack to fit leftover calories, do so at a healthy time after dinner or between existing meals.

For each meal, output in this format exactly:

---
**Meal**: <meal name>
**Time Range**: <time range>
**Dish**: <dish name>
**Calories**: <kcal>
**Restaurant**: <restaurant name or 'home'>
**Address**: <restaurant address or 'N/A'>
**Why this dish**: <short reason>
---

Available dishes per meal:

${Object.entries(availableByMeal)
  .map(
    ([meal, list]) => `\n🍽️ ${meal.toUpperCase()}:\n${list}`
  )
  .join("\n")}
`
    }
  ];

  // Request completion from DeepSeek
  const completion = await openai.chat.completions.create({
    model: "deepseek-chat",
    messages
  });

  console.log(`\n🌟 Here's your meal plan:\n${completion.choices[0].message.content}`);
  return completion.choices[0].message.content;
}

// --------------------
// 9. Main Interaction
// --------------------
async function main() {
  // 1) Ask user for total calories
  const totalCalories = parseInt(
    await ask("How many calories do you have remaining today? ")
  );

  // 2) Ask for meal settings (home/restaurant) for the 4 guaranteed meals
  const mealSettings = {};
  for (const t of mealTimes) {
    const setting = await ask(
      `For ${t.name}, do you want to eat at home or restaurant? (home/restaurant): `
    );
    mealSettings[t.name] = setting.toLowerCase() === "restaurant" ? "restaurant" : "home";
  }

  // 3) Ask for dietary preferences
  const prefInput = await ask(
    `Choose your dietary preferences (comma-separated numbers):
0: vegetarian
1: vegan
2: ketogenic
3: dairyFree
4: glutenFree
5: paleo
> `
  );
  const dietOptions = [
    "vegetarian",
    "vegan",
    "ketogenic",
    "dairyFree",
    "glutenFree",
    "paleo"
  ];
  const dietaryPrefs = prefInput
    .split(",")
    .map((x) => x.trim())
    .filter((x) => x !== "")
    .map((i) => dietOptions[parseInt(i, 10)])
    .filter(Boolean);

  // 4) Generate the initial plan
  let plan = await generateMealPlan(mealSettings, totalCalories, dietaryPrefs);

  // 5) Loop: ask user if they want to regenerate or swap
  while (true) {
    const action = await ask(
      "\n🔁 Do you want to [1] Regenerate full plan, [2] Swap one meal, or [Enter] to exit? "
    );
    if (action === "1") {
      // Regenerate full plan
      const reason = await ask("Why do you want to regenerate the plan? (optional input): ");
      plan = await generateMealPlan(mealSettings, totalCalories, dietaryPrefs, reason);
    } else if (action === "2") {
      // Swap one meal
      const swapMeal = await ask(
        "Which meal do you want to swap? (breakfast/lunch/snack/dinner): "
      );
      const reason = await ask("Any comments on why you're swapping " + swapMeal + "? (optional): ");

      // Build the user prompt for that single meal swap
      const mealItems = mealSettings[swapMeal] === "restaurant"
        ? (await fetchNearbyMenuItems())
          .map(
            (i) => `${i.foodName} (${i.calories} kcal) from ${i.restaurantName} [Address: ${i.restaurantAddress}]`
          )
          .join("\n")
        : "User will cook at home. Be creative!";

      const messages = [
        {
          role: "system",
          content: `You are a meal swapping assistant. Only return the swapped meal in the format specified. 
Use only the provided calories from the data.`
        },
        {
          role: "user",
          content: `
I want to swap just one meal.

**Meal to swap**: ${swapMeal}
**Reason**: ${reason || "None"}
**Calories Remaining**: ${totalCalories}
**Dietary Preferences**: ${dietaryPrefs.join(", ") || "None"}
**Meal Setting**: ${mealSettings[swapMeal]}

Time range for ${swapMeal}:
${mealTimes.find((m) => m.name === swapMeal) ? `${mealTimes.find((m) => m.name === swapMeal).start} - ${mealTimes.find((m) => m.name === swapMeal).end}` : "N/A"}

Here are available dishes for this meal:
${mealItems}

Only return this format:
---
**Meal**: ${swapMeal}
**Time Range**: <time range>
**Dish**: <dish name>
**Calories**: <kcal>
**Restaurant**: <restaurant name or 'home'>
**Address**: <restaurant address or 'N/A'>
**Why this dish**: <reason>
---
`
        }
      ];

      const result = await openai.chat.completions.create({
        model: "deepseek-chat",
        messages
      });

      console.log(`\n✅ Swapped meal:\n${result.choices[0].message.content}`);
    } else {
      // Exit
      rl.close();
      break;
    }
  }
}

main();