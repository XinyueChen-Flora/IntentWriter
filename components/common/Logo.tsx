import Link from "next/link";

type LogoIconProps = {
  size?: number;
  className?: string;
};

export function LogoIcon({ size = 28, className }: LogoIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={`text-primary ${className || ""}`}
    >
      {/* Top serif of the "I" */}
      <rect x="4" y="1" width="16" height="3" rx="1.5" fill="currentColor" />
      {/* Vertical stroke */}
      <rect x="9" y="4" width="6" height="11" fill="currentColor" />
      {/* Pen nib tip (replaces bottom serif) */}
      <path d="M9 15 L12 23 L15 15 Z" fill="currentColor" />
      {/* Nib slit detail */}
      <line
        x1="12"
        y1="16"
        x2="12"
        y2="21"
        stroke="white"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

type LogoProps = {
  size?: number;
  showText?: boolean;
  className?: string;
  textClassName?: string;
};

export function Logo({
  size = 28,
  showText = true,
  className,
  textClassName,
}: LogoProps) {
  return (
    <div className={`flex items-center gap-2 ${className || ""}`}>
      <LogoIcon size={size} />
      {showText && (
        <span className={`text-primary font-bold tracking-tight ${textClassName || "text-xl"}`} style={{ fontFamily: 'var(--font-brand)' }}>
          GroundingKit
        </span>
      )}
    </div>
  );
}

type LogoLinkProps = LogoProps & {
  href?: string;
};

export function LogoLink({
  href = "/dashboard",
  size = 28,
  showText = true,
  className,
  textClassName,
}: LogoLinkProps) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-2 hover:opacity-80 transition-opacity ${className || ""}`}
    >
      <LogoIcon size={size} />
      {showText && (
        <span className={`text-primary font-bold tracking-tight ${textClassName || "text-xl"}`} style={{ fontFamily: 'var(--font-brand)' }}>
          GroundingKit
        </span>
      )}
    </Link>
  );
}
