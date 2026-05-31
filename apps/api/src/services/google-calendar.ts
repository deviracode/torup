import { google } from "googleapis";
import { createServiceClient } from "../lib/supabase.js";

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

export function getAuthUrl(businessId: string): string {
  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [
      "https://www.googleapis.com/auth/calendar.events",
      "https://www.googleapis.com/auth/calendar.readonly",
    ],
    state: businessId,
  });
}

export async function exchangeCode(code: string) {
  const { tokens } = await oauth2Client.getToken(code);
  if (!tokens.access_token || !tokens.refresh_token) {
    throw new Error("Missing tokens from Google");
  }
  return {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: new Date(tokens.expiry_date!),
  };
}

async function getAuthClient(businessId: string) {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("google_calendar_tokens")
    .select("*")
    .eq("business_id", businessId)
    .single();

  if (!data) throw new Error("No Google Calendar connection");

  oauth2Client.setCredentials({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
  });

  // Refresh if expiring within 5 minutes
  if (new Date(data.token_expires_at).getTime() - Date.now() < 5 * 60 * 1000) {
    const { credentials } = await oauth2Client.refreshAccessToken();
    await supabase
      .from("google_calendar_tokens")
      .update({
        access_token: credentials.access_token,
        token_expires_at: new Date(credentials.expiry_date!).toISOString(),
      })
      .eq("business_id", businessId);
  }

  return oauth2Client;
}

export async function listCalendars(businessId: string) {
  const auth = await getAuthClient(businessId);
  const calendar = google.calendar({ version: "v3", auth });
  const res = await calendar.calendarList.list();
  return (res.data.items || []).map((c) => ({
    id: c.id!,
    summary: c.summary || c.id!,
    primary: c.primary || false,
  }));
}

export async function syncGoogleCalendar(businessId: string): Promise<{ imported: number; deleted: number; error?: string }> {
  const supabase = createServiceClient();

  const { data: config } = await supabase
    .from("google_calendar_tokens")
    .select("*")
    .eq("business_id", businessId)
    .eq("sync_enabled", true)
    .single();

  if (!config || !config.google_calendar_id) return { imported: 0, deleted: 0 };

  try {
    const auth = await getAuthClient(businessId);
    const calendar = google.calendar({ version: "v3", auth });

    const now = new Date();
    // Start of today (Israel time = UTC-3h) so events earlier today are included
    const startOfToday = new Date(now);
    startOfToday.setUTCHours(startOfToday.getUTCHours() - 3);
    startOfToday.setUTCHours(0, 0, 0, 0);
    const sixtyDaysLater = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);

    const res = await calendar.events.list({
      calendarId: config.google_calendar_id,
      timeMin: startOfToday.toISOString(),
      timeMax: sixtyDaysLater.toISOString(),
      singleEvents: true,
      orderBy: "startTime",
    });

    const events = res.data.items || [];
    let imported = 0;

    for (const event of events) {
      if (!event.id || !event.start?.dateTime || !event.end?.dateTime) {
        console.log(`[gcal/sync] skipping event id=${event.id} summary="${event.summary}" (all-day or missing times)`);
        continue;
      }
      const { error: upsertErr } = await supabase.from("google_calendar_events").upsert({
        business_id: businessId,
        google_event_id: event.id,
        summary: event.summary || "",
        start_time: event.start.dateTime,
        end_time: event.end.dateTime,
      }, { onConflict: "business_id,google_event_id" });
      if (upsertErr) {
        console.error(`[gcal/sync] upsert failed for event ${event.id}:`, upsertErr.message);
      } else {
        imported++;
      }
    }
    console.log(`[gcal/sync] businessId=${businessId} fetched=${events.length} imported=${imported}`);

    // Delete events no longer in Google (cancelled externally)
    const googleEventIds = events.map((e) => e.id!).filter(Boolean);
    console.log(`[gcal/sync] keeping ${googleEventIds.length} event IDs:`, googleEventIds);
    let deleted = 0;
    if (googleEventIds.length > 0) {
      const { error: delErr, count } = await supabase
        .from("google_calendar_events")
        .delete({ count: "exact" })
        .eq("business_id", businessId)
        .not("google_event_id", "in", `(${googleEventIds.join(",")})`);
      console.log(`[gcal/sync] delete result: count=${count} error=${delErr?.message}`);
      if (!delErr) deleted = count ?? 0;
    }

    return { imported, deleted };
  } catch (err) {
    return { imported: 0, deleted: 0, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function pushAppointmentToGoogle(appointmentId: string) {
  const supabase = createServiceClient();

  const { data: apt } = await supabase
    .from("appointments")
    .select("id, business_id, start_time, end_time, status, services(name_he), customers(name)")
    .eq("id", appointmentId)
    .single();

  if (!apt) return;

  const { data: config } = await supabase
    .from("google_calendar_tokens")
    .select("*")
    .eq("business_id", apt.business_id)
    .eq("push_enabled", true)
    .single();

  if (!config || !config.google_calendar_id) return;

  try {
    const auth = await getAuthClient(apt.business_id);
    const calendar = google.calendar({ version: "v3", auth });

    const appointment = apt as unknown as {
      id: string; business_id: string; start_time: string; end_time: string; status: string;
      services: { name_he: string }; customers: { name: string };
    };

    // Delete from Google if cancelled
    if (appointment.status === "cancelled" || appointment.status === "no_show") {
      const { data: apptWithGCal } = await supabase
        .from("appointments")
        .select("google_event_id")
        .eq("id", appointmentId)
        .single();

      if (apptWithGCal?.google_event_id) {
        await calendar.events.delete({
          calendarId: config.google_calendar_id,
          eventId: apptWithGCal.google_event_id,
        });
      }
      return;
    }

    const event = {
      summary: `${appointment.services.name_he} - ${appointment.customers.name}`,
      start: { dateTime: appointment.start_time },
      end: { dateTime: appointment.end_time },
    };

    // Check if we already have a google_event_id (update) or need to create
    const { data: existing } = await supabase
      .from("appointments")
      .select("google_event_id")
      .eq("id", appointmentId)
      .single();

    if (existing?.google_event_id) {
      await calendar.events.update({
        calendarId: config.google_calendar_id,
        eventId: existing.google_event_id,
        requestBody: event,
      });
    } else {
      const created = await calendar.events.insert({
        calendarId: config.google_calendar_id,
        requestBody: event,
      });
      if (created.data.id) {
        await supabase
          .from("appointments")
          .update({ google_event_id: created.data.id })
          .eq("id", appointmentId);
      }
    }
  } catch (err) {
    console.error("Failed to push appointment to Google Calendar:", err);
  }
}

export async function syncAllGoogleCalendars(): Promise<{ businesses: number; imported: number; deleted: number }> {
  const supabase = createServiceClient();
  const { data: tokens } = await supabase
    .from("google_calendar_tokens")
    .select("business_id")
    .eq("sync_enabled", true);

  const businesses = tokens?.map((t) => t.business_id) || [];
  let totalImported = 0;
  let totalDeleted = 0;

  for (const businessId of businesses) {
    const result = await syncGoogleCalendar(businessId);
    totalImported += result.imported;
    totalDeleted += result.deleted;
    if (result.error) {
      console.error(`[gcal/sync] ${businessId}: ${result.error}`);
    }
  }

  console.log(`[gcal/sync] businesses=${businesses.length} imported=${totalImported} deleted=${totalDeleted}`);
  return { businesses: businesses.length, imported: totalImported, deleted: totalDeleted };
}

let gcalSyncInterval: ReturnType<typeof setInterval> | null = null;

export function startGCalSyncScheduler() {
  if (gcalSyncInterval) return;
  gcalSyncInterval = setInterval(() => {
    syncAllGoogleCalendars().catch((err) =>
      console.error("Google Calendar sync failed:", err)
    );
  }, 15 * 60 * 1000);

  console.log("Google Calendar sync scheduler started (every 15 minutes)");
}

export function stopGCalSyncScheduler() {
  if (gcalSyncInterval) {
    clearInterval(gcalSyncInterval);
    gcalSyncInterval = null;
  }
}
