"use client";

import { useState, useEffect, useCallback } from "react";
import { useApi } from "@/lib/use-api";
import { useBusiness } from "@/components/auth/business-provider";
import { toast } from "sonner";

interface WhatsAppStatus {
  connected: boolean;
  displayPhone: string | null;
  verifiedAt: string | null;
}

const META_MANAGER_URL = "https://business.facebook.com/wa/manage/";
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export default function WhatsAppSettings() {
  const api = useApi();
  const { businessId } = useBusiness();

  const [status, setStatus] = useState<WhatsAppStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);

  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [appSecret, setAppSecret] = useState("");
  const [verifyToken, setVerifyToken] = useState("");
  const [displayPhone, setDisplayPhone] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [showAppSecret, setShowAppSecret] = useState(false);
  const [saving, setSaving] = useState(false);

  const [testTo, setTestTo] = useState("");
  const [testing, setTesting] = useState(false);

  const fetchStatus = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    const res = await api<WhatsAppStatus>(`/api/businesses/${businessId}/whatsapp`);
    if (res) setStatus(res);
    setLoading(false);
  }, [businessId]);

  useEffect(() => {
    if (businessId) fetchStatus();
  }, [businessId, fetchStatus]);

  const save = async () => {
    if (!businessId || !phoneNumberId || !accessToken || !appSecret || !verifyToken) return;
    setSaving(true);
    const res = await api<WhatsAppStatus>(`/api/businesses/${businessId}/whatsapp`, {
      method: "PUT",
      body: JSON.stringify({
        phoneNumberId,
        accessToken,
        appSecret,
        verifyToken,
        displayPhone: displayPhone || undefined,
      }),
    });
    setSaving(false);
    if (res) {
      setAccessToken(""); // never retain the secrets
      setAppSecret("");
      setVerifyToken("");
      setShowToken(false);
      setShowAppSecret(false);
      setEditing(false);
      toast.success("מספר הוואטסאפ נשמר");
      fetchStatus();
    }
  };

  const webhookUrl = businessId ? `${API_URL}/api/webhooks/whatsapp/${businessId}` : "";

  const sendTest = async () => {
    if (!businessId || !testTo) return;
    setTesting(true);
    const res = await api<{ ok: boolean }>(`/api/businesses/${businessId}/whatsapp/test`, {
      method: "POST",
      body: JSON.stringify({ to: testTo }),
    });
    setTesting(false);
    if (res?.ok) {
      toast.success("הודעת בדיקה נשלחה — המספר מאומת ✓");
      fetchStatus();
    }
  };

  const pasteForm = (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        חבר את אפליקציית ה-Meta והמספר העסקי שלך כדי שההודעות יישלחו מהמספר שלך. את הפרטים תמצא ב-
        <a href={META_MANAGER_URL} target="_blank" rel="noreferrer" className="text-blue-600 underline">
          WhatsApp Manager של Meta
        </a>
        .
      </p>
      {webhookUrl && (
        <div className="rounded-md bg-gray-50 border border-gray-200 p-3">
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            כתובת ה-Webhook (הדבק ב-Meta App שלך)
          </label>
          <code className="block text-xs break-all select-all">{webhookUrl}</code>
        </div>
      )}
      <div>
        <label htmlFor="wa-phone-number-id" className="block text-sm font-medium mb-1">Phone Number ID</label>
        <input
          id="wa-phone-number-id"
          type="text"
          value={phoneNumberId}
          onChange={(e) => setPhoneNumberId(e.target.value)}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono"
          placeholder="123456789012345"
        />
      </div>
      <div>
        <label htmlFor="wa-access-token" className="block text-sm font-medium mb-1">Access Token</label>
        <div className="flex gap-2">
          <input
            id="wa-access-token"
            type={showToken ? "text" : "password"}
            value={accessToken}
            onChange={(e) => setAccessToken(e.target.value)}
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm font-mono"
            placeholder="EAAG..."
          />
          <button
            type="button"
            aria-label={showToken ? "הסתר טוקן" : "הצג טוקן"}
            onClick={() => setShowToken((v) => !v)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            {showToken ? "🙈" : "👁️"}
          </button>
        </div>
      </div>
      <div>
        <label htmlFor="wa-app-secret" className="block text-sm font-medium mb-1">App Secret</label>
        <div className="flex gap-2">
          <input
            id="wa-app-secret"
            type={showAppSecret ? "text" : "password"}
            value={appSecret}
            onChange={(e) => setAppSecret(e.target.value)}
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm font-mono"
            placeholder="מתוך הגדרות ה-Meta App"
          />
          <button
            type="button"
            aria-label={showAppSecret ? "הסתר" : "הצג"}
            onClick={() => setShowAppSecret((v) => !v)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            {showAppSecret ? "🙈" : "👁️"}
          </button>
        </div>
      </div>
      <div>
        <label htmlFor="wa-verify-token" className="block text-sm font-medium mb-1">Webhook Verify Token</label>
        <input
          id="wa-verify-token"
          type="text"
          value={verifyToken}
          onChange={(e) => setVerifyToken(e.target.value)}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono"
          placeholder="בחר מחרוזת סודית ושמור אותה זהה כאן וב-Meta"
        />
      </div>
      <div>
        <label htmlFor="wa-display-phone" className="block text-sm font-medium mb-1">מספר לתצוגה (אופציונלי)</label>
        <input
          id="wa-display-phone"
          type="text"
          value={displayPhone}
          onChange={(e) => setDisplayPhone(e.target.value)}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          placeholder="+972..."
        />
      </div>
      <button
        onClick={save}
        disabled={saving || !phoneNumberId || !accessToken || !appSecret || !verifyToken}
        className="rounded-md bg-green-600 px-4 py-2 text-sm text-white font-medium hover:bg-green-700 disabled:opacity-50"
      >
        {saving ? "שומר..." : "שמור"}
      </button>
    </div>
  );

  const testRow = (
    <div className="border-t border-gray-200 pt-4 space-y-2">
      <label htmlFor="wa-test-to" className="text-xs text-muted-foreground">שלח הודעת בדיקה לאימות החיבור:</label>
      <div className="flex gap-2">
        <input
          id="wa-test-to"
          type="text"
          value={testTo}
          onChange={(e) => setTestTo(e.target.value)}
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
          placeholder="972501234567"
        />
        <button
          onClick={sendTest}
          disabled={testing || !testTo}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {testing ? "שולח..." : "שלח בדיקה"}
        </button>
      </div>
    </div>
  );

  if (loading && !status) {
    return <div className="space-y-4 max-w-md text-sm text-muted-foreground">טוען...</div>;
  }

  return (
    <div className="space-y-4 max-w-md">
      {!status?.connected ? (
        pasteForm
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-800">
              {status.verifiedAt ? "מחובר ומאומת ✓" : "מחובר"}
            </span>
            {status.displayPhone && (
              <span className="text-sm text-muted-foreground">{status.displayPhone}</span>
            )}
          </div>

          {status.verifiedAt ? (
            <p className="text-xs text-muted-foreground">
              אומת לאחרונה: {new Date(status.verifiedAt).toLocaleString("he-IL")}
            </p>
          ) : (
            <p className="text-sm text-amber-700">עדיין לא אומת — שלח הודעת בדיקה כדי לוודא שהחיבור עובד.</p>
          )}

          {testRow}

          {editing ? (
            pasteForm
          ) : (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-sm text-blue-600 underline"
            >
              החלף פרטי התחברות
            </button>
          )}
        </div>
      )}
    </div>
  );
}
