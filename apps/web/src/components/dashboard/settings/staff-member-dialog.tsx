"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@torup/ui";
import { Button } from "@torup/ui";
import { Input } from "@torup/ui";
import { Field } from "@torup/ui";
import type { StaffMember } from "@/components/dashboard/staff-card";

type FormValues = z.infer<ReturnType<typeof buildSchema>>;

function buildSchema(t: (key: string) => string) {
  return z.object({
    email: z
      .string()
      .min(1, { message: t("staffEmailRequired") })
      .email({ message: t("staffEmailInvalid") }),
    display_name: z.string().optional().or(z.literal("")),
  });
}

interface StaffMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staff?: StaffMember | null;
  businessId: string;
  api: <T>(path: string, options?: RequestInit) => Promise<T | null>;
  onSaved: () => void;
}

export function StaffMemberDialog({
  open,
  onOpenChange,
  staff,
  businessId,
  api,
  onSaved,
}: StaffMemberDialogProps) {
  const t = useTranslations("dashboard");
  const tCommon = useTranslations("common");
  const isEdit = !!staff;
  const schema = buildSchema(t);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", display_name: "" },
  });

  useEffect(() => {
    if (open) {
      reset({
        email: staff?.user?.email ?? "",
        display_name: staff?.display_name ?? "",
      });
    }
  }, [open, staff, reset]);

  const onSubmit = async (values: FormValues) => {
    let result;
    if (isEdit && staff) {
      result = await api(`/api/businesses/${businessId}/staff/${staff.id}`, {
        method: "PATCH",
        body: JSON.stringify({ display_name: values.display_name?.trim() || "" }),
      });
    } else {
      result = await api(`/api/businesses/${businessId}/staff`, {
        method: "POST",
        body: JSON.stringify({ email: values.email.trim(), role: "staff" }),
      });
    }
    if (result === null) return; // api already toasted the error; keep dialog open
    toast.success(t("saved"));
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t("staffEditTitle") : t("staffAddTitle")}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Field
            label={t("email")}
            htmlFor="staff-email"
            error={errors.email?.message}
            required
          >
            <Input
              id="staff-email"
              type="email"
              dir="ltr"
              readOnly={isEdit}
              {...register("email")}
            />
          </Field>
          <Field
            label={t("staffDisplayName")}
            htmlFor="staff-display-name"
            error={errors.display_name?.message}
          >
            <Input
              id="staff-display-name"
              dir="auto"
              {...register("display_name")}
            />
          </Field>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {tCommon("cancel")}
            </Button>
            <Button type="submit" loading={isSubmitting}>
              {isEdit ? tCommon("save") : t("addStaff")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
