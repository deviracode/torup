"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useBusiness } from "@/components/auth/business-provider";
import { useApi } from "@/lib/use-api";
import { toast } from "sonner";
import {
  FormSection,
  Field,
  Input,
  Textarea,
  Button,
  Skeleton,
} from "@torup/ui";

interface BusinessProfile {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  bot_context: string | null;
}

export default function ProfileTab() {
  const t = useTranslations("dashboard");
  const tCommon = useTranslations("common");
  const { businessId } = useBusiness();
  const api = useApi();
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!businessId) return;
    api<BusinessProfile>(`/api/businesses/${businessId}`).then((r) => {
      if (r) setProfile(r);
    });
  }, [businessId]);

  const saveProfile = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      await api(`/api/businesses/${businessId}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: profile.name,
          description: profile.description,
          phone: profile.phone,
          email: profile.email,
          address: profile.address,
          bot_context: profile.bot_context,
        }),
      });
      toast.success(t("saved"));
    } catch {
    } finally {
      setSaving(false);
    }
  };

  if (!profile) {
    return (
      <div className="space-y-6 max-w-md" data-testid="profile-skeleton">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-10 w-24" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-md">
      <FormSection title={t("profileIdentityTitle")}>
        <Field label={t("businessName")}>
          <Input
            value={profile.name}
            onChange={(e) => setProfile({ ...profile, name: e.target.value })}
          />
        </Field>
        <Field label={t("description")}>
          <Textarea
            value={profile.description || ""}
            onChange={(e) =>
              setProfile({ ...profile, description: e.target.value })
            }
            rows={3}
          />
        </Field>
      </FormSection>

      <FormSection title={t("profileContactTitle")}>
        <Field label={t("phone")}>
          <Input
            value={profile.phone || ""}
            onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
            dir="ltr"
          />
        </Field>
        <Field label={t("email")}>
          <Input
            type="email"
            value={profile.email || ""}
            onChange={(e) => setProfile({ ...profile, email: e.target.value })}
            dir="ltr"
          />
        </Field>
        <Field label={t("address")}>
          <Input
            value={profile.address || ""}
            onChange={(e) =>
              setProfile({ ...profile, address: e.target.value })
            }
          />
        </Field>
      </FormSection>

      <FormSection title={t("profileBotTitle")}>
        <Field label={t("botContext")} hint={t("botContextDesc")}>
          <Textarea
            value={profile.bot_context || ""}
            onChange={(e) =>
              setProfile({ ...profile, bot_context: e.target.value })
            }
            rows={5}
          />
        </Field>
      </FormSection>

      <Button onClick={saveProfile} loading={saving}>
        {tCommon("save")}
      </Button>
    </div>
  );
}
