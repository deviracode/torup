"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Users } from "lucide-react";
import { useBusiness } from "@/components/auth/business-provider";
import { useApi } from "@/lib/use-api";
import {
  StaffCard,
  type StaffMember,
} from "@/components/dashboard/staff-card";
import { StaffMemberDialog } from "./staff-member-dialog";
import {
  StaggerGroup,
  StaggerItem,
  Skeleton,
  EmptyState,
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@torup/ui";

interface ServiceItem {
  id: string;
  name_he: string;
}

export default function StaffTab() {
  const t = useTranslations("dashboard");
  const tCommon = useTranslations("common");
  const { businessId } = useBusiness();
  const api = useApi();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    const [r, svcResult] = await Promise.all([
      api<StaffMember[]>(`/api/businesses/${businessId}/staff`),
      api<ServiceItem[] | { categories: unknown[]; services: ServiceItem[] }>(
        `/api/businesses/${businessId}/services`
      ),
    ]);
    setStaff(Array.isArray(r) ? r : []);
    const svcList = Array.isArray(svcResult)
      ? svcResult
      : (svcResult as { services: ServiceItem[] })?.services;
    setServices(svcList || []);
    setLoading(false);
  }, [businessId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openAdd = () => {
    setEditingStaff(null);
    setDialogOpen(true);
  };

  const openEdit = (member: StaffMember) => {
    setEditingStaff(member);
    setDialogOpen(true);
  };

  const removeStaff = async (memberId: string) => {
    await api(`/api/businesses/${businessId}/staff/${memberId}`, {
      method: "DELETE",
    });
    setDeleteTarget(null);
    fetchData();
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {staff.length > 0 ? (
        <StaggerGroup className="space-y-2">
          {staff.map((m) => (
            <StaggerItem key={m.id}>
              <StaffCard
                member={m}
                services={services}
                businessId={businessId!}
                onUpdate={(updated) =>
                  setStaff((prev) =>
                    prev.map((s) => (s.id === updated.id ? updated : s))
                  )
                }
                onRemove={(id) => setDeleteTarget(id)}
                onEdit={openEdit}
              />
            </StaggerItem>
          ))}
        </StaggerGroup>
      ) : (
        <EmptyState
          icon={Users}
          title={t("staffEmptyTitle")}
          description={t("staffEmptyDesc")}
          action={
            <Button onClick={openAdd}>
              {t("addStaff")}
            </Button>
          }
        />
      )}

      {staff.length > 0 && (
        <Button onClick={openAdd}>{t("addStaff")}</Button>
      )}

      <StaffMemberDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        staff={editingStaff}
        businessId={businessId!}
        api={api}
        onSaved={fetchData}
      />

      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("staffDeleteTitle")}</DialogTitle>
            <DialogDescription>
              {t("staffDeleteConfirm")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              {tCommon("cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteTarget && removeStaff(deleteTarget)}
            >
              {tCommon("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
