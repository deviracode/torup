import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { motion } from "framer-motion";
import { cn } from "./utils.js";

/**
 * How the active indicator is detected:
 *
 * Radix computes `data-state` for `TabsTrigger` internally and applies it to
 * the DOM node AFTER spreading the consumer props (see @radix-ui/react-tabs:
 * `"data-state": isSelected ? "active" : "inactive"` is set on `Primitive.button`
 * after `...triggerProps`). That means `props["data-state"]` is never populated
 * in our wrapper at render time, so the naive `props["data-state"] === "active"`
 * check from the task brief never renders the indicator.
 *
 * Instead we mirror the active tab value: `Tabs` wraps `TabsPrimitive.Root` and
 * provides the current value through a context, kept in sync via `onValueChange`
 * (Radix fires it for every value change — click, Space/Enter, and roving-focus
 * activation with activationMode="automatic"). `TabsTrigger` derives
 * `isActive = contextValue === props.value` and renders the framer-motion
 * `motion.span` (layoutId="tabs-active-indicator") only inside the active
 * trigger; framer-motion's shared layout animation then slides the indicator
 * between triggers when the active tab changes.
 */
const TabsValueContext = React.createContext<string | undefined>(undefined);

export const Tabs = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Root>
>(({ value, defaultValue, onValueChange, ...props }, ref) => {
  const [uncontrolledValue, setUncontrolledValue] = React.useState(
    defaultValue ?? ""
  );
  const isControlled = value !== undefined;
  const activeValue = isControlled ? value : uncontrolledValue;

  return (
    <TabsValueContext.Provider value={activeValue}>
      <TabsPrimitive.Root
        ref={ref}
        value={value}
        defaultValue={defaultValue}
        onValueChange={(nextValue) => {
          if (!isControlled) setUncontrolledValue(nextValue);
          onValueChange?.(nextValue);
        }}
        {...props}
      />
    </TabsValueContext.Provider>
  );
});
Tabs.displayName = TabsPrimitive.Root.displayName;

export const TabsList = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "inline-flex h-10 items-center justify-start gap-1 rounded-lg bg-muted p-1 text-muted-foreground overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
      className
    )}
    {...props}
  />
));
TabsList.displayName = TabsPrimitive.List.displayName;

export const TabsTrigger = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, children, ...props }, ref) => {
  const activeValue = React.useContext(TabsValueContext);
  const isActive = activeValue === props.value;

  return (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:text-foreground",
        className
      )}
      {...props}
    >
      {isActive && (
        <motion.span
          layoutId="tabs-active-indicator"
          className="tabs-active-indicator absolute inset-0 rounded-md bg-background shadow-sm"
          transition={{ type: "spring", stiffness: 400, damping: 32 }}
        />
      )}
      <span className="relative z-10 inline-flex items-center gap-2">
        {children}
      </span>
    </TabsPrimitive.Trigger>
  );
});
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

export const TabsContent = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-4 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;
