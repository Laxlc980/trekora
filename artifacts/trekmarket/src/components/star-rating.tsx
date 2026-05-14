import { Star } from "lucide-react";

type StarRatingProps = {
  value: number;
  onChange?: (value: number) => void;
  size?: "sm" | "md" | "lg";
  readonly?: boolean;
};

const SIZES = { sm: "w-4 h-4", md: "w-5 h-5", lg: "w-6 h-6" };

export function StarRating({ value, onChange, size = "md", readonly = false }: StarRatingProps) {
  const sizeClass = SIZES[size];

  return (
    <div className={`flex items-center gap-0.5 ${readonly ? "" : "cursor-pointer"}`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readonly}
          onClick={() => onChange?.(star)}
          className={`${readonly ? "cursor-default" : "hover:scale-110 transition-transform"} focus:outline-none`}
          aria-label={`${star} star${star > 1 ? "s" : ""}`}
        >
          <Star
            className={`${sizeClass} ${
              star <= value
                ? "fill-amber-400 text-amber-400"
                : "fill-none text-muted-foreground/40"
            }`}
          />
        </button>
      ))}
    </div>
  );
}

export function StarDisplay({ rating, count, size = "sm" }: { rating: number | null; count?: number; size?: "sm" | "md" }) {
  if (rating === null) return null;
  return (
    <div className="flex items-center gap-1.5">
      <StarRating value={Math.round(rating)} size={size} readonly />
      <span className="text-sm font-medium text-amber-600">{rating}</span>
      {count !== undefined && (
        <span className="text-xs text-muted-foreground">({count} review{count !== 1 ? "s" : ""})</span>
      )}
    </div>
  );
}
