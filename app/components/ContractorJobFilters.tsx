"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { serviceAreaRegions } from "@/lib/serviceAreas";

export type ContractorJobFilterPreferences = {
  categories: string[];
  subcategories: string[];
  serviceCities: string[];
  urgency: "any" | "flexible" | "this_week" | "urgent";
  sort: "newest" | "urgent";
};

export type ContractorJobFilterOptions = {
  categories: string[];
  subcategoriesByCategory: Record<string, string[]>;
  cities: string[];
};

type ContractorJobFiltersProps = {
  isOpen: boolean;
  filters: ContractorJobFilterPreferences;
  options: ContractorJobFilterOptions;
  isSaving: boolean;
  onClose: () => void;
  onApply: (filters: ContractorJobFilterPreferences) => void;
  onSave: (filters: ContractorJobFilterPreferences) => void;
  onClear: () => void;
};

const emptyFilters: ContractorJobFilterPreferences = {
  categories: [],
  subcategories: [],
  serviceCities: [],
  urgency: "any",
  sort: "newest",
};

const urgencyOptions = [
  { label: "Any", value: "any" },
  { label: "Flexible", value: "flexible" },
  { label: "This week", value: "this_week" },
  { label: "Urgent", value: "urgent" },
] as const;

const sortOptions = [
  { label: "Newest first", value: "newest" },
  { label: "Urgent first", value: "urgent" },
] as const;

function toggleValue(values: string[], value: string) {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];
}

function MultiSelectDropdown({
  title,
  placeholder,
  values,
  selectedValues,
  isOpen,
  onToggleOpen,
  onToggleValue,
  emptyText,
}: {
  title: string;
  placeholder: string;
  values: string[];
  selectedValues: string[];
  isOpen: boolean;
  onToggleOpen: () => void;
  onToggleValue: (value: string) => void;
  emptyText: string;
}) {
  const summary =
    selectedValues.length > 0
      ? `${selectedValues.length} selected`
      : placeholder;

  return (
    <section>
      <p className="text-sm font-bold text-[var(--azisto-contractor-text)]">
        {title}
      </p>
      <div className="relative mt-3">
        <button
          type="button"
          onClick={onToggleOpen}
          className="az-contractor-card-compact flex min-h-12 w-full items-center justify-between gap-3 rounded-[18px] px-3 py-2 text-left"
          aria-expanded={isOpen}
        >
          <span className="min-w-0">
            <span className="block truncate text-sm font-bold text-[var(--azisto-contractor-text)]">
              {summary}
            </span>
            {selectedValues.length > 0 ? (
              <span className="mt-0.5 block truncate text-[11px] font-semibold text-[var(--azisto-contractor-muted)]">
                {selectedValues.join(", ")}
              </span>
            ) : null}
          </span>
          <ChevronDown
            aria-hidden="true"
            className={`h-4 w-4 shrink-0 text-[var(--azisto-contractor-burgundy)] transition ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </button>

        {isOpen ? (
          <div className="az-contractor-card absolute left-0 right-0 top-[calc(100%+0.5rem)] z-20 max-h-56 overflow-y-auto p-2">
            {values.length > 0 ? (
              values.map((value) => {
                const isSelected = selectedValues.includes(value);

                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => onToggleValue(value)}
                    className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-xs font-bold transition ${
                      isSelected
                        ? "bg-[rgb(122_0_60_/_0.08)] text-[var(--azisto-contractor-burgundy)]"
                        : "text-[var(--azisto-contractor-text)] hover:bg-[rgb(248_247_252_/_0.9)]"
                    }`}
                  >
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                        isSelected
                          ? "border-[var(--azisto-contractor-burgundy)] bg-[var(--azisto-contractor-burgundy)] text-white"
                          : "border-[var(--azisto-contractor-border)] bg-white text-transparent"
                      }`}
                    >
                      <Check aria-hidden="true" className="h-3 w-3" />
                    </span>
                    <span>{value}</span>
                  </button>
                );
              })
            ) : (
              <p className="px-3 py-2 text-xs font-semibold text-[var(--azisto-contractor-muted)]">
                {emptyText}
              </p>
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function ServiceAreaDropdown({
  selectedCities,
  isOpen,
  onToggleOpen,
  onChange,
}: {
  selectedCities: string[];
  isOpen: boolean;
  onToggleOpen: () => void;
  onChange: (cities: string[]) => void;
}) {
  const selectedCount = selectedCities.length;

  function toggleCity(city: string) {
    onChange(toggleValue(selectedCities, city));
  }

  function toggleRegion(cities: string[]) {
    const allSelected = cities.every((city) => selectedCities.includes(city));

    onChange(
      allSelected
        ? selectedCities.filter((city) => !cities.includes(city))
        : Array.from(new Set([...selectedCities, ...cities])),
    );
  }

  return (
    <section>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-bold text-[var(--azisto-contractor-text)]">
          Service Areas
        </p>
        {selectedCount > 0 ? (
          <button
            type="button"
            onClick={() => onChange([])}
            className="text-xs font-bold text-[var(--azisto-contractor-burgundy)]"
          >
            Clear cities
          </button>
        ) : null}
      </div>

      <div className="relative mt-3">
        <button
          type="button"
          onClick={onToggleOpen}
          className="az-contractor-card-compact flex min-h-12 w-full items-center justify-between gap-3 rounded-[18px] px-3 py-2 text-left"
          aria-expanded={isOpen}
        >
          <span>
            <span className="block text-sm font-bold text-[var(--azisto-contractor-text)]">
              {selectedCount > 0
                ? `${selectedCount} ${selectedCount === 1 ? "city" : "cities"} selected`
                : "Choose service cities"}
            </span>
            <span className="mt-0.5 block text-[11px] font-semibold text-[var(--azisto-contractor-muted)]">
              {selectedCount > 0
                ? selectedCities.join(", ")
                : "Leave empty to see jobs in all cities"}
            </span>
          </span>
          <ChevronDown
            aria-hidden="true"
            className={`h-4 w-4 shrink-0 text-[var(--azisto-contractor-burgundy)] transition ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </button>

        {isOpen ? (
          <div className="az-contractor-card absolute left-0 right-0 top-[calc(100%+0.5rem)] z-30 max-h-72 overflow-y-auto p-2">
            {serviceAreaRegions.map((region) =>
              region.cities.length === 0 ? (
                <p
                  key={region.label}
                  className="px-3 pb-1 pt-4 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--azisto-contractor-muted)]"
                >
                  {region.label}
                </p>
              ) : (
                <div
                  key={region.label}
                  className="border-b border-[var(--azisto-contractor-border)] py-2 last:border-b-0"
                >
                  <div className="flex items-center justify-between gap-3 px-3 pb-1">
                    <p className="text-xs font-bold text-[var(--azisto-contractor-text)]">
                      {region.label}
                    </p>
                    <button
                      type="button"
                      onClick={() => toggleRegion(region.cities)}
                      className="text-[10px] font-bold text-[var(--azisto-contractor-burgundy)]"
                    >
                      {region.cities.every((city) =>
                        selectedCities.includes(city),
                      )
                        ? "Clear region"
                        : "Select all"}
                    </button>
                  </div>

                  {region.cities.map((city) => {
                    const isSelected = selectedCities.includes(city);

                    return (
                      <button
                        key={city}
                        type="button"
                        onClick={() => toggleCity(city)}
                        className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left text-xs font-semibold transition ${
                          isSelected
                            ? "bg-[rgb(122_0_60_/_0.08)] text-[var(--azisto-contractor-burgundy)]"
                            : "text-[var(--azisto-contractor-text)] hover:bg-[rgb(248_247_252_/_0.9)]"
                        }`}
                      >
                        <span
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                            isSelected
                              ? "border-[var(--azisto-contractor-burgundy)] bg-[var(--azisto-contractor-burgundy)] text-white"
                              : "border-[var(--azisto-contractor-border)] bg-white text-transparent"
                          }`}
                        >
                          <Check aria-hidden="true" className="h-3 w-3" />
                        </span>
                        {city}
                      </button>
                    );
                  })}
                </div>
              ),
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}

export default function ContractorJobFilters({
  isOpen,
  filters,
  options,
  isSaving,
  onClose,
  onApply,
  onSave,
  onClear,
}: ContractorJobFiltersProps) {
  const [draftFilters, setDraftFilters] = useState(filters);
  const [openDropdown, setOpenDropdown] = useState<
    "categories" | "subcategories" | "serviceAreas" | null
  >(null);
  const visibleSubcategories = useMemo(() => {
    if (draftFilters.categories.length === 0) {
      return [];
    }

    return draftFilters.categories
      .flatMap((category) => options.subcategoriesByCategory[category] ?? [])
      .filter((subcategory, index, allSubcategories) =>
        allSubcategories.indexOf(subcategory) === index,
      )
      .sort((first, second) => first.localeCompare(second));
  }, [draftFilters.categories, options.subcategoriesByCategory]);

  useEffect(() => {
    if (isOpen) {
      setDraftFilters(filters);
      setOpenDropdown(null);
    }
  }, [filters, isOpen]);

  if (!isOpen) {
    return null;
  }

  function updateDraftFilters(nextFilters: ContractorJobFilterPreferences) {
    setDraftFilters(nextFilters);
  }

  function updateCategories(category: string) {
    const nextCategories = toggleValue(draftFilters.categories, category);
    const nextVisibleSubcategories =
      nextCategories.length === 0
        ? []
        : nextCategories.flatMap(
            (item) => options.subcategoriesByCategory[item] ?? [],
          );

    updateDraftFilters({
      ...draftFilters,
      categories: nextCategories,
      subcategories: draftFilters.subcategories.filter((subcategory) =>
        nextVisibleSubcategories.includes(subcategory),
      ),
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/20 md:left-1/2 md:right-auto md:top-8 md:h-[min(780px,calc(100vh-4rem))] md:w-full md:max-w-[390px] md:-translate-x-1/2 md:items-end md:rounded-[28px]">
      <section className="az-contractor-shell max-h-[82%] w-full overflow-y-auto rounded-t-[28px] border border-[var(--azisto-contractor-border)] bg-white p-5 shadow-2xl shadow-black/20">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--azisto-contractor-burgundy)]">
              Available jobs
            </p>
            <h2 className="mt-1 text-2xl font-normal text-[var(--azisto-contractor-text)]">Filters</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full text-black"
            aria-label="Close filters"
          >
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5 space-y-5">
          <MultiSelectDropdown
            title="All categories"
            placeholder="Choose service categories"
            values={options.categories}
            selectedValues={draftFilters.categories}
            isOpen={openDropdown === "categories"}
            onToggleOpen={() =>
              setOpenDropdown((currentValue) =>
                currentValue === "categories" ? null : "categories",
              )
            }
            onToggleValue={updateCategories}
            emptyText="No categories available yet."
          />

          <MultiSelectDropdown
            title="Subcategories"
            placeholder={
              draftFilters.categories.length > 0
                ? "Choose subcategories"
                : "Choose a category first"
            }
            values={visibleSubcategories}
            selectedValues={draftFilters.subcategories}
            isOpen={openDropdown === "subcategories"}
            onToggleOpen={() =>
              setOpenDropdown((currentValue) =>
                currentValue === "subcategories" ? null : "subcategories",
              )
            }
            onToggleValue={(subcategory) =>
              updateDraftFilters({
                ...draftFilters,
                subcategories: toggleValue(
                  draftFilters.subcategories,
                  subcategory,
                ),
              })
            }
            emptyText="Select a category to see matching subcategories."
          />

          <ServiceAreaDropdown
            selectedCities={draftFilters.serviceCities}
            isOpen={openDropdown === "serviceAreas"}
            onToggleOpen={() =>
              setOpenDropdown((currentValue) =>
                currentValue === "serviceAreas" ? null : "serviceAreas",
              )
            }
            onChange={(serviceCities) =>
              updateDraftFilters({
                ...draftFilters,
                serviceCities,
              })
            }
          />

          <section>
            <p className="text-sm font-bold text-[var(--azisto-contractor-text)]">Urgency</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {urgencyOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() =>
                    updateDraftFilters({
                      ...draftFilters,
                      urgency: option.value,
                    })
                  }
                  className={`h-11 rounded-full border text-xs font-bold transition ${
                    draftFilters.urgency === option.value
                      ? "border-[var(--azisto-contractor-burgundy)] bg-[rgb(138_15_77_/_0.07)] text-[var(--azisto-contractor-burgundy)]"
                      : "border-[var(--azisto-contractor-border)] bg-white text-[var(--azisto-contractor-muted)]"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </section>

          <section>
            <p className="text-sm font-bold text-[var(--azisto-contractor-text)]">Sort</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {sortOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() =>
                    updateDraftFilters({
                      ...draftFilters,
                      sort: option.value,
                    })
                  }
                  className={`h-11 rounded-full border text-xs font-bold transition ${
                    draftFilters.sort === option.value
                      ? "border-[var(--azisto-contractor-burgundy)] bg-[rgb(138_15_77_/_0.07)] text-[var(--azisto-contractor-burgundy)]"
                      : "border-[var(--azisto-contractor-border)] bg-white text-[var(--azisto-contractor-muted)]"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </section>
        </div>

        <div className="mt-6 grid gap-2">
          <button
            type="button"
            onClick={() => onApply(draftFilters)}
            className="az-btn-contractor flex h-12 items-center justify-center rounded-full text-sm font-bold"
          >
            Apply filters
          </button>
          <button
            type="button"
            onClick={() => onSave(draftFilters)}
            disabled={isSaving}
            className="az-btn-contractor-outline flex h-12 items-center justify-center rounded-full text-sm font-bold"
          >
            {isSaving ? "Saving..." : "Save preferences"}
          </button>
          <button
            type="button"
            onClick={() => {
              setDraftFilters(emptyFilters);
              onClear();
            }}
            className="flex h-12 items-center justify-center rounded-full text-sm font-bold text-red-600"
          >
            Clear filters
          </button>
        </div>
      </section>
    </div>
  );
}
