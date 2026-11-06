// Generic skeleton placeholder used inside tab panels (or any small content
// region) while their data is being loaded.
export default function TabPanelSkeleton() {
  return (
    <div
      className="space-y-4"
      aria-busy="true"
      aria-label="Loading course data"
    >
      <div className="skeleton h-6 w-40" />
      <div className="skeleton h-8 w-full" />
      <div className="skeleton h-8 w-3/4" />
      <div className="skeleton h-10 w-52" />
    </div>
  );
}
