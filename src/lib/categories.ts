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

/** Best-effort guess so typing "uber to airport" preselects the taxi icon. */
export function guessCategory(description: string): string {
  const text = description.toLowerCase();
  const rules: [RegExp, string][] = [
    [/\b(uber|ola|lyft|cab|taxi|auto)\b/, "taxi"],
    [/\b(flight|airfare|airlines?|indigo|vistara)\b/, "flight"],
    [/\b(train|rail|irctc)\b/, "train"],
    [/\b(bus|volvo)\b/, "bus"],
    [/\b(hotel|airbnb|hostel|stay|resort)\b/, "hotel"],
    [/\b(grocer|supermarket|bigbasket|blinkit|zepto|dmart)\b/, "groceries"],
    [/\b(dinner|lunch|breakfast|restaurant|cafe|coffee|swiggy|zomato|pizza|food)\b/, "dining"],
    [/\b(beer|wine|bar|pub|liquor|drinks)\b/, "liquor"],
    [/\b(rent)\b/, "rent"],
    [/\b(electric|power bill)\b/, "electricity"],
    [/\b(water)\b/, "water"],
    [/\b(wifi|internet|broadband|jio|airtel fiber)\b/, "internet"],
    [/\b(petrol|diesel|fuel|gasoline)\b/, "fuel"],
    [/\b(parking)\b/, "parking"],
    [/\b(movie|cinema|netflix|pvr|inox)\b/, "movies"],
    [/\b(medicine|pharmacy|doctor|hospital|medical)\b/, "medical"],
    [/\b(gift|birthday)\b/, "gifts"],
    [/\b(subscription|spotify|prime|membership)\b/, "subscriptions"],
    [/\b(phone|mobile recharge|recharge)\b/, "phone"],
  ];
  for (const [pattern, id] of rules) {
    if (pattern.test(text)) return id;
  }
  return "general";
}
