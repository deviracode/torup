import * as React from "react";
import { motion, useReducedMotion, type HTMLMotionProps } from "framer-motion";
import { cn } from "./utils.js";

const EASE = [0.22, 1, 0.36, 1] as const;

export interface FadeInProps extends HTMLMotionProps<"div"> {
  delay?: number;
  y?: number;
}

export function FadeIn({ children, delay = 0, y = 8, className, ...props }: FadeInProps) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={{ opacity: 0, y: reduce ? 0 : y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay, ease: EASE }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export interface StaggerGroupProps extends HTMLMotionProps<"div"> {
  stagger?: number;
}

export function StaggerGroup({ children, stagger = 0.05, className, ...props }: StaggerGroupProps) {
  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: stagger } } }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className, ...props }: HTMLMotionProps<"div">) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: reduce ? 0 : 8 },
        show: { opacity: 1, y: 0, transition: { duration: 0.25, ease: EASE } },
      }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export interface PressableProps extends HTMLMotionProps<"button"> {}

export function Pressable({ children, className, ...props }: PressableProps) {
  return (
    <motion.button whileTap={{ scale: 0.98 }} transition={{ duration: 0.1 }} className={cn("cursor-pointer", className)} {...props}>
      {children}
    </motion.button>
  );
}
