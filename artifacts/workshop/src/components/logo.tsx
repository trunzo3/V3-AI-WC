export function Logo({
  className = "",
  variant = "default",
}: {
  className?: string;
  variant?: "default" | "white";
}) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div
        className={`h-9 w-9 rounded-sm flex-shrink-0 grid place-items-center font-serif font-bold text-sm ${
          variant === "white"
            ? "bg-white/10 text-white border border-white/30"
            : "bg-primary/10 text-primary border border-primary/20"
        }`}
        aria-hidden
      >
        IQ
      </div>
      <span
        className={`font-serif font-bold text-xl tracking-tight ${
          variant === "white" ? "text-white" : "text-primary"
        }`}
      >
        IQ<span className={variant === "white" ? "text-[#C8963E]" : "text-accent"}>meet</span>EQ
      </span>
    </div>
  );
}
