import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import type { SavedStudyPlan, StudyReminderSettings } from "@/types";

const REMINDER_CHANNEL_ID = "studynova-study-reminders";

export type ReminderScheduleResult = {
  scheduled: boolean;
  message: string;
};

export async function scheduleStudyReminders(
  savedPlan: SavedStudyPlan,
  settings: StudyReminderSettings
): Promise<ReminderScheduleResult> {
  if (!settings.reminders_enabled) {
    await cancelStudyReminders(savedPlan.id);
    return { scheduled: false, message: "Study reminders are turned off for this plan." };
  }

  if (Platform.OS === "web") {
    return { scheduled: false, message: "Phone reminders are available in Expo Go on your mobile device." };
  }

  const hasPermission = await ensureNotificationPermission();
  if (!hasPermission) {
    return { scheduled: false, message: "Allow notifications on this phone to receive study reminders." };
  }

  await ensureReminderChannel();
  await cancelStudyReminders(savedPlan.id);

  const [hour, minute] = parseReminderTime(settings.reminder_time);
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "StudyNova study time",
      body: reminderBody(savedPlan),
      data: { planId: savedPlan.id, type: "daily-study-reminder" }
    },
    trigger: { hour, minute, repeats: true, channelId: REMINDER_CHANNEL_ID } as any
  });

  if (settings.missed_session_alerts_enabled) {
    const [followUpHour, followUpMinute] = parseReminderTime(settings.missed_session_followup_time);
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "StudyNova catch-up check",
        body: "If any session slipped today, open StudyNova and rebalance your focus queue.",
        data: { planId: savedPlan.id, type: "missed-session-reminder" }
      },
      trigger: {
        hour: followUpHour,
        minute: followUpMinute,
        repeats: true,
        channelId: REMINDER_CHANNEL_ID
      } as any
    });
  }

  return { scheduled: true, message: `Reminders set for ${formatReminderTime(settings.reminder_time)}.` };
}

export async function cancelStudyReminders(planId: string) {
  const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduledNotifications
      .filter((notification) => notification.content.data?.planId === planId)
      .map((notification) => Notifications.cancelScheduledNotificationAsync(notification.identifier))
  );
}

async function ensureNotificationPermission() {
  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted || existing.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) {
    return true;
  }

  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted || requested.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
}

async function ensureReminderChannel() {
  if (Platform.OS !== "android") {
    return;
  }

  await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL_ID, {
    importance: Notifications.AndroidImportance.DEFAULT,
    name: "Study reminders"
  });
}

function reminderBody(savedPlan: SavedStudyPlan) {
  const firstUpcomingDay = savedPlan.plan.schedule.find((day) => day.sessions.length);
  const firstSession = firstUpcomingDay?.sessions[0];
  if (!firstSession) {
    return "Open your timetable for today's revision rhythm.";
  }

  return `${firstSession.subject}: ${firstSession.topic} is waiting in your study queue.`;
}

function parseReminderTime(value: string) {
  const [hourValue, minuteValue] = value.split(":").map(Number);
  return [Number.isFinite(hourValue) ? hourValue : 18, Number.isFinite(minuteValue) ? minuteValue : 0] as const;
}

function formatReminderTime(value: string) {
  const [hour, minute] = parseReminderTime(value);
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}
