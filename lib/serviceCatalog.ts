export type ServiceCatalogItem = {
  name: string;
  slug: string;
  subcategories: string[];
};

export const serviceCatalog: ServiceCatalogItem[] = [
  {
    name: "Home Care",
    slug: "home-care",
    subcategories: [
      "Handyman",
      "General Cleaning",
      "Painter",
      "Pest Control",
      "Electrical",
      "Plumbing",
      "HVAC Services",
      "Junk Removal",
      "Roofing Services",
      "Drywall Repair & Installation",
      "Fencing",
      "Deck Building & Repair",
      "Glass & Shower Doors",
      "Gutter Installation & Cleaning",
      "Garage Door Repair & Installation",
      "Tile Installation",
    ],
  },
  {
    name: "Car Care",
    slug: "car-care",
    subcategories: [
      "Mobile Car Servicing",
      "Diagnostic Check",
      "Car Washing & Detailing",
      "Tire Replacement",
      "Puncture Repair",
      "Alloy Wheel Repair",
    ],
  },
  {
    name: "Pet Care",
    slug: "pet-care",
    subcategories: [
      "In-home Pet Sitting",
      "Pet Walking",
      "Grooming",
      "Washing & Cleaning",
      "Nail Trimming",
      "Ear Cleaning",
      "Pet Training",
    ],
  },
  {
    name: "Garden Care",
    slug: "garden-care",
    subcategories: [
      "Lawn Mowing & Edging",
      "Weeding",
      "Pruning & Trimming",
      "Leaf Blowing & Cleanup",
      "Mulching",
      "Garden Design & Landscaping",
      "Seasonal Planting",
      "Turf Laying / Seeding",
      "Raised Bed Installation",
      "Tree Trimming & Shaping",
      "Tree Removal",
      "Stump Grinding",
      "Storm Damage Cleanup",
      "Sprinkler Installation & Repair",
      "Drip Irrigation Setup",
      "Drainage Solutions",
      "Soil Fertilizing",
      "Aeration & Scarification",
      "Weed & Pest Control",
      "Composting Services",
      "Patio & Pathway Installation",
      "Retaining Walls",
      "Outdoor Lighting Installation",
      "Organic Gardening",
      "Water Feature Installation",
      "Greenhouse Setup",
      "Winter Prep & Snow Removal",
    ],
  },
  {
    name: "Moving",
    slug: "moving",
    subcategories: [
      "Local Moves",
      "Long-distance Moves",
      "Loading & Unloading",
      "Furniture Rearranging",
      "Piano & Heavy Item Moving",
      "Full Packing Service",
      "Partial Packing",
      "Unpacking & Setup",
      "Office & Commercial Moves",
      "Apartment Moves",
      "Senior Moving",
      "Art & Fine Item Transport",
    ],
  },
  {
    name: "Roadside & Emergency",
    slug: "roadside-emergency",
    subcategories: [
      "Emergency Towing",
      "Battery Jump-start",
      "Flat Tire Change",
      "Fuel Delivery",
      "Lockout Service",
      "Flatbed Towing",
      "Wheel-lift Towing",
      "Hook & Chain Towing",
      "Dolly Towing",
      "Motorcycle Towing",
      "Heavy-duty Truck & RV Towing",
      "Bus & Commercial Vehicle Towing",
      "Off-road Recovery",
      "Winching & Vehicle Extraction",
      "Mud / Ditch / Rollover Recovery",
      "Water / Flood Recovery",
      "Boat & Trailer Towing",
    ],
  },
];

export function getServiceFilterOptions() {
  return {
    categories: serviceCatalog.map((service) => service.name),
    subcategoriesByCategory: Object.fromEntries(
      serviceCatalog.map((service) => [
        service.name,
        [...service.subcategories].sort((first, second) =>
          first.localeCompare(second),
        ),
      ]),
    ) as Record<string, string[]>,
  };
}
