/**
 * Optimized Image Component
 * Industry-standard image loading with lazy loading, blur placeholder, and responsive images
 * 
 * Features:
 * - Lazy loading with Intersection Observer
 * - Blur-up placeholder effect
 * - Responsive images with srcset
 * - WebP/AVIF format detection
 * - Error handling with fallback
 * - Skeleton loading state
 */

import React, { useState, useEffect, useRef, useCallback, ImgHTMLAttributes } from 'react';

// ============================================================================
// Types
// ============================================================================

interface ImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'srcSet'> {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  priority?: boolean;
  placeholder?: 'blur' | 'empty' | 'skeleton';
  blurDataURL?: string;
  fallbackSrc?: string;
  sizes?: string;
  quality?: number;
  onLoadingComplete?: (result: { naturalWidth: number; naturalHeight: number }) => void;
}

interface UseImageReturn {
  isLoaded: boolean;
  isError: boolean;
  imageSrc: string;
}

// ============================================================================
// Browser Format Support Detection
// ============================================================================

const formatSupport = {
  avif: null as boolean | null,
  webp: null as boolean | null,
};

async function checkFormatSupport(format: 'avif' | 'webp'): Promise<boolean> {
  if (formatSupport[format] !== null) {
    return formatSupport[format]!;
  }

  const testImages: Record<string, string> = {
    avif: 'data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAADnBpdG0AAAAAAAEAAAAeaWxvYwAAAABEAAABAAEAAAABAAABGgAAAB0AAAAoaWluZgAAAAAAAQAAABppbmZlAgAAAAABAABhdjAxQ29sb3IAAAAAamlwcnAAAABLaXBjbwAAABRpc3BlAAAAAAAAAAIAAAACAAAAEHBpeGkAAAAAAwgICAAAAAxhdjFDgQ0MAAAAABNjb2xybmNseAACAAIAAYAAAAAXaXBtYQAAAAAAAAABAAEEAQKDBAAAACVtZGF0EgAKBzgABpAQ0AIQ0A',
    webp: 'data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==',
  };

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      formatSupport[format] = img.width > 0 && img.height > 0;
      resolve(formatSupport[format]!);
    };
    img.onerror = () => {
      formatSupport[format] = false;
      resolve(false);
    };
    img.src = testImages[format];
  });
}

// ============================================================================
// useIntersectionObserver Hook
// ============================================================================

function useIntersectionObserver(
  elementRef: React.RefObject<Element>,
  options: IntersectionObserverInit = {}
): boolean {
  const [isIntersecting, setIsIntersecting] = useState(false);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIsIntersecting(true);
        observer.unobserve(element);
      }
    }, {
      rootMargin: '50px',
      threshold: 0,
      ...options,
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, [elementRef, options]);

  return isIntersecting;
}

// ============================================================================
// useImage Hook
// ============================================================================

function useImage(src: string, fallbackSrc?: string): UseImageReturn {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isError, setIsError] = useState(false);
  const [imageSrc, setImageSrc] = useState(src);

  useEffect(() => {
    queueMicrotask(() => {
      setIsLoaded(false);
      setIsError(false);
      setImageSrc(src);
    });

    const img = new Image();
    img.src = src;

    img.onload = () => {
      setIsLoaded(true);
    };

    img.onerror = () => {
      if (fallbackSrc) {
        setImageSrc(fallbackSrc);
      } else {
        setIsError(true);
      }
    };

    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [src, fallbackSrc]);

  return { isLoaded, isError, imageSrc };
}

// ============================================================================
// Generate srcSet
// ============================================================================

function generateSrcSet(
  src: string,
  widths: number[] = [640, 750, 828, 1080, 1200, 1920, 2048, 3840]
): string {
  // Skip srcset generation for data URLs or external images
  if (src.startsWith('data:') || src.startsWith('http')) {
    return '';
  }

  return widths
    .map((w) => {
      // This assumes an image optimization service is in place
      // In production, replace with actual image CDN URL
      const optimizedUrl = src.includes('?')
        ? `${src}&w=${w}`
        : `${src}?w=${w}`;
      return `${optimizedUrl} ${w}w`;
    })
    .join(', ');
}

// ============================================================================
// OptimizedImage Component
// ============================================================================

export function OptimizedImage({
  src,
  alt,
  width,
  height,
  priority = false,
  placeholder = 'empty',
  blurDataURL,
  fallbackSrc = '/images/placeholder.png',
  sizes = '100vw',
  quality = 75,
  className = '',
  onLoadingComplete,
  style,
  ...props
}: ImageProps): JSX.Element {
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isVisible = useIntersectionObserver(containerRef);
  const shouldLoad = priority || isVisible;
  const { isLoaded, isError, imageSrc } = useImage(
    shouldLoad ? src : '',
    fallbackSrc
  );

  const handleLoad = useCallback(() => {
    if (imgRef.current && onLoadingComplete) {
      onLoadingComplete({
        naturalWidth: imgRef.current.naturalWidth,
        naturalHeight: imgRef.current.naturalHeight,
      });
    }
  }, [onLoadingComplete]);

  // Aspect ratio for preventing layout shift
  const aspectRatio = width && height ? width / height : undefined;

  // Container styles
  const containerStyle: React.CSSProperties = {
    position: 'relative',
    overflow: 'hidden',
    ...(aspectRatio && {
      aspectRatio: `${aspectRatio}`,
    }),
    ...style,
  };

  // Image styles
  const imageStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    opacity: isLoaded ? 1 : 0,
    transition: 'opacity 0.3s ease-in-out',
  };

  // Placeholder styles
  const placeholderStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    opacity: isLoaded ? 0 : 1,
    transition: 'opacity 0.3s ease-in-out',
  };

  return (
    <div ref={containerRef} style={containerStyle} className={className}>
      {/* Placeholder */}
      {placeholder === 'blur' && blurDataURL && (
        <img
          src={blurDataURL}
          alt=""
          aria-hidden="true"
          style={{
            ...placeholderStyle,
            filter: 'blur(20px)',
            transform: 'scale(1.1)',
          }}
        />
      )}
      
      {placeholder === 'skeleton' && !isLoaded && (
        <div
          style={placeholderStyle}
          className="animate-pulse bg-slate-200 dark:bg-slate-700"
        />
      )}

      {/* Actual Image */}
      {shouldLoad && !isError && (
        <img
          ref={imgRef}
          src={imageSrc}
          alt={alt}
          width={width}
          height={height}
          sizes={sizes}
          srcSet={generateSrcSet(src)}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          fetchPriority={priority ? 'high' : 'auto'}
          onLoad={handleLoad}
          style={imageStyle}
          {...props}
        />
      )}

      {/* Error State */}
      {isError && (
        <div
          className="flex items-center justify-center bg-[#131b2e] text-[#869ab8]"
          style={{ width: '100%', height: '100%' }}
        >
          <svg
            className="w-12 h-12"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Picture Component for Modern Format Support
// ============================================================================

interface PictureProps extends ImageProps {
  avifSrc?: string;
  webpSrc?: string;
}

export function Picture({
  src,
  avifSrc,
  webpSrc,
  alt,
  ...props
}: PictureProps): JSX.Element {
  const [supportsAvif, setSupportsAvif] = useState<boolean | null>(null);
  const [supportsWebp, setSupportsWebp] = useState<boolean | null>(null);

  useEffect(() => {
    checkFormatSupport('avif').then(setSupportsAvif);
    checkFormatSupport('webp').then(setSupportsWebp);
  }, []);

  // Determine best source
  let bestSrc = src;
  if (supportsAvif && avifSrc) {
    bestSrc = avifSrc;
  } else if (supportsWebp && webpSrc) {
    bestSrc = webpSrc;
  }

  return <OptimizedImage src={bestSrc} alt={alt} {...props} />;
}

// ============================================================================
// Background Image Component
// ============================================================================

interface BackgroundImageProps {
  src: string;
  alt?: string;
  children?: React.ReactNode;
  className?: string;
  overlay?: boolean;
  overlayOpacity?: number;
}

export function BackgroundImage({
  src,
  alt = '',
  children,
  className = '',
  overlay = false,
  overlayOpacity = 0.5,
}: BackgroundImageProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const isVisible = useIntersectionObserver(containerRef);
  const { isLoaded, imageSrc } = useImage(isVisible ? src : '');

  return (
    <div
      ref={containerRef}
      className={`relative ${className}`}
      style={{
        backgroundImage: isLoaded ? `url(${imageSrc})` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
      role="img"
      aria-label={alt}
    >
      {/* Loading skeleton */}
      {!isLoaded && (
        <div className="absolute inset-0 animate-pulse bg-slate-200 dark:bg-slate-700" />
      )}
      
      {/* Overlay */}
      {overlay && (
        <div
          className="absolute inset-0 bg-white dark:bg-black"
          style={{ opacity: overlayOpacity }}
        />
      )}
      
      {/* Content */}
      <div className="relative z-10">{children}</div>
    </div>
  );
}

// ============================================================================
// Preload Image Utility
// ============================================================================

export function preloadImage(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = src;
  });
}

export function preloadImages(srcs: string[]): Promise<void[]> {
  return Promise.all(srcs.map(preloadImage));
}

// ============================================================================
// Blur Data URL Generator (for dev/build time)
// ============================================================================

export function generateBlurPlaceholder(
  width: number = 8,
  height: number = 8,
  color: string = '#e2e8f0'
): string {
  // Create a simple SVG placeholder
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">
      <rect width="${width}" height="${height}" fill="${color}"/>
    </svg>
  `;
  
  return `data:image/svg+xml;base64,${btoa(svg.trim())}`;
}

// ============================================================================
// Export
// ============================================================================

export { useImage, useIntersectionObserver };
