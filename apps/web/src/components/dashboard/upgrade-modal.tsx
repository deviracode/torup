"use client";

import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, Button } from "@torup/ui";

interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
  reason: "staff_limit" | "whatsapp_not_in_plan" | "ai_bot_not_in_plan" | "ai_token_limit" | "no_active_subscription";
}

const MODAL_CONTENT: Record<string, { title: string; description: string }> = {
  staff_limit: {
    title: "Staff Limit Reached",
    description: "You've reached your staff limit. Upgrade your plan to add more team members.",
  },
  whatsapp_not_in_plan: {
    title: "WhatsApp Bot Not Available",
    description: "WhatsApp bot is not included in your current plan. Upgrade to the WhatsApp plan or higher.",
  },
  ai_bot_not_in_plan: {
    title: "AI Bot Not Available",
    description: "The AI bot is available on the AI plan (200 ₪/month) or the Unlimited plan.",
  },
  ai_token_limit: {
    title: "AI Token Limit Reached",
    description: "You've used all your AI tokens for this month. Your limit will reset next month, or upgrade for more.",
  },
  no_active_subscription: {
    title: "No Active Subscription",
    description: "Please select a plan to continue using your dashboard.",
  },
};

export function UpgradeModal({ open, onClose, reason }: UpgradeModalProps) {
  const router = useRouter();
  const content = MODAL_CONTENT[reason];

  if (!content) return null;

  const handleViewPlans = () => {
    router.push("/dashboard/billing");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{content.title}</DialogTitle>
        </DialogHeader>
        <DialogDescription className="text-sm text-muted-foreground">
          {content.description}
        </DialogDescription>
        <DialogFooter className="flex gap-2 justify-end">
          <Button variant="ghost" onClick={onClose}>
            Maybe Later
          </Button>
          <Button onClick={handleViewPlans}>
            View Plans
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
