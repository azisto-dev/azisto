import Link from "next/link";

const categories = [
  {
    name: "Home Services",
    description: "Repairs, installs, and maintenance for your place.",
    subcategories: ["Plumbing", "Electrical", "Appliance repair"],
  },
  {
    name: "Cleaning",
    description: "Regular, deep, move-out, and short-term rental cleaning.",
    subcategories: ["House cleaning", "Deep cleaning", "Move-out cleaning"],
  },
  {
    name: "Outdoor",
    description: "Yard care and seasonal help for Canadian homes.",
    subcategories: ["Lawn care", "Snow removal", "Landscaping"],
  },
  {
    name: "Automotive",
    description: "Mobile help for vehicles, tires, detailing, and checks.",
    subcategories: ["Car detailing", "Tire change", "Battery boost"],
  },
  {
    name: "Wellness",
    description: "Personal care and wellness services near you.",
    subcategories: ["Massage", "Personal training", "Hair services"],
  },
  {
    name: "Learning",
    description: "Tutors, coaches, and lessons for every age.",
    subcategories: ["Math tutoring", "Music lessons", "Language lessons"],
  },
];

const navItems = [
  { label: "Home", href: "/home", active: true },
  { label: "Bookings", href: "/login", active: false },
  { label: "Messages", href: "/login", active: false },
  { label: "Profile", href: "/login", active: false },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-50 pb-24">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
          <Link
            href="/home"
            className="text-2xl font-bold tracking-widest text-slate-950"
          >
            AZI<span className="text-red-500">•</span>STO
          </Link>

          <Link
            href="/login"
            className="rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white"
          >
            Login
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-5 py-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-950">
            Find local services across Canada
          </h1>
          <p className="mt-2 max-w-2xl text-slate-600">
            Browse trusted categories first. Sign in only when you are ready to
            request, book, message, or manage your profile.
          </p>
        </div>

        <div className="mb-8 flex gap-3 rounded-lg bg-white p-3 shadow-sm ring-1 ring-slate-200">
          <input
            className="min-w-0 flex-1 rounded-md border border-slate-300 px-4 py-3 text-base outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100"
            type="search"
            placeholder="Search for cleaning, snow removal, plumbing..."
          />
          <Link
            href="/login"
            className="rounded-md bg-red-500 px-5 py-3 font-semibold text-white"
          >
            Search
          </Link>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => (
            <section
              key={category.name}
              className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-slate-200"
            >
              <Link href="/login" className="block">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-md bg-red-50 text-sm font-bold text-red-600">
                  {category.name.slice(0, 2).toUpperCase()}
                </div>
                <h2 className="text-xl font-semibold text-slate-950">
                  {category.name}
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {category.description}
                </p>
              </Link>

              <div className="mt-5 flex flex-wrap gap-2">
                {category.subcategories.map((subcategory) => (
                  <Link
                    key={subcategory}
                    href="/login"
                    className="rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:border-red-200 hover:bg-red-50 hover:text-red-700"
                  >
                    {subcategory}
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      </section>

      <nav className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white">
        <div className="mx-auto grid max-w-2xl grid-cols-4 px-2 py-2">
          {navItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className={`rounded-md px-3 py-3 text-center text-sm font-semibold ${
                item.active
                  ? "bg-slate-950 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </nav>
    </main>
  );
}
