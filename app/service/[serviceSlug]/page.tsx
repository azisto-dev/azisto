"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Award,
  Axe,
  BatteryCharging,
  Bike,
  Blocks,
  Box,
  BrickWall,
  Bug,
  Building,
  Building2,
  Bus,
  Cable,
  Car,
  Check,
  ChevronLeft,
  Circle,
  CircleDot,
  CircleGauge,
  CloudLightning,
  Drill,
  Droplets,
  Dumbbell,
  Ear,
  Flower2,
  Footprints,
  Fuel,
  Grid2X2,
  Hammer,
  HeartHandshake,
  House,
  Image as ImageIcon,
  KeyRound,
  Leaf,
  Lightbulb,
  Link as LinkIcon,
  type LucideIcon,
  Map as MapIcon,
  Mountain,
  MoveRight,
  Package,
  PackageOpen,
  Paintbrush,
  PanelTop,
  PanelsTopLeft,
  Recycle,
  Rows3,
  ScanSearch,
  Scissors,
  ShipWheel,
  Shovel,
  ShowerHead,
  Snowflake,
  Sofa,
  Sparkles,
  Sprout,
  Trash2,
  TreePine,
  TriangleAlert,
  Truck,
  Warehouse,
  Waves,
  Wheat,
  Wind,
  Wrench,
  Zap,
} from "lucide-react";

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

const subcategoryIcons: Record<string, LucideIcon> = {
  Handyman: Wrench,
  "General Cleaning": Sparkles,
  Painter: Paintbrush,
  "Pest Control": Bug,
  Electrical: Zap,
  Plumbing: Droplets,
  "HVAC Services": Wind,
  "Junk Removal": Trash2,
  "Roofing Services": House,
  "Drywall Repair & Installation": Hammer,
  Fencing: PanelsTopLeft,
  "Deck Building & Repair": Hammer,
  "Glass & Shower Doors": PanelTop,
  "Gutter Installation & Cleaning": Waves,
  "Garage Door Repair & Installation": Warehouse,
  "Tile Installation": Grid2X2,
  "Mobile Car Servicing": Car,
  "Diagnostic Check": ScanSearch,
  "Car Washing & Detailing": Sparkles,
  "Tire Replacement": Circle,
  "Puncture Repair": Wrench,
  "Alloy Wheel Repair": CircleGauge,
  "In-home Pet Sitting": House,
  "Pet Walking": Footprints,
  Grooming: Scissors,
  "Washing & Cleaning": ShowerHead,
  "Nail Trimming": Scissors,
  "Ear Cleaning": Ear,
  "Pet Training": Award,
  "Lawn Mowing & Edging": Leaf,
  Weeding: Sprout,
  "Pruning & Trimming": Scissors,
  "Leaf Blowing & Cleanup": Wind,
  Mulching: Shovel,
  "Garden Design & Landscaping": Flower2,
  "Seasonal Planting": Sprout,
  "Turf Laying / Seeding": Rows3,
  "Raised Bed Installation": Box,
  "Tree Trimming & Shaping": TreePine,
  "Tree Removal": Axe,
  "Stump Grinding": Drill,
  "Storm Damage Cleanup": CloudLightning,
  "Sprinkler Installation & Repair": Droplets,
  "Drip Irrigation Setup": Droplets,
  "Drainage Solutions": Waves,
  "Soil Fertilizing": Wheat,
  "Aeration & Scarification": CircleDot,
  "Weed & Pest Control": Bug,
  "Composting Services": Recycle,
  "Patio & Pathway Installation": Blocks,
  "Retaining Walls": BrickWall,
  "Outdoor Lighting Installation": Lightbulb,
  "Organic Gardening": Leaf,
  "Water Feature Installation": Waves,
  "Greenhouse Setup": House,
  "Winter Prep & Snow Removal": Snowflake,
  "Local Moves": Truck,
  "Long-distance Moves": MapIcon,
  "Loading & Unloading": PackageOpen,
  "Furniture Rearranging": Sofa,
  "Piano & Heavy Item Moving": Dumbbell,
  "Full Packing Service": Package,
  "Partial Packing": Package,
  "Unpacking & Setup": PackageOpen,
  "Office & Commercial Moves": Building2,
  "Apartment Moves": Building,
  "Senior Moving": HeartHandshake,
  "Art & Fine Item Transport": ImageIcon,
  "Emergency Towing": Truck,
  "Battery Jump-start": BatteryCharging,
  "Flat Tire Change": Circle,
  "Fuel Delivery": Fuel,
  "Lockout Service": KeyRound,
  "Flatbed Towing": Truck,
  "Wheel-lift Towing": Wrench,
  "Hook & Chain Towing": LinkIcon,
  "Dolly Towing": MoveRight,
  "Motorcycle Towing": Bike,
  "Heavy-duty Truck & RV Towing": Truck,
  "Bus & Commercial Vehicle Towing": Bus,
  "Off-road Recovery": Mountain,
  "Winching & Vehicle Extraction": Cable,
  "Mud / Ditch / Rollover Recovery": TriangleAlert,
  "Water / Flood Recovery": Waves,
  "Boat & Trailer Towing": ShipWheel,
};

const iconColorStyles = {
  amber: "bg-amber-50 text-amber-600",
  blue: "bg-sky-50 text-sky-600",
  cyan: "bg-cyan-50 text-cyan-600",
  emerald: "bg-emerald-50 text-emerald-600",
  green: "bg-green-50 text-green-600",
  indigo: "bg-indigo-50 text-indigo-600",
  orange: "bg-orange-50 text-orange-600",
  pink: "bg-pink-50 text-pink-600",
  purple: "bg-purple-50 text-purple-600",
  rose: "bg-rose-50 text-rose-600",
  slate: "bg-slate-100 text-slate-700",
  yellow: "bg-yellow-50 text-yellow-600",
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

function getSubcategoryIconStyle(name: string) {
  const lowerName = name.toLowerCase();

  if (lowerName.includes("clean") || lowerName.includes("wash")) {
    return iconColorStyles.cyan;
  }
  if (lowerName.includes("paint") || lowerName.includes("art")) {
    return iconColorStyles.purple;
  }
  if (lowerName.includes("pest") || lowerName.includes("bug")) {
    return iconColorStyles.rose;
  }
  if (lowerName.includes("electrical") || lowerName.includes("battery")) {
    return iconColorStyles.yellow;
  }
  if (lowerName.includes("plumb") || lowerName.includes("water")) {
    return iconColorStyles.blue;
  }
  if (lowerName.includes("hvac") || lowerName.includes("wind")) {
    return iconColorStyles.indigo;
  }
  if (lowerName.includes("garden") || lowerName.includes("lawn")) {
    return iconColorStyles.green;
  }
  if (lowerName.includes("tree") || lowerName.includes("leaf")) {
    return iconColorStyles.emerald;
  }
  if (lowerName.includes("snow") || lowerName.includes("winter")) {
    return iconColorStyles.blue;
  }
  if (lowerName.includes("move") || lowerName.includes("packing")) {
    return iconColorStyles.orange;
  }
  if (lowerName.includes("pet") || lowerName.includes("grooming")) {
    return iconColorStyles.pink;
  }
  if (lowerName.includes("towing") || lowerName.includes("recovery")) {
    return iconColorStyles.orange;
  }
  if (lowerName.includes("fuel")) {
    return iconColorStyles.amber;
  }
  if (lowerName.includes("lockout") || lowerName.includes("key")) {
    return iconColorStyles.purple;
  }
  if (lowerName.includes("car") || lowerName.includes("tire")) {
    return iconColorStyles.blue;
  }
  if (lowerName.includes("repair") || lowerName.includes("handyman")) {
    return iconColorStyles.amber;
  }

  return iconColorStyles.slate;
}

function SubcategoryIcon({
  name,
  isSelected,
}: {
  name: string;
  isSelected: boolean;
}) {
  const Icon = subcategoryIcons[name] ?? CircleDot;
  const colorClass = getSubcategoryIconStyle(name);

  return (
    <span
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
        isSelected ? "bg-red-500 text-white" : colorClass
      }`}
    >
      <Icon aria-hidden="true" className="h-5 w-5" strokeWidth={2.2} />
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
      <main className="min-h-screen bg-white text-black">
        <div className="mx-auto flex min-h-screen w-full max-w-[390px] flex-col bg-white px-5 py-5">
          <Link
            href="/home"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-black"
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
              className="mt-6 inline-flex h-12 items-center justify-center rounded-lg bg-red-500 px-6 text-sm font-bold text-white shadow-sm"
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

  return (
    <main className="min-h-screen bg-white text-black md:bg-slate-50 md:px-6 md:py-8">
      <div className="mx-auto flex min-h-screen w-full max-w-[390px] flex-col bg-white shadow-none md:min-h-[780px] md:overflow-hidden md:rounded-[28px] md:shadow-2xl md:ring-1 md:ring-slate-200">
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
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-red-500">
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
                      ? "border-red-300 bg-red-50 text-black shadow-red-100"
                      : "border-slate-200 bg-white text-black"
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
                        ? "border-red-500 bg-red-500 text-white"
                        : "border-slate-300 bg-white text-transparent"
                    }`}
                  >
                    <Check aria-hidden="true" className="h-4 w-4" />
                  </span>
                </button>
              );
            })}
          </section>
        </div>

        <div className="sticky bottom-0 border-t border-slate-200 bg-white/95 px-5 py-4 backdrop-blur">
          <Link
            href="/login"
            className="flex h-14 w-full items-center justify-center rounded-xl bg-red-500 text-sm font-bold text-white shadow-lg shadow-red-100"
          >
            {continueLabel}
          </Link>
        </div>
      </div>
    </main>
  );
}
