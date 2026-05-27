"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Check, ChevronLeft } from "lucide-react";

const services = [
  {
    name: "Home Care",
    slug: "home-care",
    image: "/service-icons/home-care.png",
    imageAlt: "Premium home care icon",
    imageClassName: "rounded-[18px]",
    description:
      "Choose the home tasks you need help with, from quick repairs to larger maintenance projects.",
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
    image: "/service-icons/car-care.png",
    imageAlt: "Premium car care icon",
    imageClassName: "rounded-[18px]",
    description:
      "Select the vehicle services you need, whether it is a clean, a check, or help with tires.",
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
    image: "/service-icons/pet-care.png",
    imageAlt: "Premium pet care icon",
    imageClassName: "rounded-[18px]",
    description:
      "Pick the pet care support that fits your day, from visits and walks to grooming tasks.",
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
    image: "/service-icons/garden-care-direct.png",
    imageAlt: "Premium garden care icon",
    description:
      "Build a custom outdoor request for routine care, seasonal cleanup, or bigger garden projects.",
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
    image: "/service-icons/moving-direct.png",
    imageAlt: "Premium moving icon",
    description:
      "Tell us what kind of moving help you need, from packing to transport and setup.",
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
    aliases: ["towing"],
    image: "/service-icons/towing.png",
    imageAlt: "Tow truck carrying a car icon",
    description:
      "Choose the roadside help you need so assistance can be matched to the situation.",
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

const iconBadgeStyles = {
  amber:
    "border-amber-100 bg-gradient-to-br from-amber-50 via-white to-orange-100 shadow-amber-100/80",
  blue:
    "border-azisto-gold/30 bg-white shadow-azisto-gold/10",
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
  "Gutter Installation & Cleaning": { symbol: "💦", theme: "blue" },
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
    (service) => service.slug === slug || service.aliases?.includes(slug),
  );
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
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border shadow-sm ${
        isSelected
          ? "border-azisto-gold bg-white shadow-azisto-gold/10"
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

  if (!service) {
    return (
      <main className="min-h-screen bg-azisto-background text-black">
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
  });

  return (
    <main className="min-h-screen bg-azisto-background text-black md:bg-azisto-background md:px-6 md:py-8">
      <div className="mx-auto flex min-h-screen w-full max-w-[390px] flex-col bg-white shadow-none md:min-h-[780px] md:overflow-hidden md:rounded-[28px] md:shadow-2xl md:ring-1 md:ring-azisto-border">
        <div className="flex-1 px-5 pb-28 pt-5">
          <div className="mb-5 flex items-center justify-between text-xs font-bold">
            <span>9:41</span>
            <div className="flex items-center gap-1">
              <span className="h-2.5 w-3 rounded-sm bg-black" />
              <span className="h-2.5 w-3 rounded-sm border border-black" />
              <span className="h-2.5 w-5 rounded-sm bg-black" />
            </div>
          </div>

          <header className="mt-3 grid grid-cols-[40px_1fr_40px] items-center">
            <Link
              href="/home"
              className="flex h-10 w-10 items-center justify-center rounded-full text-black"
              aria-label="Back to home"
            >
              <ChevronLeft aria-hidden="true" className="h-5 w-5" />
            </Link>

            <Link href="/home" className="flex justify-center">
              <img
                src="/azisto-logo-cropped.png"
                alt="AZISTO - Your on-demand assistant"
                className="w-full max-w-[165px] object-contain"
              />
            </Link>

            <span aria-hidden="true" />
          </header>

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

          <section className="mt-6 space-y-3">
            {service.subcategories.map((subcategory) => {
              const isSelected = selectedItems.includes(subcategory);

              return (
                <button
                  key={subcategory}
                  type="button"
                  onClick={() => toggleSubcategory(subcategory)}
                  className={`flex min-h-[60px] w-full items-center justify-between rounded-xl border px-4 py-3 text-left shadow-sm transition ${
                    isSelected
                      ? "border-azisto-gold bg-white text-black shadow-azisto-gold/10"
                      : "border-azisto-gold bg-white text-black"
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
                        ? "border-azisto-gold bg-azisto-gold text-white"
                        : "border-azisto-gold bg-white text-transparent"
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
          <Link
            href={`/request?${requestParams.toString()}`}
            className="az-btn-primary flex h-14 w-full items-center justify-center rounded-xl text-sm font-bold"
          >
            {continueLabel}
          </Link>
        </div>
      </div>
    </main>
  );
}
