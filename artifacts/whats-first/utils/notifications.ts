// Expo push notification helpers — register, schedule, and cancel task reminders.
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { Task } from '@/types';
import { setItem, STORAGE_KEYS } from '@/utils/storage';

// Configure how incoming notifications are displayed while app is foregrounded.
//
// The default handler pings and shows a banner for everything. That's the
// right behavior for per-task reminders ("don't forget X is due today"), but
// the focus nag is a silent reminder — it should land in the tray quietly so
// the user isn't startled every 20 minutes.
//
// We disambiguate by inspecting the notification data: focus nag has
// `{ kind: 'focus_nag' }` and per-task reminders have `{ taskId }`. Both are
// stored by their producers — see scheduleTaskReminder and startFocusNag.
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const data = (notification.request.content.data ?? {}) as {
      kind?: string;
      taskId?: string;
    };
    const isFocusNag = data.kind === 'focus_nag';
    return {
      shouldShowAlert: !isFocusNag,
      shouldPlaySound: !isFocusNag,
      shouldSetBadge: false,
      shouldShowBanner: !isFocusNag,
      shouldShowList: !isFocusNag,
    };
  },
});

export async function registerForPushNotifications(): Promise<string | null> {
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return null;

  // Android notification channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#6366F1',
    });
  }

  try {
    const token = await Notifications.getExpoPushTokenAsync();
    await setItem(STORAGE_KEYS.PUSH_TOKEN, token.data);
    return token.data;
  } catch {
    return null;
  }
}

export async function scheduleTaskReminder(task: Task, enabled: boolean): Promise<string | null> {
  if (!enabled) return null;

  // Trigger at 9 AM on due date, or 1 hour before if time is specified.
  const dueDate = new Date(task.dueDate + 'T09:00:00');
  const triggerDate = new Date(dueDate.getTime() - 60 * 60 * 1000); // 1 hour before 9 AM = 8 AM

  const secondsUntil = Math.floor((triggerDate.getTime() - Date.now()) / 1000);
  if (secondsUntil <= 0) return null; // Already passed

  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: "⏰ What's first?",
        body: `Don't forget: ${task.title} is due today.`,
        data: { taskId: task.id },
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: secondsUntil,
        repeats: false,
      },
    });
    return id;
  } catch {
    return null;
  }
}

export async function cancelTaskReminder(notificationId: string | null | undefined): Promise<void> {
  if (!notificationId) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch {}
}

export async function cancelAllReminders(): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {}
}
