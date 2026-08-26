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
import { ImageUploadField } from "./image-upload-field";

interface BusinessProfile {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logo_url: string | null;
  cover_url: string | null;
  phone: string | null;
  contact_phone: string | null;
  email: string | null;
  address: string | null;
  bot_context: string | null;
  social_links: Record<string, string> | null;
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
          logo_url: profile.logo_url,
          cover_url: profile.cover_url,
          phone: profile.phone,
          contact_phone: profile.contact_phone,
          email: profile.email,
          address: profile.address,
          bot_context: profile.bot_context,
          social_links: profile.social_links,
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

      <FormSection title={t("profileBrandingTitle")}>
        <ImageUploadField
          label={t("logo")}
          hint={t("logoHint")}
          value={profile.logo_url}
          onChange={(url) => setProfile({ ...profile, logo_url: url })}
          businessId={businessId!}
          fileKey="logo"
          shape="circle"
          uploadLabel={t("uploadImage")}
          changeLabel={t("changeImage")}
          removeLabel={t("removeImage")}
        />
        <ImageUploadField
          label={t("bannerImage")}
          hint={t("bannerImageHint")}
          value={profile.cover_url}
          onChange={(url) => setProfile({ ...profile, cover_url: url })}
          businessId={businessId!}
          fileKey="banner"
          shape="wide"
          uploadLabel={t("uploadImage")}
          changeLabel={t("changeImage")}
          removeLabel={t("removeImage")}
        />
      </FormSection>

      <FormSection title={t("profileContactTitle")}>
        <Field label={t("phone")}>
          <Input
            value={profile.phone || ""}
            onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
            dir="ltr"
          />
        </Field>
        <Field label={t("contactPhone")} hint={t("contactPhoneDesc")}>
          <Input
            value={profile.contact_phone || ""}
            onChange={(e) =>
              setProfile({ ...profile, contact_phone: e.target.value })
            }
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
        <Field label={t("wazeLink")} hint={t("wazeLinkHint")}>
          <Input
            value={profile.social_links?.waze || ""}
            onChange={(e) =>
              setProfile({
                ...profile,
                social_links: { ...profile.social_links, waze: e.target.value },
              })
            }
            dir="ltr"
            placeholder="https://waze.com/ul/..."
          />
        </Field>
        <Field label={t("whatsappLink")} hint={t("whatsappLinkHint")}>
          <Input
            value={profile.social_links?.whatsapp || ""}
            onChange={(e) =>
              setProfile({
                ...profile,
                social_links: { ...profile.social_links, whatsapp: e.target.value },
              })
            }
            dir="ltr"
            placeholder="https://wa.me/972501234567"
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
