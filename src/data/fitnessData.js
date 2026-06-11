// ─── Shared Fitness Constants ─────────────────────────────────────────────────
// Imported by both Fitness.jsx and Dashboard.jsx

export const MACRO_TARGETS = { cal: 1400, protein: 145, carbs: 130, fat: 42 }

export const BODY_STATS = {
  startWeight: 148.8,
  goalWeight:  130,
  startBF:     42.6,
  muscleMass:  46.5,
}

// Keyed by JS day-of-week (0=Sunday … 6=Saturday)
export const PLAN_DAYS = {
  1: {
    name: 'Glute & Hamstring Heavy',
    day: 'Monday', emoji: '🍑',
    color: '#9e4040', bg: '#fde8e5', border: '#f5c4c0',
    warmup:   'Banded clamshells 2×15, glute bridges 2×20, hip circles, leg swings, 5 min incline walk.',
    cooldown: "Pigeon pose (2 min each), seated figure-4, child's pose, deep breathing.",
    exercises: [
      { name: 'Barbell Hip Thrust',   sets: '4 × 10–12',    tip: 'Drive through heels, squeeze hard at top for 1 sec. Rest 90 sec.' },
      { name: 'Romanian Deadlift',    sets: '3 × 10–12',    tip: 'Hinge at hip, flat back, hamstring stretch. 3-sec descent.' },
      { name: 'Banded Lateral Walk',  sets: '3 × 15 each',  tip: 'Stay low in squat, push knees OUT against band.' },
      { name: 'Cable Glute Kickback', sets: '3 × 15 each',  tip: 'Slow and controlled. Squeeze glute at peak.' },
      { name: 'Goblet Squat',         sets: '3 × 12',       tip: 'Dumbbell at chest, sit DEEP, drive knees out.' },
    ],
  },
  2: {
    name: 'Upper Body Tone + Core',
    day: 'Tuesday', emoji: '💪',
    color: '#1d4ed8', bg: '#eff6ff', border: '#93c5fd',
    warmup:   'Arm circles, band pull-aparts 2×15, cat-cow 10 reps, dead bug 2×8.',
    cooldown: 'Chest opener, shoulder cross stretch, tricep stretch.',
    exercises: [
      { name: 'Dumbbell Shoulder Press',  sets: '3 × 10–12',   tip: "Don't flare elbows. Core braced. Toned round shoulders." },
      { name: 'Bench Tricep Dips',        sets: '3 × 12–15',   tip: 'Back close to bench. Dip to 90°, press back up.' },
      { name: 'Forearm Plank',            sets: '3 × 30–45 s', tip: 'No coning or doming — drop to knees if needed.' },
      { name: 'Dumbbell Lateral Raises',  sets: '3 × 15',      tip: 'Lead with elbows. Slow on way down.' },
      { name: 'Dead Bug',                 sets: '3 × 8 each',  tip: 'Press lower back INTO floor. Critical postpartum core move.' },
      { name: 'Bicep Curls (alternating)', sets: '3 × 12',     tip: 'Squeeze at top, 3-sec lowering. Elbows pinned to ribs.' },
    ],
  },
  3: {
    name: 'Quad & Leg Volume Day',
    day: 'Wednesday', emoji: '🦵',
    color: '#15803d', bg: '#f0fdf4', border: '#86efac',
    warmup:   '5 min incline walk or bike, leg swings, hip flexor lunge, wall squat 2×30 sec.',
    cooldown: 'Quad stretch, hamstring stretch, hip flexor lunge.',
    exercises: [
      { name: 'Barbell Back Squat (or Leg Press)', sets: '4 × 8–10',    tip: 'Sit back and DOWN. Break parallel if able.' },
      { name: 'Dumbbell Walking Lunges',           sets: '3 × 12 each', tip: "Long stride, back knee hovers 1\" off floor." },
      { name: 'Lying Leg Curl Machine',            sets: '3 × 12–15',   tip: 'Hold 1 sec at peak. Slow 3-sec lowering.' },
      { name: 'Sumo Squat + Pulses',               sets: '3 × 15+15',   tip: 'Wide stance, deep squat, 15 pulses at bottom.' },
      { name: 'Dumbbell Step-Ups',                 sets: '3 × 10 each', tip: 'Drive through heel to activate glute.' },
    ],
  },
  4: {
    name: 'Upper Body + Abs',
    day: 'Thursday', emoji: '💪',
    color: '#1d4ed8', bg: '#eff6ff', border: '#93c5fd',
    warmup:   'Band pull-aparts, thoracic rotations, shoulder rolls.',
    cooldown: 'Chest opener, lat stretch, tricep stretch.',
    exercises: [
      { name: 'Incline Dumbbell Chest Press', sets: '3 × 10–12', tip: 'Set bench 30–45°. Press up and slightly in.' },
      { name: 'Cable Row or Dumbbell Row',    sets: '3 × 12',    tip: 'Pull elbows past torso, squeeze shoulder blades.' },
      { name: 'Cable Tricep Pushdown',        sets: '3 × 15',    tip: 'Elbows locked to sides, splay rope at bottom.' },
      { name: 'Plank to Downward Dog',        sets: '3 × 10',    tip: 'High plank → V-shape. Core + shoulders + hamstrings.' },
      { name: 'Postpartum Abs Circuit',       sets: '3 rounds',  tip: 'Dead bug ×8 + Heel slides ×10 + Pallof press ×10. NO crunches.' },
    ],
  },
  5: {
    name: 'Full Body Glute Burn + Cardio',
    day: 'Friday', emoji: '🔥',
    color: '#b45309', bg: '#fffbeb', border: '#fcd34d',
    warmup:   '10 min incline treadmill walk at 3.5 mph / 10–12% incline.',
    cooldown: "10 min full-body stretch — pigeon, hamstring, hip flexor, chest, child's pose.",
    exercises: [
      { name: 'Single Leg Hip Thrust',      sets: '3 × 12 each', tip: 'Drive through planted heel. Fixes glute imbalances.' },
      { name: 'Banded Donkey Kickback',     sets: '3 × 20 each', tip: 'Point toes to ceiling at peak. Do NOT rotate hip.' },
      { name: 'Incline Treadmill Walk (LISS)', sets: '20–30 min',tip: '10–15% incline, 3.0–3.5 mph. Do NOT hold rails.' },
      { name: 'Farmer Carry',               sets: '3 × 30m',     tip: 'Heavy dumbbells at sides. Anti-rotation core work.' },
    ],
  },
  6: {
    name: 'Active Rest Day',
    day: 'Saturday', emoji: '✨',
    color: '#6b6860', bg: '#f0efe9', border: '#e2dfd8',
    warmup: '', cooldown: 'Foam roll, deep breathing. You showed up all week! 🌸',
    exercises: [
      { name: 'Light Walk / Stroller Walk', sets: '30 min',    tip: 'Stay active but keep it easy.' },
      { name: 'Full Body Stretching',       sets: '15–20 min', tip: 'Focus on hips, hamstrings, and chest.' },
    ],
  },
  0: {
    name: 'Rest & Recovery',
    day: 'Sunday', emoji: '🌸',
    color: '#c2396e', bg: '#fef0f6', border: '#f5c2d8',
    warmup: '', cooldown: "Meal prep, lay out gym clothes, review this week's plan.",
    exercises: [
      { name: 'Full Rest Day',       sets: '',       tip: 'Muscles rebuild stronger on rest days. Trust the process.' },
      { name: 'Foam Roll / Stretch', sets: '20 min', tip: 'Target quads, IT band, glutes, hip flexors.' },
    ],
  },
}

export const MEALS_LIST = ['Breakfast', 'Lunch', 'Dinner', 'Snacks']

// ─── Built-in Food Database (USDA-verified, offline) ─────────────────────────
// Values are PER listed servingSize. ~120 common foods across all categories.
export const FOOD_DB = [
  // ── Proteins ──────────────────────────────────────────────────────────────
  { name: 'Chicken Breast (grilled)',        servingSize: '3 oz (85g)',   cal: 128, protein: 26, carbs: 0,  fat: 3,  fiber: 0,   sugar: 0   },
  { name: 'Chicken Breast (baked)',          servingSize: '4 oz (113g)',  cal: 170, protein: 35, carbs: 0,  fat: 4,  fiber: 0,   sugar: 0   },
  { name: 'Ground Turkey (93% lean)',        servingSize: '4 oz (113g)',  cal: 170, protein: 22, carbs: 0,  fat: 9,  fiber: 0,   sugar: 0   },
  { name: 'Ground Beef (90% lean)',          servingSize: '4 oz (113g)',  cal: 196, protein: 22, carbs: 0,  fat: 11, fiber: 0,   sugar: 0   },
  { name: 'Salmon (baked)',                  servingSize: '4 oz (113g)',  cal: 185, protein: 25, carbs: 0,  fat: 9,  fiber: 0,   sugar: 0   },
  { name: 'Tuna (canned in water)',          servingSize: '3 oz (85g)',   cal: 100, protein: 22, carbs: 0,  fat: 1,  fiber: 0,   sugar: 0   },
  { name: 'Shrimp (cooked)',                 servingSize: '3 oz (85g)',   cal: 84,  protein: 18, carbs: 0,  fat: 1,  fiber: 0,   sugar: 0   },
  { name: 'Tilapia (baked)',                 servingSize: '4 oz (113g)',  cal: 110, protein: 23, carbs: 0,  fat: 2,  fiber: 0,   sugar: 0   },
  { name: 'Egg (whole, large)',              servingSize: '1 large',      cal: 72,  protein: 6,  carbs: 0,  fat: 5,  fiber: 0,   sugar: 0   },
  { name: 'Egg White',                       servingSize: '1 large',      cal: 17,  protein: 4,  carbs: 0,  fat: 0,  fiber: 0,   sugar: 0   },
  { name: 'Eggs (2 scrambled)',              servingSize: '2 eggs',       cal: 182, protein: 12, carbs: 1,  fat: 14, fiber: 0,   sugar: 1   },
  { name: 'Greek Yogurt (plain, nonfat)',    servingSize: '3/4 cup (170g)',cal: 100, protein: 17, carbs: 6,  fat: 0,  fiber: 0,   sugar: 6   },
  { name: 'Greek Yogurt (plain, 2%)',        servingSize: '3/4 cup (170g)',cal: 130, protein: 16, carbs: 7,  fat: 4,  fiber: 0,   sugar: 7   },
  { name: 'Cottage Cheese (low-fat)',        servingSize: '1/2 cup (113g)',cal: 90,  protein: 12, carbs: 5,  fat: 2,  fiber: 0,   sugar: 4   },
  { name: 'Protein Shake (whey, 1 scoop)',   servingSize: '1 scoop (30g)',cal: 120, protein: 25, carbs: 3,  fat: 1,  fiber: 0,   sugar: 1   },
  { name: 'Steak (sirloin, grilled)',        servingSize: '4 oz (113g)',  cal: 207, protein: 26, carbs: 0,  fat: 11, fiber: 0,   sugar: 0   },
  { name: 'Deli Turkey Breast',             servingSize: '2 oz (57g)',    cal: 60,  protein: 12, carbs: 1,  fat: 1,  fiber: 0,   sugar: 1   },

  // ── Dairy & Eggs ──────────────────────────────────────────────────────────
  { name: 'Milk (whole)',                    servingSize: '1 cup (244ml)', cal: 149, protein: 8,  carbs: 12, fat: 8,  fiber: 0,   sugar: 12  },
  { name: 'Milk (2%)',                       servingSize: '1 cup (244ml)', cal: 122, protein: 8,  carbs: 12, fat: 5,  fiber: 0,   sugar: 12  },
  { name: 'Almond Milk (unsweetened)',       servingSize: '1 cup (240ml)', cal: 30,  protein: 1,  carbs: 1,  fat: 3,  fiber: 1,   sugar: 0   },
  { name: 'String Cheese',                  servingSize: '1 stick (28g)', cal: 80,  protein: 7,  carbs: 0,  fat: 5,  fiber: 0,   sugar: 0   },
  { name: 'Cheddar Cheese',                 servingSize: '1 oz (28g)',    cal: 113, protein: 7,  carbs: 0,  fat: 9,  fiber: 0,   sugar: 0   },
  { name: 'Mozzarella (part-skim)',         servingSize: '1 oz (28g)',    cal: 72,  protein: 7,  carbs: 1,  fat: 5,  fiber: 0,   sugar: 0   },

  // ── Carbs & Grains ────────────────────────────────────────────────────────
  { name: 'White Rice (cooked)',             servingSize: '1 cup (186g)',  cal: 242, protein: 4,  carbs: 53, fat: 0,  fiber: 0.5, sugar: 0   },
  { name: 'Brown Rice (cooked)',             servingSize: '1 cup (202g)',  cal: 248, protein: 5,  carbs: 52, fat: 2,  fiber: 3,   sugar: 0   },
  { name: 'White Rice (cooked, 1/2 cup)',   servingSize: '1/2 cup (93g)', cal: 121, protein: 2,  carbs: 27, fat: 0,  fiber: 0,   sugar: 0   },
  { name: 'Oatmeal (cooked)',               servingSize: '1 cup (234g)',  cal: 166, protein: 6,  carbs: 32, fat: 4,  fiber: 4,   sugar: 0   },
  { name: 'Oats (dry, old fashioned)',      servingSize: '1/2 cup (40g)', cal: 150, protein: 5,  carbs: 27, fat: 3,  fiber: 4,   sugar: 1   },
  { name: 'Sweet Potato (baked)',           servingSize: '1 medium (130g)',cal: 112, protein: 2,  carbs: 26, fat: 0,  fiber: 4,   sugar: 5   },
  { name: 'Sweet Potato (mashed)',          servingSize: '1/2 cup (100g)',cal: 90,  protein: 2,  carbs: 21, fat: 0,  fiber: 3,   sugar: 4   },
  { name: 'Whole Wheat Bread',              servingSize: '1 slice (43g)', cal: 110, protein: 5,  carbs: 20, fat: 2,  fiber: 3,   sugar: 3   },
  { name: 'White Bread',                    servingSize: '1 slice (33g)', cal: 79,  protein: 3,  carbs: 15, fat: 1,  fiber: 1,   sugar: 1   },
  { name: 'Bagel (plain)',                  servingSize: '1 medium (98g)',cal: 270, protein: 10, carbs: 53, fat: 1,  fiber: 2,   sugar: 5   },
  { name: 'Pasta (cooked)',                 servingSize: '1 cup (140g)',  cal: 220, protein: 8,  carbs: 43, fat: 1,  fiber: 3,   sugar: 1   },
  { name: 'Quinoa (cooked)',               servingSize: '1 cup (185g)',  cal: 222, protein: 8,  carbs: 39, fat: 4,  fiber: 5,   sugar: 0   },
  { name: 'Corn Tortilla',                  servingSize: '2 tortillas (50g)',cal: 110, protein: 3, carbs: 22, fat: 2, fiber: 3,  sugar: 0   },
  { name: 'Rice Cake (plain)',              servingSize: '2 cakes (18g)', cal: 70,  protein: 1,  carbs: 15, fat: 0,  fiber: 0,   sugar: 0   },

  // ── Fruits ────────────────────────────────────────────────────────────────
  { name: 'Banana',                         servingSize: '1 medium (118g)',cal: 105, protein: 1,  carbs: 27, fat: 0,  fiber: 3,   sugar: 14  },
  { name: 'Apple',                          servingSize: '1 medium (182g)',cal: 95,  protein: 0,  carbs: 25, fat: 0,  fiber: 4,   sugar: 19  },
  { name: 'Orange',                         servingSize: '1 medium (131g)',cal: 62,  protein: 1,  carbs: 15, fat: 0,  fiber: 3,   sugar: 12  },
  { name: 'Strawberries',                   servingSize: '1 cup (152g)',  cal: 49,  protein: 1,  carbs: 12, fat: 0,  fiber: 3,   sugar: 7   },
  { name: 'Blueberries',                    servingSize: '1 cup (148g)',  cal: 84,  protein: 1,  carbs: 21, fat: 0,  fiber: 4,   sugar: 15  },
  { name: 'Grapes',                         servingSize: '1 cup (151g)',  cal: 104, protein: 1,  carbs: 27, fat: 0,  fiber: 1,   sugar: 23  },
  { name: 'Mango (sliced)',                 servingSize: '1 cup (165g)',  cal: 99,  protein: 1,  carbs: 25, fat: 0,  fiber: 3,   sugar: 23  },
  { name: 'Avocado',                        servingSize: '1/2 medium (68g)',cal: 114, protein: 1, carbs: 6,  fat: 10, fiber: 5,   sugar: 0   },
  { name: 'Avocado (whole)',                servingSize: '1 whole (136g)', cal: 227, protein: 3, carbs: 12, fat: 21, fiber: 9,   sugar: 1   },
  { name: 'Watermelon',                     servingSize: '2 cups (280g)', cal: 85,  protein: 2,  carbs: 21, fat: 0,  fiber: 1,   sugar: 17  },
  { name: 'Pineapple (chunks)',             servingSize: '1 cup (165g)',  cal: 83,  protein: 1,  carbs: 22, fat: 0,  fiber: 2,   sugar: 16  },

  // ── Vegetables ────────────────────────────────────────────────────────────
  { name: 'Broccoli (steamed)',             servingSize: '1 cup (156g)',  cal: 55,  protein: 4,  carbs: 11, fat: 1,  fiber: 5,   sugar: 3   },
  { name: 'Broccoli (raw)',                 servingSize: '1 cup (91g)',   cal: 31,  protein: 3,  carbs: 6,  fat: 0,  fiber: 2,   sugar: 2   },
  { name: 'Spinach (raw)',                  servingSize: '2 cups (60g)',  cal: 14,  protein: 2,  carbs: 2,  fat: 0,  fiber: 1,   sugar: 0   },
  { name: 'Mixed Greens / Salad',           servingSize: '2 cups (60g)',  cal: 14,  protein: 1,  carbs: 2,  fat: 0,  fiber: 1,   sugar: 1   },
  { name: 'Romaine Lettuce',               servingSize: '2 cups (94g)',  cal: 16,  protein: 1,  carbs: 3,  fat: 0,  fiber: 2,   sugar: 1   },
  { name: 'Bell Pepper (red)',              servingSize: '1 medium (119g)',cal: 37,  protein: 1,  carbs: 7,  fat: 0,  fiber: 2,   sugar: 5   },
  { name: 'Cucumber',                       servingSize: '1 cup sliced (119g)',cal: 16, protein: 1, carbs: 4, fat: 0, fiber: 1, sugar: 2   },
  { name: 'Asparagus',                      servingSize: '1 cup (134g)',  cal: 27,  protein: 3,  carbs: 5,  fat: 0,  fiber: 3,   sugar: 2   },
  { name: 'Green Beans',                    servingSize: '1 cup (100g)',  cal: 31,  protein: 2,  carbs: 7,  fat: 0,  fiber: 3,   sugar: 2   },
  { name: 'Zucchini (cooked)',              servingSize: '1 cup (180g)',  cal: 27,  protein: 2,  carbs: 5,  fat: 0,  fiber: 2,   sugar: 4   },
  { name: 'Carrots (raw)',                  servingSize: '1 cup (128g)',  cal: 52,  protein: 1,  carbs: 12, fat: 0,  fiber: 4,   sugar: 6   },
  { name: 'Cauliflower (steamed)',          servingSize: '1 cup (124g)',  cal: 29,  protein: 2,  carbs: 5,  fat: 0,  fiber: 3,   sugar: 2   },
  { name: 'Edamame (shelled)',              servingSize: '1/2 cup (78g)', cal: 94,  protein: 9,  carbs: 7,  fat: 4,  fiber: 4,   sugar: 2   },
  { name: 'Baby Spinach (cooked)',          servingSize: '1 cup (180g)',  cal: 41,  protein: 5,  carbs: 7,  fat: 0,  fiber: 4,   sugar: 1   },

  // ── Legumes ───────────────────────────────────────────────────────────────
  { name: 'Black Beans (cooked)',           servingSize: '1/2 cup (86g)', cal: 114, protein: 8,  carbs: 20, fat: 0,  fiber: 8,   sugar: 0   },
  { name: 'Chickpeas (cooked)',             servingSize: '1/2 cup (82g)', cal: 134, protein: 7,  carbs: 22, fat: 2,  fiber: 6,   sugar: 4   },
  { name: 'Lentils (cooked)',               servingSize: '1/2 cup (99g)', cal: 115, protein: 9,  carbs: 20, fat: 0,  fiber: 8,   sugar: 2   },
  { name: 'Pinto Beans (cooked)',           servingSize: '1/2 cup (86g)', cal: 123, protein: 8,  carbs: 22, fat: 1,  fiber: 8,   sugar: 0   },

  // ── Fats & Oils ───────────────────────────────────────────────────────────
  { name: 'Olive Oil',                      servingSize: '1 tbsp (14g)',  cal: 119, protein: 0,  carbs: 0,  fat: 14, fiber: 0,   sugar: 0   },
  { name: 'Coconut Oil',                    servingSize: '1 tbsp (14g)',  cal: 121, protein: 0,  carbs: 0,  fat: 14, fiber: 0,   sugar: 0   },
  { name: 'Butter',                         servingSize: '1 tbsp (14g)',  cal: 102, protein: 0,  carbs: 0,  fat: 12, fiber: 0,   sugar: 0   },
  { name: 'Peanut Butter',                  servingSize: '2 tbsp (32g)',  cal: 191, protein: 7,  carbs: 7,  fat: 16, fiber: 2,   sugar: 3   },
  { name: 'Almond Butter',                  servingSize: '2 tbsp (32g)',  cal: 196, protein: 7,  carbs: 6,  fat: 18, fiber: 3,   sugar: 2   },
  { name: 'Almonds',                        servingSize: '1 oz (28g)',    cal: 164, protein: 6,  carbs: 6,  fat: 14, fiber: 3,   sugar: 1   },
  { name: 'Walnuts',                        servingSize: '1 oz (28g)',    cal: 185, protein: 4,  carbs: 4,  fat: 18, fiber: 2,   sugar: 1   },
  { name: 'Cashews',                        servingSize: '1 oz (28g)',    cal: 157, protein: 5,  carbs: 9,  fat: 12, fiber: 1,   sugar: 2   },
  { name: 'Mixed Nuts',                     servingSize: '1 oz (28g)',    cal: 173, protein: 5,  carbs: 8,  fat: 15, fiber: 2,   sugar: 1   },

  // ── Breakfast Foods ───────────────────────────────────────────────────────
  { name: 'Pancakes (plain, 3 small)',      servingSize: '3 cakes (90g)', cal: 219, protein: 6,  carbs: 39, fat: 5,  fiber: 1,   sugar: 7   },
  { name: 'Waffle (plain)',                 servingSize: '1 waffle (75g)',cal: 218, protein: 6,  carbs: 25, fat: 11, fiber: 1,   sugar: 5   },
  { name: 'Granola (plain)',                servingSize: '1/4 cup (30g)', cal: 149, protein: 3,  carbs: 21, fat: 6,  fiber: 2,   sugar: 7   },
  { name: 'Cereal (corn flakes)',           servingSize: '1 cup (30g)',   cal: 101, protein: 2,  carbs: 24, fat: 0,  fiber: 1,   sugar: 2   },

  // ── Snacks & Bars ─────────────────────────────────────────────────────────
  { name: 'RX Bar (chocolate sea salt)',    servingSize: '1 bar (52g)',   cal: 210, protein: 12, carbs: 24, fat: 9,  fiber: 5,   sugar: 13  },
  { name: 'Kind Bar (dark choc nuts)',      servingSize: '1 bar (40g)',   cal: 200, protein: 6,  carbs: 17, fat: 15, fiber: 3,   sugar: 5   },
  { name: 'Cheese Stick (mozzarella)',      servingSize: '1 stick (28g)', cal: 80,  protein: 7,  carbs: 0,  fat: 5,  fiber: 0,   sugar: 0   },
  { name: 'Rice Cake with Peanut Butter',  servingSize: '1 cake + 1 tbsp',cal: 132, protein: 4, carbs: 16, fat: 8,  fiber: 1,   sugar: 2   },
  { name: 'Apple with Almond Butter',      servingSize: '1 apple + 1 tbsp',cal: 193, protein: 3, carbs: 28, fat: 9, fiber: 6,   sugar: 20  },
  { name: 'Dark Chocolate (70%+)',          servingSize: '1 oz (28g)',    cal: 170, protein: 2,  carbs: 13, fat: 12, fiber: 3,   sugar: 7   },
  { name: 'Hummus',                         servingSize: '2 tbsp (30g)',  cal: 50,  protein: 2,  carbs: 5,  fat: 3,  fiber: 2,   sugar: 0   },
  { name: 'Pretzels',                       servingSize: '1 oz (28g)',    cal: 108, protein: 3,  carbs: 23, fat: 1,  fiber: 1,   sugar: 1   },
  { name: 'Popcorn (air-popped)',           servingSize: '3 cups (24g)',  cal: 93,  protein: 3,  carbs: 19, fat: 1,  fiber: 4,   sugar: 0   },

  // ── Sauces & Condiments ───────────────────────────────────────────────────
  { name: 'Ranch Dressing',                 servingSize: '2 tbsp (30g)',  cal: 130, protein: 0,  carbs: 2,  fat: 13, fiber: 0,   sugar: 1   },
  { name: 'Caesar Dressing',               servingSize: '2 tbsp (30g)',  cal: 163, protein: 1,  carbs: 1,  fat: 17, fiber: 0,   sugar: 1   },
  { name: 'Salsa',                          servingSize: '2 tbsp (32g)',  cal: 9,   protein: 0,  carbs: 2,  fat: 0,  fiber: 0,   sugar: 1   },
  { name: 'Sriracha Hot Sauce',             servingSize: '1 tsp (6g)',    cal: 5,   protein: 0,  carbs: 1,  fat: 0,  fiber: 0,   sugar: 1   },
  { name: 'Soy Sauce',                      servingSize: '1 tbsp (18g)',  cal: 10,  protein: 2,  carbs: 1,  fat: 0,  fiber: 0,   sugar: 0   },
  { name: 'Ketchup',                        servingSize: '1 tbsp (17g)',  cal: 20,  protein: 0,  carbs: 5,  fat: 0,  fiber: 0,   sugar: 4   },

  // ── Drinks ────────────────────────────────────────────────────────────────
  { name: 'Coffee (black)',                 servingSize: '8 oz (240ml)',  cal: 2,   protein: 0,  carbs: 0,  fat: 0,  fiber: 0,   sugar: 0   },
  { name: 'Latte (whole milk)',             servingSize: '12 oz',         cal: 206, protein: 11, carbs: 16, fat: 11, fiber: 0,   sugar: 15  },
  { name: 'Latte (oat milk)',               servingSize: '12 oz',         cal: 180, protein: 7,  carbs: 24, fat: 5,  fiber: 1,   sugar: 18  },
  { name: 'Orange Juice',                   servingSize: '8 oz (240ml)',  cal: 112, protein: 2,  carbs: 26, fat: 0,  fiber: 0,   sugar: 21  },
  { name: 'Protein Shake (mixed, 8oz)',     servingSize: '8 oz (240ml)',  cal: 150, protein: 25, carbs: 8,  fat: 2,  fiber: 1,   sugar: 4   },

  // ── Fast Food / Restaurant ─────────────────────────────────────────────────
  { name: 'Chipotle Chicken Bowl (est.)',   servingSize: '1 bowl',        cal: 640, protein: 48, carbs: 62, fat: 20, fiber: 14,  sugar: 5   },
  { name: 'Chipotle Burrito (est.)',        servingSize: '1 burrito',     cal: 950, protein: 45, carbs: 93, fat: 40, fiber: 15,  sugar: 6   },
  { name: "McDonald's Big Mac",            servingSize: '1 sandwich',    cal: 563, protein: 26, carbs: 45, fat: 33, fiber: 3,   sugar: 9   },
  { name: "McDonald's Quarter Pounder",    servingSize: '1 sandwich',    cal: 510, protein: 30, carbs: 43, fat: 26, fiber: 2,   sugar: 10  },
  { name: "McDonald's Fries (medium)",     servingSize: 'medium (117g)', cal: 320, protein: 4,  carbs: 44, fat: 15, fiber: 4,   sugar: 0   },
  { name: "Chick-fil-A Grilled Chicken",  servingSize: '1 sandwich',    cal: 380, protein: 40, carbs: 38, fat: 7,  fiber: 2,   sugar: 8   },
  { name: 'Pizza (cheese, 1 slice)',        servingSize: '1 slice (107g)',cal: 272, protein: 12, carbs: 34, fat: 10, fiber: 2,   sugar: 4   },
  { name: 'Subway 6" Turkey Sub',          servingSize: '1 sub (228g)',  cal: 280, protein: 18, carbs: 46, fat: 4,  fiber: 4,   sugar: 7   },
  { name: 'Sushi Roll (California, 8pc)', servingSize: '1 roll (8 pcs)',cal: 304, protein: 9,  carbs: 42, fat: 7,  fiber: 2,   sugar: 4   },
  { name: 'Starbucks Frappuccino (grande)',servingSize: '16 oz',         cal: 410, protein: 5,  carbs: 65, fat: 16, fiber: 0,   sugar: 60  },
]

// Fuzzy-search the food DB — instant, no API needed
export function searchFoodDB(query) {
  const terms = query.toLowerCase().trim().split(/\s+/).filter(t => t.length > 1)
  if (!terms.length) return []
  return FOOD_DB
    .map(food => {
      const name = food.name.toLowerCase()
      let score = 0
      for (const t of terms) {
        if (name.includes(t)) score += (name.startsWith(t) ? 3 : 2)
        else if (name.split(/[\s(,/]+/).some(w => w.startsWith(t))) score += 1
      }
      return { ...food, score }
    })
    .filter(f => f.score > 0)
    .sort((a, b) => b.score !== a.score ? b.score - a.score : a.name.localeCompare(b.name))
    .slice(0, 8)
    .map(({ score, ...food }) => food)
}

export const TIPS = [
  { icon: '💧', title: 'Hydrate Aggressively',   body: 'Drink 80–100 oz of water daily. Staying hydrated helps shed postpartum water retention. Add electrolytes when sweating heavily.' },
  { icon: '😴', title: 'Prioritize Sleep',        body: 'Even 6–7 total hours (split if needed) dramatically affects cortisol and fat loss. High cortisol = stubborn belly fat. Sleep when baby sleeps.' },
  { icon: '📈', title: 'Progressive Overload',    body: 'Add 2.5–5 lbs to main lifts every 1–2 weeks. This is how your glutes grow. Beat your weights from last week — every single time.' },
  { icon: '🍽️', title: 'Meal Prep Sundays',       body: 'Grill 2 lbs chicken, roast sweet potatoes & broccoli, hard-boil 8 eggs. Sets you up for the whole week in under an hour.' },
  { icon: '🏋️', title: 'Mind-Muscle Connection',  body: 'Squeeze your glute with your hand before EVERY exercise to "wake it up." Think about the muscle, not just completing the rep.' },
  { icon: '📏', title: 'Measure More Than Weight', body: 'Take hip, waist, and thigh measurements weekly. The scale can stay flat while you lose inches. Photos every week in the same outfit.' },
  { icon: '🌸', title: 'Postpartum Core Care',    body: 'Check for diastasis recti before any crunches. If you see "coning" at your belly during exercise, stop and regress to safer movements.' },
  { icon: '🎯', title: 'Trust the Process',       body: 'Your body grew and birthed a human. Fat loss of 1–2 lbs/week is healthy. Some weeks = 0 on the scale — that\'s normal. Keep going!' },
]
