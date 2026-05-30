import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import type { SavedStudyPlan, StudyReminderSettings } from "@/types";

const REMINDER_CHANNEL_ID = "studynova-study-reminders";

export type ReminderScheduleResult = {
  scheduled: boolean;
  message: string;
  scheduledCount: number;
};

export type NotificationReadiness = {
  canAskAgain: boolean;
  channelReady: boolean;
  granted: boolean;
  permissionStatus: string;
  platform: typeof Platform.OS;
  scheduledCount: number;
  scheduledStudyReminderCount: number;
};

export async function scheduleStudyReminders(
  savedPlan: SavedStudyPlan,
  settings: StudyReminderSettings
): Promise<ReminderScheduleResult> {
  if (!settings.reminders_enabled) {
    await cancelStudyReminders(savedPlan.id);
    return { scheduled: false, message: "Study reminders are turned off for this plan.", scheduledCount: 0 };
  }

  if (Platform.OS === "web") {
    return {
      scheduled: false,
      message: "Phone reminders are available in Expo Go on your mobile device.",
      scheduledCount: 0
    };
  }

  const hasPermission = await ensureNotificationPermission();
  if (!hasPermission) {
    return {
      scheduled: false,
      message: "Allow notifications on this phone to receive study reminders.",
      scheduledCount: 0
    };
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

  const readiness = await getStudyReminderReadiness(savedPlan.id);
  return {
    scheduled: true,
    scheduledCount: readiness.scheduledStudyReminderCount,
    message: `${readiness.scheduledStudyReminderCount} phone reminder${
      readiness.scheduledStudyReminderCount === 1 ? "" : "s"
    } set from ${formatReminderTime(settings.reminder_time)}.`
  };
}

export async function cancelStudyReminders(planId: string) {
  const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduledNotifications
      .filter((notification) => notification.content.data?.planId === planId)
      .map((notification) => Notifications.cancelScheduledNotificationAsync(notification.identifier))
  );
}

export async function getStudyReminderReadiness(planId?: string): Promise<NotificationReadiness> {
  if (Platform.OS === "web") {
    return {
      canAskAgain: false,
      channelReady: false,
      granted: false,
      permissionStatus: "web",
      platform: Platform.OS,
      scheduledCount: 0,
      scheduledStudyReminderCount: 0
    };
  }

  const permission = await Notifications.getPermissionsAsync();
  await ensureReminderChannel();
  const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();

  return {
    canAskAgain: permission.canAskAgain,
    channelReady: true,
    granted: permission.granted || permission.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL,
    permissionStatus: permission.status,
    platform: Platform.OS,
    scheduledCount: scheduledNotifications.length,
    scheduledStudyReminderCount: scheduledNotifications.filter((notification) =>
      isStudyNovaPlanNotification(notification.content.data, planId)
    ).length
  };
}

export async function sendTestStudyNotification(planId?: string): Promise<ReminderScheduleResult> {
  if (Platform.OS === "web") {
    return {
      scheduled: false,
      scheduledCount: 0,
      message: "Test notifications need a mobile device."
    };
  }

  const hasPermission = await ensureNotificationPermission();
  if (!hasPermission) {
    return {
      scheduled: false,
      scheduledCount: 0,
      message: "Allow notifications on this phone, then try the test again."
    };
  }

  await ensureReminderChannel();
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "StudyNova reminder test",
      body: "Notifications are ready. Your study reminders can now appear on this phone.",
      data: { planId, type: "notification-test" }
    },
    trigger: null
  });

  const readiness = await getStudyReminderReadiness(planId);
  return {
    scheduled: true,
    scheduledCount: readiness.scheduledStudyReminderCount,
    message: "Test notification sent. If you do not see it, check Android notification permission for StudyNova."
  };
}

async function ensureNotificationPermission() {
  await ensureReminderChannel();

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
    description: "Daily study reminders, missed-session nudges, and notification tests.",
    importance: Notifications.AndroidImportance.DEFAULT,
    name: "Study reminders",
    vibrationPattern: [0, 250, 250, 250]
  });
}

function isStudyNovaPlanNotification(data: Record<string, unknown> | undefined, planId?: string) {
  if (!data) {
    return false;
  }

  const type = typeof data.type === "string" ? data.type : "";
  const notificationPlanId = typeof data.planId === "string" ? data.planId : "";
  const isStudyNovaReminder = ["daily-study-reminder", "missed-session-reminder", "notification-test"].includes(type);
  return isStudyNovaReminder && (!planId || notificationPlanId === planId);
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
