import { useState, type ReactNode } from "react";
import { Avatar, Thumb } from "@/components/ui/Thumb";
import { useEntityAsset } from "@/hooks/useEntityAsset";
import { cn } from "@/lib/utils";

export type EntityImageShape = "circle" | "square" | "landscape";
export type EntityImageFit = "contain" | "cover";

export interface EntityImageProps {
  entityType: "company" | "speaker" | "event" | "topic";
  entitySlug: string;
  name: string;
  src: string | null;
  alt?: string;
  shape?: EntityImageShape;
  fit?: EntityImageFit;
  focalX?: number;
  focalY?: number;
  monochrome?: boolean;
  editorial?: boolean;
  eager?: boolean;
  className?: string;
  imageClassName?: string;
  fallback?: ReactNode;
}

/**
 * One presentation contract for approved entity assets. The image treatment is
 * deliberately reversible: color source masters remain untouched in Storage.
 */
export function EntityImage({
  entityType,
  entitySlug,
  name,
  src,
  alt,
  shape = entityType === "topic" ? "landscape" : "circle",
  fit = entityType === "company" ? "contain" : "cover",
  focalX = 0.5,
  focalY = entityType === "speaker" ? 0.38 : 0.5,
  monochrome = entityType === "speaker" || entityType === "topic",
  editorial = entityType === "event" || entityType === "topic",
  eager = false,
  className,
  imageClassName,
  fallback,
}: EntityImageProps) {
  const [failed, setFailed] = useState(false);
  const remoteAsset = useEntityAsset(entityType, entitySlug, !src);
  const resolvedSource = src || remoteAsset?.src || null;
  const visibleSource = resolvedSource && !failed ? resolvedSource : null;
  const resolvedFocalX = src ? focalX : remoteAsset?.focalX ?? focalX;
  const resolvedFocalY = src ? focalY : remoteAsset?.focalY ?? focalY;
  const initials = name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  const generatedFallback = shape === "landscape" ? (
    <Thumb seed={entitySlug} label={name.slice(0, 1)} className="size-full" glyphClassName="text-6xl" />
  ) : (
    <Avatar name={name} seed={entitySlug} className="size-full border-0 text-3xl" glyphClassName={entityType === "company" ? "font-sans font-bold" : undefined} />
  );

  return (
    <div
      className={cn(
        "entity-image relative isolate block shrink-0 overflow-hidden bg-paper-gray",
        shape === "circle" && "aspect-square rounded-full bg-white",
        shape === "circle" && (entityType === "company" ? "border border-ink/25" : "border border-ink/15"),
        shape === "square" && "aspect-square",
        shape === "landscape" && "aspect-video",
        entityType === "company" && visibleSource && "entity-image--company",
        editorial && visibleSource && "entity-image--editorial",
        className,
      )}
      data-entity-type={entityType}
    >
      {visibleSource ? (
        <img
          src={visibleSource}
          alt={alt ?? `${name} ${entityType === "company" ? "logo" : entityType === "speaker" ? "portrait" : "image"}`}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          onError={() => setFailed(true)}
          className={cn(
            "entity-image__media size-full",
            fit === "contain" ? "object-contain" : "object-cover",
            monochrome && "grayscale",
            imageClassName,
          )}
          style={{ objectPosition: `${Math.round(resolvedFocalX * 100)}% ${Math.round(resolvedFocalY * 100)}%` }}
        />
      ) : (
        <div className="block size-full" aria-label={`${name} image unavailable`}>
          {fallback ?? generatedFallback}
          <span className="sr-only">{initials}</span>
        </div>
      )}
    </div>
  );
}
