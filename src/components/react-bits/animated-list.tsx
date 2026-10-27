"use client";

// Adapted from React Bits Pro Animated List: controlled, permanent transcript entries.
import type { ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

export interface AnimatedListItem {
  id: string | number;
  content: ReactNode;
}

export interface AnimatedListProps {
  items: AnimatedListItem[];
  duration?: number;
  className?: string;
  renderItem?: (item: AnimatedListItem) => ReactNode;
  itemGap?: number;
  height?: string | number;
  autoAddDelay?: 0;
  swipeToDismiss?: false;
  fadeEdges?: false;
  startFrom?: "top";
  animationType?: "slide" | "fade";
  enterFrom?: "bottom" | "top";
}

export default function AnimatedList({
  items, duration = 0.24, className, renderItem,
  itemGap = 16, height = "auto",
}: AnimatedListProps) {
  const reduced = useReducedMotion();
  return (
    <ul className={cn("flex flex-col", className)} style={{ gap: itemGap, height }}>
      <AnimatePresence initial={false}>
        {items.map((item) => (
          <motion.li key={item.id}
            initial={reduced ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduced ? 0 : duration }}>
            {renderItem ? renderItem(item) : item.content}
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  );
}
