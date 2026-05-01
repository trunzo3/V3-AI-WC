import brandMarkUrl from "../assets/brand-mark.png";

export function Logo({
  className = "",
  variant = "default",
}: {
  className?: string;
  variant?: "default" | "white";
}) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <img
        src={brandMarkUrl}
        alt=""
        aria-hidden
        className="h-9 w-9 rounded-sm flex-shrink-0 object-cover"
      />
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
