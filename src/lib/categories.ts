export type Category = {
  id: string;
  label: string;
  icon: string;
  group: string;
};

export const CATEGORIES: Category[] = [
  { id: "general", label: "General", icon: "🧾", group: "Uncategorized" },
  { id: "groceries", label: "Groceries", icon: "🛒", group: "Food and drink" },
  { id: "dining", label: "Dining out", icon: "🍽️", group: "Food and drink" },
  { id: "liquor", label: "Liquor", icon: "🍻", group: "Food and drink" },
  { id: "rent", label: "Rent", icon: "🏠", group: "Home" },
  { id: "mortgage", label: "Mortgage", icon: "🏦", group: "Home" },
  { id: "electricity", label: "Electricity", icon: "💡", group: "Home" },
  { id: "water", label: "Water", icon: "🚰", group: "Home" },
  { id: "gas", label: "Gas", icon: "🔥", group: "Home" },
  { id: "internet", label: "Internet", icon: "🌐", group: "Home" },
  { id: "trash", label: "Trash", icon: "🗑️", group: "Home" },
  { id: "maintenance", label: "Maintenance", icon: "🔧", group: "Home" },
  { id: "furniture", label: "Furniture", icon: "🛋️", group: "Home" },
  { id: "household", label: "Household supplies", icon: "🧻", group: "Home" },
  { id: "flight", label: "Flight", icon: "✈️", group: "Transport" },
  { id: "train", label: "Train", icon: "🚆", group: "Transport" },
  { id: "bus", label: "Bus", icon: "🚌", group: "Transport" },
  { id: "taxi", label: "Taxi", icon: "🚕", group: "Transport" },
  { id: "fuel", label: "Fuel", icon: "⛽", group: "Transport" },
  { id: "parking", label: "Parking", icon: "🅿️", group: "Transport" },
  { id: "car", label: "Car", icon: "🚗", group: "Transport" },
  { id: "hotel", label: "Hotel", icon: "🏨", group: "Travel" },
  { id: "movies", label: "Movies", icon: "🎬", group: "Entertainment" },
  { id: "games", label: "Games", icon: "🎮", group: "Entertainment" },
  { id: "music", label: "Music", icon: "🎵", group: "Entertainment" },
  { id: "sports", label: "Sports", icon: "🏅", group: "Entertainment" },
  { id: "shopping", label: "Shopping", icon: "🛍️", group: "Life" },
  { id: "clothing", label: "Clothing", icon: "👕", group: "Life" },
  { id: "gifts", label: "Gifts", icon: "🎁", group: "Life" },
  { id: "medical", label: "Medical", icon: "💊", group: "Life" },
  { id: "insurance", label: "Insurance", icon: "🛡️", group: "Life" },
  { id: "education", label: "Education", icon: "📚", group: "Life" },
  { id: "childcare", label: "Childcare", icon: "🍼", group: "Life" },
  { id: "pets", label: "Pets", icon: "🐾", group: "Life" },
  { id: "fitness", label: "Fitness", icon: "🏋️", group: "Life" },
  { id: "personalcare", label: "Personal care", icon: "💇", group: "Life" },
  { id: "help", label: "Household help", icon: "🧹", group: "Home" },
  { id: "phone", label: "Phone", icon: "📱", group: "Utilities" },
  { id: "subscriptions", label: "Subscriptions", icon: "🔁", group: "Utilities" },
  { id: "services", label: "Services", icon: "🧰", group: "Utilities" },
  { id: "settlement", label: "Payment", icon: "💸", group: "Uncategorized" },
];

const BY_ID = new Map(CATEGORIES.map((c) => [c.id, c]));

export function category(id: string): Category {
  return BY_ID.get(id) ?? BY_ID.get("general")!;
}

export function categoryGroups(): { group: string; items: Category[] }[] {
  const groups = new Map<string, Category[]>();
  for (const c of CATEGORIES) {
    if (c.id === "settlement") continue;
    const list = groups.get(c.group) ?? [];
    list.push(c);
    groups.set(c.group, list);
  }
  return [...groups.entries()].map(([group, items]) => ({ group, items }));
}

/**
 * Keywords that point at a category, roughly ordered from most to least
 * specific. Matching is prefix-based from a word boundary, so "electric" also
 * catches "electricity" and "medicine" catches "medicines" — full-word
 * matching silently missed every plural.
 */
const KEYWORDS: Record<string, string[]> = {
  dining: [
    "restaurant", "dinner", "lunch", "breakfast", "brunch", "swiggy", "zomato",
    "eatsure", "dominos", "pizza", "burger", "biryani", "thali", "cafe", "coffee",
    "starbucks", "chai", "tea", "snack", "dessert", "icecream", "ice cream",
    "bakery", "food", "meal", "takeaway", "dine",
  ],
  groceries: [
    "grocer", "supermarket", "bigbasket", "blinkit", "zepto", "instamart",
    "dmart", "d-mart", "reliance fresh", "more supermarket", "vegetable", "veggies",
    "sabzi", "fruits", "milk", "kirana", "provision", "ration",
  ],
  liquor: ["beer", "wine", "whisky", "vodka", "rum", "liquor", "alcohol", "pub", "brewery", "bar tab", "drinks"],
  taxi: ["uber", "ola", "lyft", "rapido", "cab", "taxi", "auto rickshaw", "rickshaw", "autorickshaw"],
  flight: ["flight", "airfare", "airline", "indigo", "vistara", "spicejet", "air india", "boarding pass"],
  train: ["train", "railway", "irctc", "metro", "rail ticket"],
  bus: ["bus", "volvo", "redbus", "bmtc", "dtc", "coach ticket"],
  fuel: ["petrol", "diesel", "fuel", "gasoline", "gas station", "cng"],
  parking: ["parking", "valet", "fastag", "toll"],
  car: ["car service", "car wash", "scooter", "bike rental", "vehicle", "car rental", "rental car", "servicing"],
  hotel: ["hotel", "airbnb", "hostel", "resort", "homestay", "lodge", "stay", "villa", "guest house"],
  rent: ["rent", "landlord", "brokerage", "deposit"],
  electricity: ["electric", "power bill", "bescom", "current bill", "meter"],
  water: ["water", "water can", "borewell", "tanker"],
  gas: ["lpg", "cylinder", "gas bill", "cooking gas", "indane", "hp gas"],
  internet: ["internet", "wifi", "broadband", "fiber", "fibre", "act broadband", "hathway"],
  phone: ["recharge", "mobile bill", "postpaid", "prepaid", "jio", "airtel", "vodafone", "vi bill", "bsnl", "sim"],
  trash: ["trash", "garbage", "waste", "dustbin"],
  maintenance: ["maintenance", "repair", "plumber", "electrician", "carpenter", "society charge", "pest control"],
  help: ["maid", "house help", "househelp", "cook salary", "cleaning lady", "domestic help", "driver salary", "nanny"],
  furniture: ["furniture", "sofa", "mattress", "table", "chair", "wardrobe", "ikea"],
  household: ["detergent", "toilet paper", "tissue", "cleaning supplies", "household", "utensil", "broom", "phenyl"],
  movies: ["movie", "cinema", "pvr", "inox", "bookmyshow", "netflix", "prime video", "hotstar", "theatre", "film"],
  games: ["game", "playstation", "xbox", "steam", "gaming", "bowling", "arcade"],
  music: ["spotify", "concert", "gig", "music", "vinyl", "headphone"],
  sports: ["match ticket", "stadium", "cricket", "football", "turf", "badminton", "sports"],
  fitness: ["gym", "fitness", "yoga", "cult fit", "cultfit", "trainer", "zumba", "pilates"],
  personalcare: ["haircut", "salon", "spa", "barber", "grooming", "massage", "nykaa", "cosmetic", "skincare"],
  shopping: ["amazon", "flipkart", "myntra", "ajio", "meesho", "shopping", "mall", "order from"],
  clothing: ["clothes", "clothing", "shirt", "jeans", "dress", "shoes", "footwear", "saree", "kurta", "uniqlo", "zara"],
  gifts: ["gift", "birthday", "anniversary", "present for", "wedding gift"],
  medical: ["medicine", "medical", "pharmacy", "apollo", "doctor", "hospital", "clinic", "dentist", "lab test", "physio", "vaccine"],
  insurance: ["insurance", "premium", "policy", "lic "],
  education: ["tuition", "course", "school fee", "college fee", "books", "exam fee", "udemy", "coursera"],
  childcare: ["daycare", "creche", "diaper", "baby", "childcare", "playschool"],
  pets: ["pet", "dog food", "cat food", "vet", "grooming dog"],
  subscriptions: ["subscription", "renewal", "icloud", "google one", "chatgpt", "annual plan"],
  services: ["laundry", "dry clean", "courier", "delivery charge", "service charge", "printing"],
  settlement: [],
};

/**
 * Guess a category from what somebody typed.
 *
 * Every keyword that appears wins its category points equal to the keyword's
 * length, so a specific match ("bigbasket") beats an incidental one ("basket"
 * inside another word never matches at all, since matching starts at a word
 * boundary). The highest-scoring category wins; ties fall back to "general".
 */
export function guessCategory(description: string): string {
  const text = description.toLowerCase();
  if (text.trim() === "") return "general";

  const scores = new Map<string, number>();

  for (const [id, keywords] of Object.entries(KEYWORDS)) {
    for (const keyword of keywords) {
      // Short keywords must be whole words, or "vi" would match "video".
      const boundary = keyword.length <= 3 ? "\\b" : "";
      const pattern = new RegExp(
        `\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}${boundary}`,
      );
      if (pattern.test(text)) {
        scores.set(id, (scores.get(id) ?? 0) + keyword.length);
      }
    }
  }

  let best = "general";
  let bestScore = 0;
  for (const [id, score] of scores) {
    if (score > bestScore) {
      best = id;
      bestScore = score;
    }
  }
  return best;
}
