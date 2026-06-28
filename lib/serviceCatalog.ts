export type ServiceCatalogItem = {
  name: string;
  slug: string;
  subcategories: string[];
  groups?: Record<
    string,
    {
      label: string;
      subcategories: string[];
    }
  >;
};

export type ServiceSearchResult = {
  serviceName: string;
  serviceSlug: string;
  label: string;
  groupKey: string;
  kind: "service" | "group" | "subcategory";
};

const serviceSearchAliases: Record<string, string[]> = {
  "home-care": ["home", "house", "cleaning", "cleaner", "maintenance"],
  "car-care": ["car", "auto", "vehicle", "detailing"],
  "pet-care": ["pet", "dog", "cat", "animal"],
  "garden-care": ["garden", "yard", "lawn", "landscaping"],
  moving: ["move", "movers", "relocation", "packing"],
  "roadside-emergency": ["roadside", "towing", "tow", "emergency"],
};

export const serviceCatalog: ServiceCatalogItem[] = [
  {
    name: "Home Care",
    slug: "home-care",
    groups: {
      maintenance: {
        label: "Maintenance",
        subcategories: [
          "Handyman",
          "Painter",
          "Pest Control",
          "Electrical",
          "Plumbing",
          "HVAC Services",
          "Roofing Services",
          "Drywall Repair & Installation",
          "Fencing",
          "Deck Building & Repair",
          "Glass & Shower Doors",
          "Garage Door Repair & Installation",
          "Tile Installation",
          "Gutter Installation",
        ],
      },
      cleaning: {
        label: "Cleaning",
        subcategories: [
          "General Cleaning",
          "Pressure Washing",
          "Gutter Cleaning",
          "Junk Removal",
          "Garbage Bin Cleaning",
          "Duct and Furnace Cleaning",
          "Mold Removal",
          "Carpet Cleaning",
          "Window Cleaning",
          "Move-In / Move-Out Cleaning",
          "Roof Cleaning",
        ],
      },
    },
    subcategories: [
      "Handyman",
      "Painter",
      "Pest Control",
      "Electrical",
      "Plumbing",
      "HVAC Services",
      "Roofing Services",
      "Drywall Repair & Installation",
      "Fencing",
      "Deck Building & Repair",
      "Glass & Shower Doors",
      "Garage Door Repair & Installation",
      "Tile Installation",
      "Gutter Installation",
      "General Cleaning",
      "Pressure Washing",
      "Gutter Cleaning",
      "Junk Removal",
      "Garbage Bin Cleaning",
      "Duct and Furnace Cleaning",
      "Mold Removal",
      "Carpet Cleaning",
      "Window Cleaning",
      "Move-In / Move-Out Cleaning",
      "Roof Cleaning",
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

function normalizeSearchText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function searchServiceCatalog(
  query: string,
  limit = 8,
): ServiceSearchResult[] {
  const normalizedQuery = normalizeSearchText(query);

  if (!normalizedQuery) {
    return [];
  }

  const results: Array<ServiceSearchResult & { score: number }> = [];

  serviceCatalog.forEach((service) => {
    const serviceTerms = [
      service.name,
      service.slug,
      ...(serviceSearchAliases[service.slug] ?? []),
    ].map(normalizeSearchText);
    const serviceMatch = serviceTerms.find((term) =>
      term.includes(normalizedQuery),
    );

    if (serviceMatch) {
      results.push({
        serviceName: service.name,
        serviceSlug: service.slug,
        label: service.name,
        groupKey:
          normalizedQuery.includes("clean") && service.groups?.cleaning
            ? "cleaning"
            : "",
        kind: "service",
        score:
          serviceMatch === normalizedQuery
            ? 0
            : serviceMatch.startsWith(normalizedQuery)
              ? 1
              : 2,
      });
    }

    Object.entries(service.groups ?? {}).forEach(([groupKey, group]) => {
      const normalizedGroup = normalizeSearchText(group.label);

      if (normalizedGroup.includes(normalizedQuery)) {
        results.push({
          serviceName: service.name,
          serviceSlug: service.slug,
          label: `${group.label} · ${service.name}`,
          groupKey,
          kind: "group",
          score: normalizedGroup === normalizedQuery ? 0 : 2,
        });
      }
    });

    service.subcategories.forEach((subcategory) => {
      const normalizedSubcategory = normalizeSearchText(subcategory);

      if (!normalizedSubcategory.includes(normalizedQuery)) {
        return;
      }

      const groupKey =
        Object.entries(service.groups ?? {}).find(([, group]) =>
          group.subcategories.includes(subcategory),
        )?.[0] ?? "";

      results.push({
        serviceName: service.name,
        serviceSlug: service.slug,
        label: subcategory,
        groupKey,
        kind: "subcategory",
        score:
          normalizedSubcategory === normalizedQuery
            ? 0
            : normalizedSubcategory.startsWith(normalizedQuery)
              ? 1
              : 3,
      });
    });
  });

  const uniqueResults = new Map<string, (typeof results)[number]>();

  results
    .sort(
      (first, second) =>
        first.score - second.score || first.label.localeCompare(second.label),
    )
    .forEach((result) => {
      const key = `${result.serviceSlug}:${result.groupKey}:${result.label}`;

      if (!uniqueResults.has(key)) {
        uniqueResults.set(key, result);
      }
    });

  return Array.from(uniqueResults.values()).slice(0, limit);
}
