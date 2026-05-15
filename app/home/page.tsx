import Link from "next/link";

const services = [
  {
    name: "Home Care",
    slug: "home-care",
    image: "/service-icons/home-care.png",
    imageAlt: "Premium home care icon",
    imageClassName: "rounded-[18px]",
  },
  {
    name: "Car Care",
    slug: "car-care",
    image: "/service-icons/car-care.png",
    imageAlt: "Premium car care icon",
    imageClassName: "rounded-[18px]",
  },
  {
    name: "Pet Care",
    slug: "pet-care",
    image: "/service-icons/pet-care.png",
    imageAlt: "Premium pet care icon",
    imageClassName: "rounded-[18px]",
  },
  {
    name: "Garden Care",
    slug: "garden-care",
    image: "/service-icons/garden-care-direct.png",
    imageAlt: "Premium garden care icon",
  },
  {
    name: "Moving",
    slug: "moving",
    image: "/service-icons/moving-direct.png",
    imageAlt: "Premium moving icon",
  },
  {
    name: "Roadside & Emergency",
    slug: "roadside-emergency",
    image: "/service-icons/towing.png",
    imageAlt: "Tow truck carrying a car icon",
  },
];

const navItems = [
  {
    label: "Home",
    href: "/home",
    active: true,
    path: "M3 10.5 12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-10.5Z",
  },
  {
    label: "Bookings",
    href: "/login",
    active: false,
    path: "M7 3v3M17 3v3M4 8h16M6 5h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z",
  },
  {
    label: "Messages",
    href: "/login",
    active: false,
    path: "M4 5h16v11H8l-4 4V5ZM8 9h8M8 13h5",
  },
  {
    label: "Profile",
    href: "/login",
    active: false,
    path: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21a8 8 0 0 1 16 0",
  },
];

function MenuIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-6 w-6"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path strokeLinecap="round" d="M5 7h14M5 12h14M5 17h14" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-6 w-6"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 17H9m9-1V11a6 6 0 1 0-12 0v5l-2 2h16l-2-2ZM10 21h4"
      />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5 text-black"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m21 21-4.3-4.3M10.8 18a7.2 7.2 0 1 1 0-14.4 7.2 7.2 0 0 1 0 14.4Z"
      />
    </svg>
  );
}

function NavIcon({ path }: { path: string }) {
  return (
    <svg
      aria-hidden="true"
      className="mx-auto h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d={path} />
    </svg>
  );
}

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white text-black md:bg-slate-50 md:px-6 md:py-8">
      <div className="mx-auto flex min-h-screen w-full max-w-[390px] flex-col bg-white shadow-none md:min-h-[780px] md:overflow-hidden md:rounded-[28px] md:shadow-2xl md:ring-1 md:ring-slate-200">
        <div className="flex-1 px-5 pb-6 pt-5">
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
              href="/login"
              className="flex h-10 w-10 items-center justify-center rounded-full text-black"
              aria-label="Open menu"
            >
              <MenuIcon />
            </Link>

            <Link href="/home" className="flex justify-center">
              <img
                src="/azisto-logo-cropped.png"
                alt="AZISTO - Your on-demand assistant"
                className="w-full max-w-[165px] object-contain"
              />
            </Link>

            <Link
              href="/login"
              className="relative flex h-10 w-10 items-center justify-center justify-self-end rounded-full text-black"
              aria-label="Notifications"
            >
              <BellIcon />
              <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white" />
            </Link>
          </header>

          <section className="mt-6">
            <h1 className="text-3xl font-bold leading-tight text-black">
              Hello, Alex
            </h1>
          </section>

          <div className="mt-5 flex h-14 items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 text-sm text-slate-500 shadow-sm">
            <Link
              href="/login"
              className="flex min-w-0 flex-1 items-center justify-between gap-3"
            >
              <span className="truncate">What do you need help with?</span>
              <SearchIcon />
            </Link>

            <Link
              href="/ai-assistant"
              className="azisto-ai-glow flex h-9 shrink-0 items-center justify-center rounded-full border border-red-100 bg-white/80 px-3 text-xs font-bold text-red-500 shadow-lg shadow-red-100/70 backdrop-blur"
              aria-label="Open AZISTO AI assistant"
            >
              ✨ AI
            </Link>
          </div>

          <section className="mt-6 grid grid-cols-3 gap-3">
            {services.map((service) => (
              <Link
                key={service.name}
                href={`/service/${service.slug}`}
                className="flex min-h-[86px] flex-col items-center justify-start text-center"
              >
                <img
                  src={service.image}
                  alt={service.imageAlt}
                  className={`h-16 w-16 object-contain ${
                    service.imageClassName ?? ""
                  }`}
                />
                <span className="mt-2 text-xs font-bold leading-tight text-black">
                  {service.name}
                </span>
              </Link>
            ))}
          </section>

          <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-bold text-black">
              Trusted professionals
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Verified. Rated. Reliable.
            </p>

            <div className="mt-5 flex items-center justify-between">
              <div className="flex -space-x-2">
                {["AJ", "MK", "SR"].map((initials) => (
                  <div
                    key={initials}
                    className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-slate-900 text-[10px] font-bold text-white"
                  >
                    {initials}
                  </div>
                ))}
              </div>

              <p className="text-sm font-semibold text-black">
                <span className="text-yellow-400">★</span> 4.9{" "}
                <span className="font-normal text-slate-500">
                  (2.3k reviews)
                </span>
              </p>
            </div>
          </section>
        </div>

        <nav className="border-t border-slate-200 bg-white px-3 py-2">
          <div className="grid grid-cols-4">
            {navItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className={`rounded-lg px-2 py-2 text-center text-[11px] font-semibold ${
                  item.active ? "text-red-500" : "text-slate-500"
                }`}
              >
                <NavIcon path={item.path} />
                <span className="mt-1 block">{item.label}</span>
              </Link>
            ))}
          </div>
        </nav>
      </div>
    </main>
  );
}
