export function LoaderCat({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <img src="/loader_cat.gif" alt="Loading…" className="h-24 w-24" />
    </div>
  );
}
