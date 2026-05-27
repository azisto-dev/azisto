"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";

export type ContractorJobFilterPreferences = {
  categories: string[];
  subcategories: string[];
  cities: string[];
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
  cities: [],
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

function FilterChip({
  isSelected,
  label,
  onClick,
}: {
  isSelected: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-2 text-xs font-bold transition ${
        isSelected
          ? "border-azisto-gold bg-azisto-gold/10 text-azisto-text"
          : "border-azisto-gold bg-white text-slate-700"
      }`}
    >
      {label}
    </button>
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
  const visibleSubcategories = useMemo(() => {
    if (draftFilters.categories.length === 0) {
      return Object.values(options.subcategoriesByCategory)
        .flat()
        .filter((subcategory, index, allSubcategories) =>
          allSubcategories.indexOf(subcategory) === index,
        )
        .sort((first, second) => first.localeCompare(second));
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
    }
  }, [filters, isOpen]);

  if (!isOpen) {
    return null;
  }

  function updateDraftFilters(nextFilters: ContractorJobFilterPreferences) {
    setDraftFilters(nextFilters);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/20 md:left-1/2 md:right-auto md:top-8 md:h-[min(780px,calc(100vh-4rem))] md:w-full md:max-w-[390px] md:-translate-x-1/2 md:items-end md:rounded-[28px]">
      <section className="max-h-[82%] w-full overflow-y-auto rounded-t-3xl border border-azisto-gold bg-white p-5 shadow-2xl shadow-black/20">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-azisto-muted">
              Available jobs
            </p>
            <h2 className="mt-1 text-xl font-bold text-azisto-text">Filters</h2>
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
          <section>
            <p className="text-sm font-bold text-azisto-text">Service category</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {options.categories.length > 0 ? (
                options.categories.map((category) => (
                  <FilterChip
                    key={category}
                    label={category}
                    isSelected={draftFilters.categories.includes(category)}
                    onClick={() =>
                      updateDraftFilters({
                        ...draftFilters,
                        categories: toggleValue(draftFilters.categories, category),
                      })
                    }
                  />
                ))
              ) : (
                <p className="text-xs font-semibold text-azisto-muted">
                  No categories available yet.
                </p>
              )}
            </div>
          </section>

          <section>
            <p className="text-sm font-bold text-azisto-text">Subcategory</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {visibleSubcategories.length > 0 ? (
                visibleSubcategories.map((subcategory) => (
                  <FilterChip
                    key={subcategory}
                    label={subcategory}
                    isSelected={draftFilters.subcategories.includes(subcategory)}
                    onClick={() =>
                      updateDraftFilters({
                        ...draftFilters,
                        subcategories: toggleValue(
                          draftFilters.subcategories,
                          subcategory,
                        ),
                      })
                    }
                  />
                ))
              ) : (
                <p className="text-xs font-semibold text-azisto-muted">
                  Select a category to see matching subcategories.
                </p>
              )}
            </div>
          </section>

          <section>
            <p className="text-sm font-bold text-azisto-text">City</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {options.cities.length > 0 ? (
                options.cities.map((city) => (
                  <FilterChip
                    key={city}
                    label={city}
                    isSelected={draftFilters.cities.includes(city)}
                    onClick={() =>
                      updateDraftFilters({
                        ...draftFilters,
                        cities: toggleValue(draftFilters.cities, city),
                      })
                    }
                  />
                ))
              ) : (
                <p className="text-xs font-semibold text-azisto-muted">
                  Cities appear here when open jobs are available.
                </p>
              )}
            </div>
          </section>

          <section>
            <p className="text-sm font-bold text-azisto-text">Urgency</p>
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
                  className={`h-11 rounded-xl border text-xs font-bold transition ${
                    draftFilters.urgency === option.value
                      ? "border-azisto-gold bg-azisto-gold/10 text-azisto-text"
                      : "border-azisto-gold bg-white text-slate-700"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </section>

          <section>
            <p className="text-sm font-bold text-azisto-text">Sort</p>
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
                  className={`h-11 rounded-xl border text-xs font-bold transition ${
                    draftFilters.sort === option.value
                      ? "border-azisto-gold bg-azisto-gold/10 text-azisto-text"
                      : "border-azisto-gold bg-white text-slate-700"
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
            className="az-btn-primary flex h-12 items-center justify-center rounded-xl text-sm font-bold"
          >
            Apply filters
          </button>
          <button
            type="button"
            onClick={() => onSave(draftFilters)}
            disabled={isSaving}
            className="az-btn-secondary flex h-12 items-center justify-center rounded-xl text-sm font-bold"
          >
            {isSaving ? "Saving..." : "Save preferences"}
          </button>
          <button
            type="button"
            onClick={() => {
              setDraftFilters(emptyFilters);
              onClear();
            }}
            className="flex h-12 items-center justify-center rounded-xl text-sm font-bold text-red-600"
          >
            Clear filters
          </button>
        </div>
      </section>
    </div>
  );
}
