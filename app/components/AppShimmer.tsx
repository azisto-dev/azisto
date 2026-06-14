type AppShimmerProps = {
  className?: string;
  rows?: number;
};

export default function AppShimmer({
  className = "",
  rows = 3,
}: AppShimmerProps) {
  return (
    <section
      aria-busy="true"
      aria-label="Loading content"
      className={`az-shimmer-loader ${className}`}
    >
      <span className="sr-only">Loading content</span>
      <div aria-hidden="true" className="az-shimmer h-4 w-24 rounded-full" />
      <div
        aria-hidden="true"
        className="az-shimmer mt-3 h-7 w-3/5 rounded-full"
      />
      <div aria-hidden="true" className="mt-5 space-y-3">
        {Array.from({ length: rows }, (_, index) => (
          <div
            key={index}
            className="rounded-[20px] border border-[var(--azisto-customer-border)] bg-white p-4"
          >
            <div className="flex items-center gap-3">
              <div className="az-shimmer h-11 w-11 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="az-shimmer h-3.5 w-2/3 rounded-full" />
                <div className="az-shimmer h-3 w-5/6 rounded-full" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
