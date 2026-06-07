export type ServiceAreaRegion = {
  label: string;
  cities: string[];
};

export const serviceAreaRegions: ServiceAreaRegion[] = [
  {
    label: "Surrey Region",
    cities: ["Surrey", "White Rock"],
  },
  {
    label: "Delta Region",
    cities: ["Delta", "North Delta", "Ladner", "Tsawwassen"],
  },
  {
    label: "Langley Region",
    cities: [
      "Langley City",
      "Township of Langley",
      "Walnut Grove",
      "Willoughby",
      "Brookswood",
      "Aldergrove",
      "Fort Langley",
    ],
  },
  {
    label: "Richmond Region",
    cities: ["Richmond"],
  },
  {
    label: "Burnaby / New Westminster",
    cities: ["Burnaby", "New Westminster"],
  },
  {
    label: "Vancouver Region",
    cities: ["Vancouver"],
  },
  {
    label: "North Shore",
    cities: [
      "North Vancouver (City)",
      "North Vancouver (District)",
      "West Vancouver",
    ],
  },
  {
    label: "Tri-Cities",
    cities: ["Coquitlam", "Port Coquitlam", "Port Moody", "Anmore", "Belcarra"],
  },
  {
    label: "Ridge Meadows",
    cities: ["Maple Ridge", "Pitt Meadows"],
  },
  {
    label: "Fraser Valley Regional District",
    cities: [],
  },
  {
    label: "Abbotsford Region",
    cities: ["Abbotsford"],
  },
  {
    label: "Mission Region",
    cities: ["Mission"],
  },
  {
    label: "Chilliwack Region",
    cities: ["Chilliwack"],
  },
  {
    label: "Hope Region",
    cities: ["Hope"],
  },
  {
    label: "Agassiz / Harrison Region",
    cities: ["Agassiz", "Harrison Hot Springs"],
  },
];

export const serviceAreaCities = serviceAreaRegions.flatMap(
  (region) => region.cities,
);

export function normalizeServiceCity(value: unknown) {
  return typeof value === "string"
    ? value.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-CA")
    : "";
}

const canonicalCityByNormalizedName = new Map(
  serviceAreaCities.map((city) => [normalizeServiceCity(city), city]),
);

export function sanitizeServiceCities(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .map((city) =>
          canonicalCityByNormalizedName.get(normalizeServiceCity(city)),
        )
        .filter((city): city is string => Boolean(city)),
    ),
  );
}

export function matchesServiceCity(
  jobCity: unknown,
  selectedServiceCities: string[],
) {
  if (selectedServiceCities.length === 0) {
    return true;
  }

  const normalizedJobCity = normalizeServiceCity(jobCity);

  if (!normalizedJobCity) {
    return false;
  }

  return selectedServiceCities.some(
    (city) => normalizeServiceCity(city) === normalizedJobCity,
  );
}
