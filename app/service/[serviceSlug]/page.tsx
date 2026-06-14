"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Check, ChevronLeft, Info } from "lucide-react";
import {
  serviceCatalog,
  type ServiceCatalogItem,
} from "@/lib/serviceCatalog";
import BottomNav from "@/app/components/BottomNav";
import AppHeader from "@/app/components/AppHeader";

type ServiceDisplayDetails = {
  name: string;
  slug: string;
  aliases?: string[];
  image: string;
  imageAlt: string;
  imageClassName?: string;
  description: string;
};

type ServicePageItem = ServiceCatalogItem & ServiceDisplayDetails;

const serviceDisplayDetails: ServiceDisplayDetails[] = [
  {
    name: "Home Care",
    slug: "home-care",
    image: "/service-icons/home-care.png",
    imageAlt: "Premium home care icon",
    imageClassName: "rounded-[18px]",
    description:
      "Choose the home tasks you need help with, from quick repairs to larger maintenance projects.",
  },
  {
    name: "Car Care",
    slug: "car-care",
    image: "/service-icons/car-care.png",
    imageAlt: "Premium car care icon",
    imageClassName: "rounded-[18px]",
    description:
      "Select the vehicle services you need, whether it is a clean, a check, or help with tires.",
  },
  {
    name: "Pet Care",
    slug: "pet-care",
    image: "/service-icons/pet-care.png",
    imageAlt: "Premium pet care icon",
    imageClassName: "rounded-[18px]",
    description:
      "Pick the pet care support that fits your day, from visits and walks to grooming tasks.",
  },
  {
    name: "Garden Care",
    slug: "garden-care",
    image: "/service-icons/garden-care-direct.png",
    imageAlt: "Premium garden care icon",
    description:
      "Build a custom outdoor request for routine care, seasonal cleanup, or bigger garden projects.",
  },
  {
    name: "Moving",
    slug: "moving",
    image: "/service-icons/moving-direct.png",
    imageAlt: "Premium moving icon",
    description:
      "Tell us what kind of moving help you need, from packing to transport and setup.",
  },
  {
    name: "Roadside & Emergency",
    slug: "roadside-emergency",
    aliases: ["towing"],
    image: "/service-icons/towing.png",
    imageAlt: "Tow truck carrying a car icon",
    description:
      "Choose the roadside help you need so assistance can be matched to the situation.",
  },
];

const services: ServicePageItem[] = serviceCatalog.map((service) => {
  const displayDetails = serviceDisplayDetails.find(
    (details) => details.slug === service.slug,
  );

  if (!displayDetails) {
    throw new Error(`Missing display details for service ${service.slug}`);
  }

  return {
    ...service,
    ...displayDetails,
  };
});

const iconBadgeStyles = {
  amber:
    "border-amber-100 bg-gradient-to-br from-amber-50 via-white to-orange-100 shadow-amber-100/80",
  blue:
    "border-[#F5B400]/30 bg-white shadow-amber-100/60",
  cyan:
    "border-cyan-100 bg-gradient-to-br from-cyan-50 via-white to-teal-100 shadow-cyan-100/80",
  emerald:
    "border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-green-100 shadow-emerald-100/80",
  green:
    "border-green-100 bg-gradient-to-br from-lime-50 via-white to-green-100 shadow-green-100/80",
  indigo:
    "border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-sky-100 shadow-indigo-100/80",
  orange:
    "border-orange-100 bg-gradient-to-br from-orange-50 via-white to-amber-100 shadow-orange-100/80",
  pink:
    "border-amber-100 bg-gradient-to-br from-amber-50 via-white to-stone-100 shadow-amber-100/80",
  purple:
    "border-purple-100 bg-gradient-to-br from-purple-50 via-white to-fuchsia-100 shadow-purple-100/80",
  rose:
    "border-amber-100 bg-gradient-to-br from-amber-50 via-white to-stone-100 shadow-amber-100/80",
  slate:
    "border-azisto-border bg-gradient-to-br from-slate-50 via-white to-slate-100 shadow-slate-100/80",
  yellow:
    "border-yellow-100 bg-gradient-to-br from-yellow-50 via-white to-amber-100 shadow-yellow-100/80",
};

type IconTheme = keyof typeof iconBadgeStyles;

type SubcategoryVisual = {
  symbol: string;
  theme: IconTheme;
  image?: string;
};

const subcategoryVisuals: Record<string, SubcategoryVisual> = {
  Handyman: { symbol: "🛠️", theme: "amber" },
  "General Cleaning": { symbol: "✨", theme: "cyan" },
  Painter: { symbol: "🎨", theme: "purple" },
  "Pest Control": {
    symbol: "🐞",
    theme: "rose",
    image: "/subcategory-icons/pest-control-cockroach.svg",
  },
  Electrical: { symbol: "⚡", theme: "yellow" },
  Plumbing: { symbol: "💧", theme: "blue" },
  "HVAC Services": { symbol: "🌬️", theme: "indigo" },
  "Junk Removal": { symbol: "🗑️", theme: "slate" },
  "Pressure Washing": { symbol: "💦", theme: "blue" },
  "Gutter Cleaning": { symbol: "🫧", theme: "cyan" },
  "Garbage Bin Cleaning": { symbol: "🗑️", theme: "green" },
  "Duct and Furnace Cleaning": { symbol: "🌬️", theme: "indigo" },
  "Mold Removal": { symbol: "🧼", theme: "rose" },
  "Carpet Cleaning": { symbol: "🧽", theme: "purple" },
  "Window Cleaning": { symbol: "🪟", theme: "cyan" },
  "Move-In / Move-Out Cleaning": { symbol: "📦", theme: "orange" },
  "Roof Cleaning": { symbol: "🏠", theme: "blue" },
  "Roofing Services": { symbol: "🏠", theme: "orange" },
  "Drywall Repair & Installation": { symbol: "🔨", theme: "amber" },
  Fencing: {
    symbol: "🪵",
    theme: "amber",
    image: "/subcategory-icons/fencing.svg",
  },
  "Deck Building & Repair": { symbol: "🪚", theme: "orange" },
  "Glass & Shower Doors": {
    symbol: "🚪",
    theme: "cyan",
    image: "/subcategory-icons/glass-shower-door.svg",
  },
  "Gutter Installation": { symbol: "💦", theme: "blue" },
  "Garage Door Repair & Installation": {
    symbol: "🏘️",
    theme: "slate",
    image: "/subcategory-icons/garage-door.svg",
  },
  "Tile Installation": { symbol: "▦", theme: "purple" },
  "Mobile Car Servicing": { symbol: "🚗", theme: "blue" },
  "Diagnostic Check": { symbol: "🔎", theme: "indigo" },
  "Car Washing & Detailing": { symbol: "🫧", theme: "cyan" },
  "Tire Replacement": { symbol: "🛞", theme: "slate" },
  "Puncture Repair": { symbol: "🔧", theme: "amber" },
  "Alloy Wheel Repair": {
    symbol: "⚙️",
    theme: "slate",
    image: "/subcategory-icons/alloy-wheel.svg",
  },
  "In-home Pet Sitting": { symbol: "🐾", theme: "pink" },
  "Pet Walking": { symbol: "🐕", theme: "orange" },
  Grooming: { symbol: "✂️", theme: "purple" },
  "Washing & Cleaning": { symbol: "🫧", theme: "cyan" },
  "Nail Trimming": {
    symbol: "💅",
    theme: "pink",
    image: "/subcategory-icons/pet-nails.svg",
  },
  "Ear Cleaning": { symbol: "👂", theme: "amber" },
  "Pet Training": {
    symbol: "🏅",
    theme: "yellow",
    image: "/subcategory-icons/pet-training.svg",
  },
  "Lawn Mowing & Edging": { symbol: "🌱", theme: "green" },
  Weeding: { symbol: "🌿", theme: "emerald" },
  "Pruning & Trimming": { symbol: "✂️", theme: "green" },
  "Leaf Blowing & Cleanup": { symbol: "🍃", theme: "emerald" },
  Mulching: { symbol: "🪴", theme: "amber" },
  "Garden Design & Landscaping": { symbol: "🌸", theme: "pink" },
  "Seasonal Planting": { symbol: "🌷", theme: "green" },
  "Turf Laying / Seeding": { symbol: "🌾", theme: "green" },
  "Raised Bed Installation": {
    symbol: "🥕",
    theme: "orange",
    image: "/subcategory-icons/raised-garden-bed.svg",
  },
  "Tree Trimming & Shaping": { symbol: "🌲", theme: "emerald" },
  "Tree Removal": { symbol: "🪓", theme: "amber" },
  "Stump Grinding": { symbol: "🪵", theme: "amber" },
  "Storm Damage Cleanup": { symbol: "⛈️", theme: "indigo" },
  "Sprinkler Installation & Repair": { symbol: "💦", theme: "blue" },
  "Drip Irrigation Setup": { symbol: "💧", theme: "blue" },
  "Drainage Solutions": { symbol: "🌊", theme: "blue" },
  "Soil Fertilizing": { symbol: "🌻", theme: "yellow" },
  "Aeration & Scarification": { symbol: "🟤", theme: "amber" },
  "Weed & Pest Control": { symbol: "🐛", theme: "rose" },
  "Composting Services": { symbol: "♻️", theme: "green" },
  "Patio & Pathway Installation": { symbol: "🧱", theme: "orange" },
  "Retaining Walls": { symbol: "🧱", theme: "slate" },
  "Outdoor Lighting Installation": { symbol: "💡", theme: "yellow" },
  "Organic Gardening": { symbol: "🍃", theme: "green" },
  "Water Feature Installation": { symbol: "⛲", theme: "blue" },
  "Greenhouse Setup": { symbol: "🏡", theme: "emerald" },
  "Winter Prep & Snow Removal": { symbol: "❄️", theme: "blue" },
  "Local Moves": { symbol: "🚚", theme: "orange" },
  "Long-distance Moves": { symbol: "🗺️", theme: "blue" },
  "Loading & Unloading": { symbol: "📦", theme: "amber" },
  "Furniture Rearranging": { symbol: "🛋️", theme: "purple" },
  "Piano & Heavy Item Moving": { symbol: "🏋️", theme: "slate" },
  "Full Packing Service": { symbol: "📦", theme: "orange" },
  "Partial Packing": {
    symbol: "📬",
    theme: "amber",
    image: "/subcategory-icons/wrapped-furniture.svg",
  },
  "Unpacking & Setup": {
    symbol: "📭",
    theme: "green",
    image: "/subcategory-icons/box-open.svg",
  },
  "Office & Commercial Moves": { symbol: "🏢", theme: "indigo" },
  "Apartment Moves": { symbol: "🏙️", theme: "blue" },
  "Senior Moving": { symbol: "🤝", theme: "pink" },
  "Art & Fine Item Transport": { symbol: "🖼️", theme: "purple" },
  "Emergency Towing": { symbol: "🚨", theme: "rose" },
  "Battery Jump-start": { symbol: "🔋", theme: "yellow" },
  "Flat Tire Change": { symbol: "🛞", theme: "slate" },
  "Fuel Delivery": { symbol: "⛽", theme: "amber" },
  "Lockout Service": { symbol: "🔑", theme: "purple" },
  "Flatbed Towing": {
    symbol: "🚚",
    theme: "orange",
    image: "/subcategory-icons/flatbed-truck.svg",
  },
  "Wheel-lift Towing": {
    symbol: "🔧",
    theme: "amber",
    image: "/subcategory-icons/wheel-lift-tow-truck.svg",
  },
  "Hook & Chain Towing": { symbol: "🔗", theme: "slate" },
  "Dolly Towing": { symbol: "➡️", theme: "blue" },
  "Motorcycle Towing": { symbol: "🏍️", theme: "orange" },
  "Heavy-duty Truck & RV Towing": { symbol: "🚛", theme: "orange" },
  "Bus & Commercial Vehicle Towing": { symbol: "🚌", theme: "yellow" },
  "Off-road Recovery": { symbol: "⛰️", theme: "emerald" },
  "Winching & Vehicle Extraction": { symbol: "🪝", theme: "slate" },
  "Mud / Ditch / Rollover Recovery": { symbol: "⚠️", theme: "amber" },
  "Water / Flood Recovery": { symbol: "🌊", theme: "blue" },
  "Boat & Trailer Towing": {
    symbol: "⚓",
    theme: "blue",
    image: "/subcategory-icons/boat-trailer.svg",
  },
};

function getCurrentSlug(pathname: string) {
  const parts = pathname.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? "";
}

function findService(slug: string) {
  return services.find(
    (service) =>
      service.slug === slug ||
      ("aliases" in service &&
        Array.isArray(service.aliases) &&
        service.aliases.includes(slug)),
  );
}

function getServiceGroupStorageKey(slug: string) {
  return `azisto-service-group:${slug}`;
}

function SubcategoryIcon({
  name,
  isSelected,
}: {
  name: string;
  isSelected: boolean;
}) {
  const visual = subcategoryVisuals[name] ?? {
    symbol: "✨",
    theme: "slate" as IconTheme,
  };
  const badgeClass = iconBadgeStyles[visual.theme];

  return (
    <span
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-0 shadow-sm ${
        isSelected
          ? "bg-blue-50 shadow-blue-100"
          : badgeClass
      }`}
    >
      <span
        aria-hidden="true"
        className={`text-[25px] leading-none drop-shadow-sm ${
          isSelected ? "scale-95 saturate-150" : "saturate-125"
        }`}
      >
        {visual.image ? (
          <img
            src={visual.image}
            alt=""
            className="h-8 w-8 object-contain"
          />
        ) : (
          visual.symbol
        )}
      </span>
    </span>
  );
}

export default function ServiceDetailPage() {
  const pathname = usePathname();
  const slug = getCurrentSlug(pathname);
  const service = findService(slug);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const groupEntries = service?.groups
    ? Object.entries(service.groups)
    : [];
  const [selectedGroupKey, setSelectedGroupKey] = useState(
    groupEntries[0]?.[0] ?? "",
  );
  const activeGroup =
    groupEntries.find(([groupKey]) => groupKey === selectedGroupKey) ??
    groupEntries[0];
  const visibleSubcategories = activeGroup
    ? activeGroup[1].subcategories
    : service?.subcategories ?? [];
  const subcategoryGroupLabels = new Map(
    groupEntries.flatMap(([, group]) =>
      group.subcategories.map((subcategory) => [subcategory, group.label]),
    ),
  );

  useEffect(() => {
    const defaultGroupKey = groupEntries[0]?.[0] ?? "";

    if (!defaultGroupKey) {
      setSelectedGroupKey("");
      return;
    }

    const savedGroupKey =
      typeof window !== "undefined"
        ? window.sessionStorage.getItem(getServiceGroupStorageKey(slug))
        : "";
    const nextGroupKey =
      savedGroupKey && groupEntries.some(([groupKey]) => groupKey === savedGroupKey)
        ? savedGroupKey
        : defaultGroupKey;

    setSelectedGroupKey(nextGroupKey);
  }, [slug]);

  if (!service) {
    return (
      <main className="az-customer-shell min-h-screen bg-azisto-background text-black">
        <div className="mx-auto flex min-h-screen w-full max-w-[390px] flex-col bg-white px-5 py-5">
          <Link
            href="/home"
            className="flex h-10 w-10 items-center justify-center rounded-full text-black"
            aria-label="Back to home"
          >
            <ChevronLeft aria-hidden="true" className="h-5 w-5" />
          </Link>

          <div className="mt-14 text-center">
            <h1 className="text-2xl font-bold text-black">
              Service not found
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Please choose a service from the AZISTO home page.
            </p>
            <Link
              href="/home"
              className="az-btn-primary mt-6 inline-flex h-12 items-center justify-center rounded-lg px-6 text-sm font-bold"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </main>
    );
  }

  function toggleSubcategory(name: string) {
    setSelectedItems((currentItems) => {
      if (currentItems.includes(name)) {
        return currentItems.filter((item) => item !== name);
      }

      return [...currentItems, name];
    });
  }

  const selectedCount = selectedItems.length;
  const continueLabel =
    selectedCount === 0 ? "Continue" : `Continue (${selectedCount} selected)`;
  const requestParams = new URLSearchParams();

  requestParams.set("service", service.name);
  selectedItems.forEach((item) => {
    requestParams.append("item", item);
    const groupLabel = subcategoryGroupLabels.get(item);

    if (groupLabel) {
      requestParams.append("itemGroup", `${item}|||${groupLabel}`);
    }
  });

  return (
    <main className="az-customer-shell min-h-screen bg-azisto-background text-black md:bg-azisto-background md:px-6 md:py-8">
      <div className="mx-auto flex h-screen min-h-0 w-full max-w-[390px] flex-col bg-white shadow-none md:h-[780px] md:overflow-hidden md:rounded-[28px] md:shadow-2xl md:ring-1 md:ring-azisto-border">
        <div className="azisto-scroll min-h-0 flex-1 overflow-y-auto px-5 pb-28 pt-5">
          <AppHeader
            leftControl={
              <Link
                href="/home"
                className="flex h-10 w-10 items-center justify-center rounded-full text-black"
                aria-label="Back to home"
              >
                <ChevronLeft aria-hidden="true" className="h-5 w-5" />
              </Link>
            }
          />

          <section className="mt-8">
            <div className="flex items-center gap-4">
              <img
                src={service.image}
                alt={service.imageAlt}
                className={`h-20 w-20 object-contain ${
                  service.imageClassName ?? ""
                }`}
              />
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] az-kicker">
                  Select services
                </p>
                <h1 className="mt-1 text-3xl font-bold leading-tight text-black">
                  {service.name}
                </h1>
              </div>
            </div>

            <p className="mt-4 text-sm leading-6 text-slate-600">
              {service.description}
            </p>
          </section>

          {groupEntries.length > 0 ? (
            <div className="mt-6 grid grid-cols-2 gap-2 rounded-2xl border border-azisto-border bg-[#F7F4F1] p-1.5 shadow-[0_8px_22px_rgba(15,23,42,0.08)]">
              {groupEntries.map(([groupKey, group]) => {
                const isSelected = activeGroup?.[0] === groupKey;

                return (
                  <button
                    key={groupKey}
                    type="button"
                    onClick={() => {
                      setSelectedGroupKey(groupKey);
                      window.sessionStorage.setItem(
                        getServiceGroupStorageKey(slug),
                        groupKey,
                      );
                    }}
                    className={`flex h-11 items-center justify-center rounded-xl border text-sm font-bold shadow-sm transition duration-200 ${
                      isSelected
                        ? "border-[#1F1F1F] bg-[#1F1F1F] text-white shadow-[0_6px_16px_rgba(31,31,31,0.16)]"
                        : "border-azisto-border bg-white/45 text-slate-600"
                    }`}
                  >
                    {group.label} ({group.subcategories.length})
                  </button>
                );
              })}
            </div>
          ) : null}

          <section className="mt-6 space-y-3">
            {visibleSubcategories.map((subcategory) => {
              const isSelected = selectedItems.includes(subcategory);

              return (
                <button
                  key={subcategory}
                  type="button"
                  onClick={() => toggleSubcategory(subcategory)}
                  className={`az-service-subcategory-card flex min-h-[58px] w-full items-center justify-between rounded-2xl border-0 px-3 py-2.5 text-left shadow-[0_2px_8px_rgba(0,0,0,0.055)] outline-none transition hover:-translate-y-0.5 ${
                    isSelected
                      ? "bg-blue-50 text-black"
                      : "bg-white/90 text-black hover:bg-white"
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <SubcategoryIcon
                      name={subcategory}
                      isSelected={isSelected}
                    />
                    <span className="text-sm font-bold leading-5">
                      {subcategory}
                    </span>
                  </span>

                  <span
                    className={`ml-3 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border ${
                      isSelected
                        ? "border-[var(--azisto-customer-azure)] bg-[var(--azisto-customer-azure)] text-white"
                        : "border-[var(--azisto-customer-border)] bg-white text-transparent"
                    }`}
                  >
                    <Check aria-hidden="true" className="h-4 w-4" />
                  </span>
                </button>
              );
            })}
          </section>
        </div>

        <div className="sticky bottom-0 border-t border-azisto-border bg-white/95 px-5 py-4 backdrop-blur">
          {selectedCount > 1 ? (
            <div className="mb-3 flex items-start gap-2 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2.5 text-xs font-semibold leading-5 text-slate-700">
              <Info
                aria-hidden="true"
                className="mt-0.5 h-4 w-4 shrink-0 text-azisto-accent"
              />
              <p>
                Please note: when choosing multiple tasks, more than one
                contractor may be required to complete them.
              </p>
            </div>
          ) : null}
          <Link
            href={`/request?${requestParams.toString()}`}
            className="az-btn-primary flex h-14 w-full items-center justify-center rounded-xl text-sm font-bold"
          >
            {continueLabel}
          </Link>
        </div>
        <BottomNav role="customer" />
      </div>
    </main>
  );
}
