import Link from "next/link";

type BrandMarkProps = {
  size?: "sm" | "md" | "lg";
  href?: string | null;
  className?: string;
};

const sizes = {
  sm: { mark: "h-7 w-7 text-xs rounded-md", text: "text-sm" },
  md: { mark: "h-9 w-9 text-lg rounded-lg", text: "text-xl" },
  lg: { mark: "h-14 w-14 text-2xl rounded-2xl", text: "text-4xl" },
};

export function BrandMark({ size = "md", href = "/", className = "" }: BrandMarkProps) {
  const s = sizes[size];
  const inner = (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <span
        className={`inline-flex items-center justify-center bg-gradient-to-br from-primary to-accent font-bold text-white shadow-sm shadow-primary/20 ${s.mark}`}
      >
        S
      </span>
      <span className={`font-display font-semibold tracking-tight text-foreground ${s.text}`}>
        Sedhii
      </span>
    </span>
  );

  if (href == null) return inner;
  return (
    <Link href={href} className="transition hover:opacity-90">
      {inner}
    </Link>
  );
}
