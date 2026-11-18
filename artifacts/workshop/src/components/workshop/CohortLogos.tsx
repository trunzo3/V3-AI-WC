import { useLayoutEffect, useRef, useState } from "react";
import type { CohortSettings } from "@workspace/api-client-react";
import { Logo } from "@/components/logo";

export function CohortLogos({ settings, dark = false }: { settings?: CohortSettings; dark?: boolean }) {
  const logos = settings?.logos ?? [{ type: "builtin" }];
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const defaultLogo = logos.length === 1 && logos[0].type === "builtin";
  useLayoutEffect(() => {
    const resize = () => {
      if (outer.current && inner.current) {
        setScale(Math.min(1, outer.current.clientWidth / inner.current.scrollWidth));
      }
    };
    const observer = new ResizeObserver(resize);
    if (outer.current) observer.observe(outer.current);
    if (inner.current) observer.observe(inner.current);
    resize();
    return () => observer.disconnect();
  }, [logos]);
  if (defaultLogo) return <Logo variant={dark ? "white" : "default"} className={dark ? "scale-75 origin-left" : ""} />;
  return (
    <div ref={outer} className="w-full overflow-hidden" style={{ height: dark ? 44 : 40 }} data-testid="cohort-logos">
      <div ref={inner} className="inline-flex items-center gap-3 whitespace-nowrap origin-left" style={{ transform: `scale(${scale})`, height: dark ? 44 : 40 }}>
        {logos.map((logo, index) => (
          <div key={index} className="flex items-center gap-3 shrink-0">
            {index > 0 && <span className={`h-6 border-l ${dark ? "border-white/30" : "border-border"}`} />}
            {logo.type === "builtin" ? <Logo variant={dark ? "white" : "default"} /> :
              <span className={dark ? "bg-white rounded-md px-2 py-1" : ""}>
                <img src={`${import.meta.env.BASE_URL}api/cohort-logos/${logo.fileId}`} alt={logo.name || "Cohort logo"} className="h-9 w-auto max-w-none object-contain" onLoad={() => {
                  if (outer.current && inner.current) setScale(Math.min(1, outer.current.clientWidth / inner.current.scrollWidth));
                }} />
              </span>}
          </div>
        ))}
      </div>
    </div>
  );
}
