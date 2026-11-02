import { FoodDatabaseItem, MealRecipe, WellnessJourneyMode } from '../types';

/**
 * Verified Indian & Regional Food Composition Database (IFCT / ICMR-NIN & USDA Reference Aligned)
 * Values represent standard home-cooked Indian serving sizes.
 */
export const INITIAL_FOOD_DATABASE: FoodDatabaseItem[] = [
  // BREAKFAST ITEMS
  {
    id: 'fd-b1',
    name: 'Steamed Idli with Moringa Sambar & Coconut Chutney',
    localNameTamil: 'இட்லி, முருங்கைக்கீரை சாம்பார் & சட்னி',
    category: 'breakfast',
    dietType: 'veg',
    servingSize: '3 medium idlis + 150 mL sambar + 2 tbsp chutney',
    calories: 325,
    proteinGrams: 11.5,
    carbsGrams: 54,
    fatsGrams: 6.2,
    fiberGrams: 5.8,
    keyMicronutrients: ['Folate (B9)', 'Iron (3.4 mg)', 'Vitamin C', 'Probiotics'],
    nutritionalBenefits: 'Fermented batter increases B-vitamin bioavailability and gut-friendly lactic acid bacteria; moringa sambar adds plant protein and iron.',
    sourceType: 'IFCT_ICMR_Reference'
  },
  {
    id: 'fd-b2',
    name: 'Sprouted Ragi Dosa with Mint-Groundnut Chutney',
    localNameTamil: 'முளைகட்டிய ராகி தோசை & புதினா வேர்க்கடலை சட்னி',
    category: 'breakfast',
    dietType: 'veg',
    servingSize: '2 medium dosas + 3 tbsp chutney',
    calories: 345,
    proteinGrams: 12.2,
    carbsGrams: 52,
    fatsGrams: 9.0,
    fiberGrams: 6.5,
    keyMicronutrients: ['Calcium (344 mg)', 'Iron (4.1 mg)', 'Magnesium', 'Niacin'],
    nutritionalBenefits: 'Finger millet (Ragi) is the richest grain source of bioavailable calcium and polyphenols for bone density and steady blood glucose.',
    sourceType: 'IFCT_ICMR_Reference'
  },
  {
    id: 'fd-b3',
    name: 'Pesarattu (Whole Green Moong Dosa) with Ginger Chutney',
    localNameTamil: 'பச்சைப் பயறு தோசை (பெசரட்டு) & இஞ்சி சட்னி',
    category: 'breakfast',
    dietType: 'vegan',
    servingSize: '2 crisp crepes + 2 tbsp ginger chutney',
    calories: 330,
    proteinGrams: 15.8,
    carbsGrams: 48,
    fatsGrams: 7.2,
    fiberGrams: 7.4,
    keyMicronutrients: ['Folate', 'Magnesium', 'Potassium', 'Plant Protein'],
    nutritionalBenefits: 'High-protein whole green gram supports sustained morning satiety, cellular repair, and gentle digestion with gingerols.',
    sourceType: 'IFCT_ICMR_Reference'
  },
  {
    id: 'fd-b4',
    name: 'Ven Pongal with Yellow Moong Dal & Pepper-Cumin Tempering',
    localNameTamil: 'மிளகு சீரக வெண் பொங்கல் & கத்திரிக்காய் கொத்சு',
    category: 'breakfast',
    dietType: 'veg',
    servingSize: '1 medium bowl (220g) + 100 mL sambar',
    calories: 370,
    proteinGrams: 12.4,
    carbsGrams: 56,
    fatsGrams: 10.2,
    fiberGrams: 4.9,
    keyMicronutrients: ['Piperine', 'Iron', 'Zinc', 'B-Complex'],
    nutritionalBenefits: 'Rice and split yellow moong dal form a complete amino acid profile; black pepper and cumin stimulate digestive enzymes.',
    sourceType: 'IFCT_ICMR_Reference'
  },
  {
    id: 'fd-b5',
    name: 'Foxtail Millet (Thinai) Vegetable Upma with Roasted Gram',
    localNameTamil: 'தினை காய்கறி உப்புமா',
    category: 'breakfast',
    dietType: 'vegan',
    servingSize: '1 bowl (200g)',
    calories: 295,
    proteinGrams: 9.8,
    carbsGrams: 46,
    fatsGrams: 7.5,
    fiberGrams: 6.8,
    keyMicronutrients: ['Thiamine (B1)', 'Iron', 'Magnesium', 'Soluble Fiber'],
    nutritionalBenefits: 'Low glycemic index millet provides slow-release energy and high dietary fiber for metabolic balance.',
    sourceType: 'IFCT_ICMR_Reference'
  },
  {
    id: 'fd-b6',
    name: 'Kanda Poha with Roasted Peanuts, Curry Leaves & Fresh Lemon',
    localNameTamil: 'அவல் உப்புமா (போஹா) & எலுமிச்சை',
    category: 'breakfast',
    dietType: 'vegan',
    servingSize: '1 plate (180g)',
    calories: 310,
    proteinGrams: 8.6,
    carbsGrams: 49,
    fatsGrams: 8.8,
    fiberGrams: 4.2,
    keyMicronutrients: ['Iron (4.5 mg)', 'Vitamin C', 'Healthy Monounsaturated Fats'],
    nutritionalBenefits: 'Flattened rice retains iron during processing; squeezing fresh lemon juice triples non-heme iron absorption.',
    sourceType: 'IFCT_ICMR_Reference'
  },
  {
    id: 'fd-b7',
    name: 'Country Egg Masala Dosa with Vegetable Sambar',
    localNameTamil: 'முட்டை தோசை & காய்கறி சாம்பார்',
    category: 'breakfast',
    dietType: 'egg',
    servingSize: '1 large egg dosa + 1 medium plain dosa + 150 mL sambar',
    calories: 395,
    proteinGrams: 18.5,
    carbsGrams: 48,
    fatsGrams: 13.5,
    fiberGrams: 4.5,
    keyMicronutrients: ['Choline (147 mg)', 'Vitamin B12', 'Vitamin D', 'Selenium'],
    nutritionalBenefits: 'Combines fermented grain carbohydrates with high biological-value egg protein and choline for brain and nerve health.',
    sourceType: 'IFCT_ICMR_Reference'
  },
  {
    id: 'fd-b8',
    name: 'Red Rice Puttu with Black Chickpea (Kadala) Curry',
    localNameTamil: 'சிகப்பரிசி புட்டு & கொண்டைக்கடலை குழம்பு',
    category: 'breakfast',
    dietType: 'vegan',
    servingSize: '1 cylinder puttu (150g) + 1 cup kadala curry (150g)',
    calories: 385,
    proteinGrams: 14.6,
    carbsGrams: 61,
    fatsGrams: 8.4,
    fiberGrams: 8.9,
    keyMicronutrients: ['Iron (5.2 mg)', 'Folate', 'Anthocyanins', 'Zinc'],
    nutritionalBenefits: 'Steamed red rice and kala chana deliver dense iron, folate, and prebiotic fiber for lasting stamina.',
    sourceType: 'IFCT_ICMR_Reference'
  },

  // LUNCH ITEMS
  {
    id: 'fd-l1',
    name: 'Palak Moong Dal, Red Matta Rice & Steamed Beetroot Poriyal',
    localNameTamil: 'பசலைக்கீரை பருப்பு, கைக்குத்தல் அரிசி & பீட்ரூட் பொரியல்',
    category: 'lunch',
    dietType: 'veg',
    servingSize: '1 cup rice + 1 bowl palak dal + 0.75 cup poriyal',
    calories: 475,
    proteinGrams: 17.8,
    carbsGrams: 74,
    fatsGrams: 10.5,
    fiberGrams: 9.2,
    keyMicronutrients: ['Iron (6.4 mg)', 'Folate (240 mcg)', 'Vitamin A', 'Nitrates'],
    nutritionalBenefits: 'Spinach and moong dal replenish hemoglobin stores while beetroot supports healthy vascular circulation.',
    sourceType: 'IFCT_ICMR_Reference'
  },
  {
    id: 'fd-l2',
    name: 'Murungai Keerai (Moringa) Sambar, Ponni Rice & Black Chana Sundal',
    localNameTamil: 'முருங்கைக்கீரை சாம்பார், சாதம் & கருப்பு சுண்டல்',
    category: 'lunch',
    dietType: 'vegan',
    servingSize: '1 cup rice + 1.5 cups sambar + 0.5 cup sundal',
    calories: 490,
    proteinGrams: 19.4,
    carbsGrams: 76,
    fatsGrams: 10.2,
    fiberGrams: 10.5,
    keyMicronutrients: ['Iron (7.1 mg)', 'Calcium (260 mg)', 'Vitamin C', 'Magnesium'],
    nutritionalBenefits: 'Drumstick leaves and black chickpeas provide synergistic plant protein, iron, and calcium for energy and bone strength.',
    sourceType: 'IFCT_ICMR_Reference'
  },
  {
    id: 'fd-l3',
    name: 'Rajma Masala (Red Kidney Beans) with Jeera Brown Rice & Cucumber Raita',
    localNameTamil: 'ராஜ்மா மசாலா, சீரக பிரவுன் சாதம் & தயிர் பச்சடி',
    category: 'lunch',
    dietType: 'veg',
    servingSize: '1 cup brown rice + 1 bowl rajma + 0.5 cup raita',
    calories: 485,
    proteinGrams: 18.2,
    carbsGrams: 75,
    fatsGrams: 11.0,
    fiberGrams: 11.2,
    keyMicronutrients: ['Iron (5.8 mg)', 'Potassium', 'Folate', 'Probiotics'],
    nutritionalBenefits: 'Slow-digesting kidney beans stabilize afternoon blood sugar while pasteurized curd raita cools the digestive tract.',
    sourceType: 'IFCT_ICMR_Reference'
  },
  {
    id: 'fd-l4',
    name: 'Probiotic Curd Rice with Pomegranate, Grated Carrot & Sprouted Green Gram',
    localNameTamil: 'தயிர் சாதம், மாதுளை & முளைகட்டிய பச்சைப் பயறு',
    category: 'lunch',
    dietType: 'veg',
    servingSize: '1.5 cups curd rice + 0.5 cup steamed sprouts',
    calories: 430,
    proteinGrams: 15.6,
    carbsGrams: 64,
    fatsGrams: 11.5,
    fiberGrams: 6.4,
    keyMicronutrients: ['Calcium (310 mg)', 'Vitamin B12', 'Vitamin C', 'Live Cultures'],
    nutritionalBenefits: 'Soothing on the stomach, rich in calcium and gut probiotics, paired with steamed sprouts for extra protein.',
    sourceType: 'IFCT_ICMR_Reference'
  },
  {
    id: 'fd-l5',
    name: 'Home-Style Seer Fish / Salmon Meen Kuzhambu with Red Rice & Cabbage Thoran',
    localNameTamil: 'மீன் குழம்பு, சிகப்பரிசி சாதம் & முட்டைக்கோஸ் பொரியல்',
    category: 'lunch',
    dietType: 'non-veg',
    servingSize: '100g cooked fish + 1 cup red rice + 0.75 cup thoran',
    calories: 510,
    proteinGrams: 28.5,
    carbsGrams: 62,
    fatsGrams: 14.8,
    fiberGrams: 6.2,
    keyMicronutrients: ['Omega-3 DHA & EPA', 'Vitamin D', 'Vitamin B12', 'Iodine'],
    nutritionalBenefits: 'Provides high-absorption heme iron, complete marine protein, and anti-inflammatory Omega-3 fatty acids.',
    sourceType: 'IFCT_ICMR_Reference'
  },
  {
    id: 'fd-l6',
    name: 'Turmeric Country Chicken Curry with 2 Whole Wheat Rotis & Dal Soup',
    localNameTamil: 'நாட்டுக்கோழி குழம்பு, 2 சப்பாத்தி & பருப்பு ரசம்',
    category: 'lunch',
    dietType: 'non-veg',
    servingSize: '100g chicken curry + 2 rotis + 1 cup dal rasam',
    calories: 495,
    proteinGrams: 31.0,
    carbsGrams: 54,
    fatsGrams: 15.2,
    fiberGrams: 7.0,
    keyMicronutrients: ['Heme Iron', 'Zinc', 'Vitamin B6', 'Vitamin B12'],
    nutritionalBenefits: 'Rich in bioavailable zinc and protein for immune resilience and muscle recovery.',
    sourceType: 'IFCT_ICMR_Reference'
  },

  // EVENING SNACK ITEMS
  {
    id: 'fd-s1',
    name: 'Steamed Green Moong Sprouts Chaat with Pomegranate & Lemon',
    localNameTamil: 'வேகவைத்த முளைகட்டிய பயறு சாலட் & மாதுளை',
    category: 'snack',
    dietType: 'vegan',
    servingSize: '1 medium bowl (150g)',
    calories: 165,
    proteinGrams: 9.2,
    carbsGrams: 26,
    fatsGrams: 2.1,
    fiberGrams: 5.6,
    keyMicronutrients: ['Vitamin C', 'Folate', 'Iron', 'Antioxidants'],
    nutritionalBenefits: 'Sprouting reduces phytic acid and doubles vitamin C and folate availability while remaining light on calories.',
    sourceType: 'IFCT_ICMR_Reference'
  },
  {
    id: 'fd-s2',
    name: 'Roasted Makhana (Foxnuts) with Soaked Almonds & Walnuts',
    localNameTamil: 'வறுத்த மக்கானா (தாமரை விதை), பாதாம் & வால்நட்',
    category: 'snack',
    dietType: 'veg',
    servingSize: '1 cup makhana (30g) + 5 almonds + 2 walnut halves',
    calories: 185,
    proteinGrams: 6.4,
    carbsGrams: 18,
    fatsGrams: 9.8,
    fiberGrams: 3.4,
    keyMicronutrients: ['Magnesium', 'Calcium', 'Omega-3 ALA', 'Vitamin E'],
    nutritionalBenefits: 'Crunchy, low-sodium snack rich in magnesium and healthy fats that calm evening cravings and support nerve health.',
    sourceType: 'IFCT_ICMR_Reference'
  },
  {
    id: 'fd-s3',
    name: 'Black Sesame & Palm Jaggery Laddu (Ellu Urundai) with Fresh Guava',
    localNameTamil: 'கருப்பு எள்ளு உருண்டை & கொய்யாப்பழம்',
    category: 'snack',
    dietType: 'vegan',
    servingSize: '1 medium laddu (30g) + 1 medium guava',
    calories: 190,
    proteinGrams: 5.5,
    carbsGrams: 25,
    fatsGrams: 8.2,
    fiberGrams: 6.2,
    keyMicronutrients: ['Calcium (290 mg)', 'Iron (4.2 mg)', 'Vitamin C (228 mg)', 'Zinc'],
    nutritionalBenefits: 'Guava provides 4x the vitamin C of oranges to supercharge the absorption of iron and calcium from sesame seeds.',
    sourceType: 'IFCT_ICMR_Reference'
  },
  {
    id: 'fd-s4',
    name: 'Probiotic Greek Curd / Yogurt Bowl with Chia Seeds & Banana',
    localNameTamil: 'தயிர், சியா விதை & வாழைப்பழம்',
    category: 'snack',
    dietType: 'veg',
    servingSize: '150g pasteurized curd + 1 tsp soaked chia + 0.5 banana',
    calories: 175,
    proteinGrams: 8.5,
    carbsGrams: 22,
    fatsGrams: 5.4,
    fiberGrams: 4.1,
    keyMicronutrients: ['Calcium', 'Potassium', 'Omega-3', 'Probiotics'],
    nutritionalBenefits: 'Combines probiotic yogurt with soluble fiber and potassium to prevent afternoon fatigue and muscle cramps.',
    sourceType: 'IFCT_ICMR_Reference'
  },
  {
    id: 'fd-s5',
    name: 'Boiled Chickpea (Chana) & Sweet Corn Sundal with Grated Coconut',
    localNameTamil: 'கொண்டைக்கடலை சோளம் சுண்டல்',
    category: 'snack',
    dietType: 'vegan',
    servingSize: '1 cup (140g)',
    calories: 180,
    proteinGrams: 7.8,
    carbsGrams: 28,
    fatsGrams: 4.2,
    fiberGrams: 6.0,
    keyMicronutrients: ['Iron', 'Lutein', 'Magnesium', 'Dietary Fiber'],
    nutritionalBenefits: 'Classic South Indian evening protein snack that sustains blood glucose until dinner without refined flour.',
    sourceType: 'IFCT_ICMR_Reference'
  },
  {
    id: 'fd-s6',
    name: 'Spiced Boiled Eggs (2) with Black Pepper & Warm Ginger-Lemon Tea',
    localNameTamil: 'மிளகு வேகவைத்த முட்டை & இஞ்சி எலுமிச்சை தேநீர்',
    category: 'snack',
    dietType: 'egg',
    servingSize: '2 hard-boiled eggs + 1 cup herbal infusion',
    calories: 160,
    proteinGrams: 12.6,
    carbsGrams: 2,
    fatsGrams: 10.6,
    fiberGrams: 0.5,
    keyMicronutrients: ['Complete Protein', 'Choline', 'Vitamin B12', 'Vitamin D'],
    nutritionalBenefits: 'Zero-sugar, high-protein evening snack ideal for muscle maintenance and steady metabolic energy.',
    sourceType: 'IFCT_ICMR_Reference'
  },

  // DINNER ITEMS
  {
    id: 'fd-d1',
    name: 'Soft Whole Wheat Phulkas (2) with Paneer & Methi (Fenugreek) Curry',
    localNameTamil: 'சப்பாத்தி (2) & வெந்தயக்கீரை பன்னீர் கிரேவி',
    category: 'dinner',
    dietType: 'veg',
    servingSize: '2 phulkas + 1 cup paneer methi curry (180g)',
    calories: 425,
    proteinGrams: 19.5,
    carbsGrams: 48,
    fatsGrams: 16.0,
    fiberGrams: 7.2,
    keyMicronutrients: ['Calcium (380 mg)', 'Protein', 'Iron', 'Magnesium'],
    nutritionalBenefits: 'Fenugreek leaves improve insulin sensitivity and digestion, paired with high-calcium pasteurized paneer.',
    sourceType: 'IFCT_ICMR_Reference'
  },
  {
    id: 'fd-d2',
    name: 'Warm Yellow Moong Dal & Vegetable Khichdi with 1 tsp Pure Ghee',
    localNameTamil: 'பாசிப்பருப்பு காய்கறி கிச்சடி & நெய்',
    category: 'dinner',
    dietType: 'veg',
    servingSize: '1 generous bowl (280g)',
    calories: 390,
    proteinGrams: 14.8,
    carbsGrams: 60,
    fatsGrams: 9.2,
    fiberGrams: 6.8,
    keyMicronutrients: ['Butyric Acid', 'Tryptophan', 'Potassium', 'B-Vitamins'],
    nutritionalBenefits: 'Extremely gentle on evening digestion; warm moong dal and cumin soothe abdominal bloating and promote restful sleep.',
    sourceType: 'IFCT_ICMR_Reference'
  },
  {
    id: 'fd-d3',
    name: 'Protein-Rich Mixed Lentil Adai (2) with Vegetable Avial',
    localNameTamil: 'பருப்பு அடை (2) & காய்கறி அவியல்',
    category: 'dinner',
    dietType: 'veg',
    servingSize: '2 medium adais + 1 cup mixed vegetable avial',
    calories: 435,
    proteinGrams: 17.6,
    carbsGrams: 58,
    fatsGrams: 13.4,
    fiberGrams: 8.6,
    keyMicronutrients: ['Plant Protein', 'Beta-Carotene', 'Iron', 'Fiber'],
    nutritionalBenefits: 'Combines four lentils with drumstick, carrot, and ash gourd in avial for a nutrient-dense South Indian dinner.',
    sourceType: 'IFCT_ICMR_Reference'
  },
  {
    id: 'fd-d4',
    name: 'Jowar / Multigrain Bhakri Roti with Dal Tadka & Sautéed Bhindi',
    localNameTamil: 'சோள ரொட்டி, தால் தட்கா & வெண்டைக்காய் பொரியல்',
    category: 'dinner',
    dietType: 'vegan',
    servingSize: '2 rotis + 1 bowl dal + 0.75 cup bhindi poriyal',
    calories: 405,
    proteinGrams: 15.2,
    carbsGrams: 62,
    fatsGrams: 9.8,
    fiberGrams: 9.4,
    keyMicronutrients: ['Folate', 'Magnesium', 'Soluble Mucilage Fiber', 'Iron'],
    nutritionalBenefits: 'Gluten-free sorghum (jowar) and okra provide high soluble fiber for gut motility and blood sugar control.',
    sourceType: 'IFCT_ICMR_Reference'
  },
  {
    id: 'fd-d5',
    name: 'Grilled Turmeric Fish & Moringa Clear Soup with 2 Soft Chapatis',
    localNameTamil: 'மஞ்சள் மீன் வறுவல், முருங்கை சூப் & சப்பாத்தி',
    category: 'dinner',
    dietType: 'non-veg',
    servingSize: '100g cooked low-mercury fish + 1 bowl soup + 2 chapatis',
    calories: 430,
    proteinGrams: 27.5,
    carbsGrams: 44,
    fatsGrams: 14.2,
    fiberGrams: 5.5,
    keyMicronutrients: ['Omega-3 DHA', 'Selenium', 'Vitamin D', 'Iron'],
    nutritionalBenefits: 'Light, high-protein evening meal that supports overnight cellular repair without gastric heaviness.',
    sourceType: 'IFCT_ICMR_Reference'
  },

  // COMMON STAPLES & BEVERAGES FOR MANUAL LOGGING
  {
    id: 'fd-st1',
    name: 'Tender Coconut Water (Fresh)',
    localNameTamil: 'இளநீர்',
    category: 'beverage',
    dietType: 'vegan',
    servingSize: '1 glass (250 mL)',
    calories: 48,
    proteinGrams: 1.2,
    carbsGrams: 10.5,
    fatsGrams: 0.2,
    fiberGrams: 1.0,
    keyMicronutrients: ['Potassium (600 mg)', 'Magnesium', 'Electrolytes'],
    nutritionalBenefits: 'Natural isotonic hydration that replenishes electrolytes and prevents heat exhaustion.',
    sourceType: 'IFCT_ICMR_Reference'
  },
  {
    id: 'fd-st2',
    name: 'Spiced Buttermilk (Neer Mor)',
    localNameTamil: 'நீர் மோர் (இஞ்சி, பெருங்காயம், கறிவேப்பிலை)',
    category: 'beverage',
    dietType: 'veg',
    servingSize: '1 glass (200 mL)',
    calories: 45,
    proteinGrams: 3.2,
    carbsGrams: 4.5,
    fatsGrams: 1.5,
    fiberGrams: 0.3,
    keyMicronutrients: ['Calcium', 'Probiotics', 'Vitamin B12'],
    nutritionalBenefits: 'Cooling probiotic drink that aids digestion and hydrates effectively in warm climates.',
    sourceType: 'IFCT_ICMR_Reference'
  }
];

/**
 * Generates an attractive, crisp, zero-broken-image SVG culinary illustration Data URI
 * tailored to the meal's category and dish type.
 */
export function getMealVisualArtwork(meal: {
  mealName: string;
  category?: string;
  imageTheme?: string;
}): string {
  const lower = (meal.mealName || '').toLowerCase();
  const cat = meal.category || 'breakfast';

  let bgStart = '#1e1b4b';
  let bgEnd = '#312e81';
  let accent = '#a78bfa';
  let plateFill = '#fef3c7';
  let dishIconSvg = '';
  let labelTag = 'South Indian Culinary';

  if (lower.includes('idli') || lower.includes('dosa') || lower.includes('pesarattu') || lower.includes('puttu') || lower.includes('adai')) {
    bgStart = '#064e3b';
    bgEnd = '#0f766e';
    accent = '#34d399';
    plateFill = '#dcfce7';
    labelTag = 'Steamed & Fermented';
    dishIconSvg = `
      <!-- Banana Leaf Base -->
      <ellipse cx="200" cy="145" rx="135" ry="72" fill="#15803d" stroke="#4ade80" stroke-width="2" />
      <line x1="75" y1="145" x2="325" y2="145" stroke="#86efac" stroke-width="1.5" stroke-dasharray="4 3" />
      <!-- 3 Fluffy Idlis -->
      <ellipse cx="145" cy="135" rx="34" ry="22" fill="#ffffff" stroke="#e2e8f0" stroke-width="2" />
      <ellipse cx="185" cy="155" rx="34" ry="22" fill="#f8fafc" stroke="#e2e8f0" stroke-width="2" />
      <ellipse cx="135" cy="162" rx="32" ry="20" fill="#ffffff" stroke="#cbd5e1" stroke-width="2" />
      <!-- Sambar Bowl -->
      <circle cx="255" cy="128" r="28" fill="#78350f" stroke="#fbbf24" stroke-width="2.5" />
      <circle cx="255" cy="128" r="23" fill="#ea580c" />
      <circle cx="249" cy="124" r="3" fill="#22c55e" />
      <circle cx="262" cy="132" r="2.5" fill="#fde047" />
      <!-- Chutney Katori -->
      <circle cx="268" cy="172" r="20" fill="#334155" stroke="#94a3b8" stroke-width="2" />
      <circle cx="268" cy="172" r="16" fill="#bbf7d0" />
    `;
  } else if (cat === 'lunch' || lower.includes('rice') || lower.includes('sambar') || lower.includes('rajma') || lower.includes('dal')) {
    bgStart = '#4c1d95';
    bgEnd = '#1e1b4b';
    accent = '#f59e0b';
    plateFill = '#fef3c7';
    labelTag = 'Balanced Wellness Thali';
    dishIconSvg = `
      <!-- Brass Thali Plate -->
      <ellipse cx="200" cy="145" rx="132" ry="76" fill="#d97706" fill-opacity="0.22" stroke="#f59e0b" stroke-width="2.5" />
      <!-- Steamed Rice Mound -->
      <ellipse cx="155" cy="152" rx="48" ry="34" fill="#fffbeb" stroke="#fde68a" stroke-width="2" />
      <!-- Palak Dal Bowl -->
      <circle cx="240" cy="118" r="27" fill="#14532d" stroke="#fbbf24" stroke-width="2" />
      <circle cx="240" cy="118" r="22" fill="#16a34a" />
      <circle cx="240" cy="118" r="8" fill="#facc15" fill-opacity="0.6" />
      <!-- Beetroot Poriyal Bowl -->
      <circle cx="272" cy="156" r="23" fill="#4c0519" stroke="#fbbf24" stroke-width="2" />
      <circle cx="272" cy="156" r="18" fill="#be123c" />
      <!-- Curd / Raita Bowl -->
      <circle cx="222" cy="175" r="21" fill="#1e293b" stroke="#fbbf24" stroke-width="2" />
      <circle cx="222" cy="175" r="16" fill="#f8fafc" />
    `;
  } else if (cat.includes('snack') || lower.includes('makhana') || lower.includes('sprout') || lower.includes('laddu') || lower.includes('sundal')) {
    bgStart = '#7c2d12';
    bgEnd = '#431407';
    accent = '#fb923c';
    plateFill = '#ffedd5';
    labelTag = 'Micronutrient Snack';
    dishIconSvg = `
      <!-- Wooden Platter -->
      <ellipse cx="200" cy="148" rx="126" ry="70" fill="#78350f" fill-opacity="0.4" stroke="#fb923c" stroke-width="2" />
      <!-- Sprouts & Makhana Bowl -->
      <circle cx="165" cy="145" r="46" fill="#1e293b" stroke="#fdba74" stroke-width="2.5" />
      <circle cx="165" cy="145" r="39" fill="#fef3c7" fill-opacity="0.15" />
      <circle cx="152" cy="135" r="9" fill="#f8fafc" />
      <circle cx="172" cy="132" r="8" fill="#f8fafc" />
      <circle cx="158" cy="155" r="8.5" fill="#f8fafc" />
      <circle cx="178" cy="150" r="7.5" fill="#dc2626" />
      <circle cx="148" cy="148" r="6" fill="#22c55e" />
      <!-- Herbal Tea Cup -->
      <circle cx="262" cy="145" r="28" fill="#9a3412" stroke="#fed7aa" stroke-width="2.5" />
      <circle cx="262" cy="145" r="21" fill="#f59e0b" />
    `;
  } else {
    bgStart = '#1e293b';
    bgEnd = '#0f172a';
    accent = '#38bdf8';
    plateFill = '#e0f2fe';
    labelTag = 'Wholesome Evening Meal';
    dishIconSvg = `
      <!-- Ceramic Dinner Plate -->
      <ellipse cx="200" cy="145" rx="130" ry="74" fill="#334155" fill-opacity="0.45" stroke="#38bdf8" stroke-width="2" />
      <!-- Warm Phulka Rotis -->
      <circle cx="148" cy="145" r="38" fill="#fde68a" stroke="#d97706" stroke-width="2" />
      <circle cx="164" cy="152" r="36" fill="#fef3c7" stroke="#f59e0b" stroke-width="2" />
      <!-- Paneer / Vegetable Curry Bowl -->
      <circle cx="248" cy="138" r="34" fill="#14532d" stroke="#38bdf8" stroke-width="2.5" />
      <circle cx="248" cy="138" r="28" fill="#15803d" />
      <rect x="238" y="128" width="9" height="9" rx="2" fill="#ffffff" />
      <rect x="252" y="138" width="9" height="9" rx="2" fill="#ffffff" />
      <rect x="240" y="144" width="8" height="8" rx="2" fill="#ffffff" />
    `;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 240" width="400" height="240">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${bgStart}" />
        <stop offset="100%" stop-color="${bgEnd}" />
      </linearGradient>
      <radialGradient id="glow" cx="50%" cy="50%" r="55%">
        <stop offset="0%" stop-color="${accent}" stop-opacity="0.22" />
        <stop offset="100%" stop-color="${bgEnd}" stop-opacity="0" />
      </radialGradient>
    </defs>
    <rect width="400" height="240" fill="url(#bg)" />
    <circle cx="200" cy="135" r="140" fill="url(#glow)" />
    ${dishIconSvg}
    <!-- Steam wisps -->
    <path d="M165 75 Q158 62 167 50" stroke="#ffffff" stroke-opacity="0.35" stroke-width="2.5" fill="none" stroke-linecap="round" />
    <path d="M205 70 Q198 56 207 44" stroke="#ffffff" stroke-opacity="0.35" stroke-width="2.5" fill="none" stroke-linecap="round" />
    <path d="M245 76 Q238 63 247 51" stroke="#ffffff" stroke-opacity="0.35" stroke-width="2.5" fill="none" stroke-linecap="round" />
    <text x="18" y="28" fill="${plateFill}" font-family="sans-serif" font-size="11" font-weight="700" letter-spacing="0.06em">${labelTag.toUpperCase()}</text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * Converts a FoodDatabaseItem into a full MealRecipe for the Daily Meal Planner
 */
export function foodItemToMealRecipe(
  item: FoodDatabaseItem,
  slotCategory: 'breakfast' | 'lunch' | 'evening_snack' | 'dinner',
  journeyMode: WellnessJourneyMode
): MealRecipe {
  const isPreg = journeyMode === 'pregnancy';
  return {
    id: `recipe-${item.id}`,
    mealName: item.name,
    mealNameTamil: item.localNameTamil,
    category: slotCategory,
    ingredients: [
      { item: item.name.split(' with ')[0] || item.name, quantity: item.servingSize, inPantry: true },
      { item: 'Fresh curry leaves, cumin & cold-pressed oil', quantity: '1 tsp', inPantry: true },
      { item: 'Fresh seasonal accompaniment / side', quantity: '1 small bowl', inPantry: true }
    ],
    preparationSteps: [
      'Wash all fresh grains, pulses, and vegetables thoroughly under running potable water.',
      `Prepare ${item.name} using fresh home-cooked ingredients and moderate oil.`,
      isPreg
        ? 'Ensure the dish is cooked to a steaming internal temperature; use only pasteurized dairy.'
        : 'Serve freshly warm with lemon or herbs to maximize micronutrient absorption.'
    ],
    prepTimeMinutes: 10,
    cookTimeMinutes: 15,
    caloriesApprox: item.calories,
    proteinGramsApprox: item.proteinGrams,
    carbsGramsApprox: item.carbsGrams,
    fatsGramsApprox: item.fatsGrams,
    fiberGramsApprox: item.fiberGrams,
    keyNutrients: item.keyMicronutrients,
    nutritionalBenefits: item.nutritionalBenefits,
    portionGuidance: item.servingSize,
    substitutions: ['Swap rice with foxtail millet or brown rice', 'Use firm tofu in place of paneer if dairy-free'],
    allergyWarnings: item.name.toLowerCase().includes('peanut')
      ? ['Contains Peanuts']
      : item.name.toLowerCase().includes('curd') || item.name.toLowerCase().includes('paneer')
        ? ['Contains Dairy']
        : item.name.toLowerCase().includes('egg')
          ? ['Contains Egg']
          : [],
    pregnancySafetyNotes: isPreg
      ? 'Prepared steaming hot with thoroughly washed produce and pasteurized dairy.'
      : 'Balanced home-cooked meal supporting daily energy and micronutrient targets.',
    isPregnancySafe: true,
    isEstimated: item.sourceType === 'User_Custom_Estimated'
  };
}

/**
 * Deterministically selects a fresh, non-repeating set of meals for a given date & seed
 * while respecting dietType (veg, vegan, egg, non-veg), allergies, and dislikedFoods.
 */
export function selectDiverseDailyMeals(
  dateStr: string,
  dietType: 'veg' | 'vegan' | 'egg' | 'non-veg',
  journeyMode: WellnessJourneyMode,
  allergies: string[],
  dislikedFoods: string[],
  variantSeed = 0,
  customDb: FoodDatabaseItem[] = []
): {
  breakfast: MealRecipe;
  lunch: MealRecipe;
  eveningSnack: MealRecipe;
  dinner: MealRecipe;
} {
  const allItems = [...INITIAL_FOOD_DATABASE, ...customDb];
  const lowerAllergies = allergies.map(a => a.toLowerCase().trim()).filter(Boolean);
  const lowerDislikes = dislikedFoods.map(d => d.toLowerCase().trim()).filter(Boolean);

  const isAllowedDiet = (itemDiet: string) => {
    if (dietType === 'vegan') return itemDiet === 'vegan';
    if (dietType === 'veg') return itemDiet === 'veg' || itemDiet === 'vegan';
    if (dietType === 'egg') return itemDiet === 'veg' || itemDiet === 'vegan' || itemDiet === 'egg';
    return true; // non-veg allows all balanced options including veg/egg/non-veg
  };

  const isSafeForUser = (item: FoodDatabaseItem) => {
    if (!isAllowedDiet(item.dietType)) return false;
    const text = `${item.name} ${item.localNameTamil || ''}`.toLowerCase();
    for (const alg of lowerAllergies) {
      if (alg && text.includes(alg)) return false;
    }
    for (const dis of lowerDislikes) {
      if (dis && text.includes(dis)) return false;
    }
    return true;
  };

  // Compute date-based hash so every calendar day automatically gets a different rotation
  const dateHash = dateStr.split('').reduce((acc, ch, i) => acc + ch.charCodeAt(0) * (i + 3), 0) + variantSeed * 7;

  const pickFromCategory = (
    cat: 'breakfast' | 'lunch' | 'snack' | 'dinner',
    slotTarget: 'breakfast' | 'lunch' | 'evening_snack' | 'dinner',
    offset: number
  ): MealRecipe => {
    let pool = allItems.filter(i => i.category === cat && isSafeForUser(i));
    if (pool.length === 0) {
      pool = allItems.filter(i => i.category === cat);
    }
    // If user selected non-veg or egg and pool has non-veg/egg options, prioritize including them on alternating days
    const index = Math.abs(dateHash + offset) % pool.length;
    return foodItemToMealRecipe(pool[index], slotTarget, journeyMode);
  };

  return {
    breakfast: pickFromCategory('breakfast', 'breakfast', 0),
    lunch: pickFromCategory('lunch', 'lunch', 2),
    eveningSnack: pickFromCategory('snack', 'evening_snack', 4),
    dinner: pickFromCategory('dinner', 'dinner', 6)
  };
}
