'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface AnimatedCardProps extends React.HTMLAttributes<HTMLDivElement> {
  isOpen: boolean;
  children: React.ReactNode;
  className?: string;
  align?: 'start' | 'center' | 'end';
  side?: 'top' | 'right' | 'bottom' | 'left';
  sideOffset?: number;
  alignOffset?: number;
  triggerRef?: React.RefObject<HTMLElement>;
  avoidCollisions?: boolean;
  collisionPadding?: number;
}

export function AnimatedCard({
  isOpen,
  children,
  className,
  align = 'center',
  side = 'bottom',
  sideOffset = 4,
  alignOffset = 0,
  triggerRef,
  avoidCollisions = true,
  collisionPadding = 8,
  ...props
}: AnimatedCardProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const cardRef = useRef<HTMLDivElement>(null);

  // Calculate position based on trigger element and viewport
  const updatePosition = useCallback(() => {
    if (!isOpen || !triggerRef?.current) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let top = 0;
    let left = 0;
    let actualSide = side;

    // Calculate initial position based on side
    switch (side) {
      case 'top':
        top = triggerRect.top - sideOffset;
        left = triggerRect.left + (triggerRect.width / 2);
        break;
      case 'right':
        top = triggerRect.top + (triggerRect.height / 2);
        left = triggerRect.right + sideOffset;
        break;
      case 'bottom':
        top = triggerRect.bottom + sideOffset;
        left = triggerRect.left + (triggerRect.width / 2);
        break;
      case 'left':
        top = triggerRect.top + (triggerRect.height / 2);
        left = triggerRect.left - sideOffset;
        break;
    }

    // Adjust for align
    if (['top', 'bottom'].includes(side)) {
      if (align === 'start') left = triggerRect.left + alignOffset;
      if (align === 'end') left = triggerRect.right - alignOffset;
    } else {
      if (align === 'start') top = triggerRect.top + alignOffset;
      if (align === 'end') top = triggerRect.bottom - alignOffset;
    }

    // Check viewport boundaries if avoidCollisions is true
    if (avoidCollisions && cardRef.current) {
      const cardRect = cardRef.current.getBoundingClientRect();
      
      // Check right edge
      if (left + cardRect.width > viewportWidth - collisionPadding) {
        left = viewportWidth - cardRect.width - collisionPadding;
      }
      
      // Check bottom edge
      if (top + cardRect.height > viewportHeight - collisionPadding) {
        top = viewportHeight - cardRect.height - collisionPadding;
        actualSide = 'top';
      }
      
      // Check left edge
      if (left < collisionPadding) {
        left = collisionPadding;
      }
      
      // Check top edge
      if (top < collisionPadding) {
        top = collisionPadding;
        actualSide = 'bottom';
      }
    }

    setPosition({ top, left });
  }, [isOpen, triggerRef, side, align, sideOffset, alignOffset, avoidCollisions, collisionPadding]);

  // Handle mount/unmount and animation states
  useEffect(() => {
    if (isOpen) {
      setIsMounted(true);
      const timer = setTimeout(() => {
        setIsAnimating(true);
        updatePosition();
      }, 10);
      return () => clearTimeout(timer);
    } else {
      setIsAnimating(false);
      const timer = setTimeout(() => {
        if (!isOpen) {
          setIsMounted(false);
        }
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [isOpen, updatePosition]);

  // Update position on scroll and resize
  useEffect(() => {
    if (!isOpen) return;

    updatePosition();
    
    const events = ['scroll', 'resize'];
    events.forEach(event => window.addEventListener(event, updatePosition));
    
    return () => {
      events.forEach(event => window.removeEventListener(event, updatePosition));
    };
  }, [isOpen, updatePosition]);

  if (!isMounted) return null;

  const transformOrigin = {
    top: 'origin-top',
    right: 'origin-right',
    bottom: 'origin-bottom',
    left: 'origin-left',
  }[side];

  const transformValue = {
    top: 'translateY(8px)',
    right: 'translateX(-8px)',
    bottom: 'translateY(-8px)',
    left: 'translateX(8px)',
  }[side];

  return (
    <div 
      ref={cardRef}
      className={cn(
        'fixed z-50',
        'transition-opacity duration-200',
        isAnimating ? 'opacity-100' : 'opacity-0',
        className
      )}
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
        transform: isAnimating ? 'none' : transformValue,
        transformOrigin,
        transition: 'opacity 200ms ease, transform 200ms ease',
      }}
      {...props}
    >
      <div 
        className={cn(
          'bg-card text-card-foreground rounded-lg border shadow-lg',
          'transform transition-all duration-200',
          isAnimating ? 'scale-100 opacity-100' : 'scale-95 opacity-0',
          'max-h-[var(--radix-popper-available-height)] overflow-auto'
        )}
      >
        {children}
      </div>
    </div>
  );
}

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

export function Card({ className, ...props }: CardProps) {
  return (
    <div 
      className={cn(
        'bg-card text-card-foreground rounded-lg border shadow-sm',
        className
      )}
      {...props}
    />
  );
}

export function CardHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex flex-col space-y-1.5 p-6', className)}
      {...props}
    />
  );
}

export function CardTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn(
        'text-2xl font-semibold leading-none tracking-tight',
        className
      )}
      {...props}
    />
  );
}

export function CardDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn('text-sm text-muted-foreground', className)}
      {...props}
    />
  );
}

export function CardContent({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-6 pt-0', className)} {...props} />;
}

export function CardFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex items-center p-6 pt-0', className)}
      {...props}
    />
  );
}
