// Root layout — wires up all context providers, font loading, and push notifications.
// FIX 8: Registers for push notifications on startup and listens for notification responses.
// Provider order: Settings → Bypass → Tasks (both Bypass and Tasks read from SettingsContext).
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as Notifications from "expo-notifications";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { SettingsProvider } from "@/contexts/SettingsContext";
import { BypassProvider } from "@/contexts/BypassContext";
import { TasksProvider } from "@/contexts/TasksContext";
import { FocusProvider } from "@/contexts/FocusContext";
import { registerForPushNotifications } from "@/utils/notifications";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  // FIX 8: Register for push notifications once on mount
  useEffect(() => {
    registerForPushNotifications().catch(() => {});
  }, []);

  // FIX 8: Listen for notification taps — extract taskId from notification data
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = (response.notification.request.content.data ?? {}) as {
          taskId?: string;
          kind?: string;
        };
        // Focus-nag taps: just log for now (deep linking can be added later).
        if (data.kind === "focus_nag") {
          console.log("[Notifications] User tapped focus nag");
          return;
        }
        const taskId = data.taskId;
        if (taskId) {
          console.log("[Notifications] User tapped notification for task:", taskId);
        }
      }
    );
    return () => subscription.remove();
  }, []);

  return (
    <Stack screenOptions={{ headerBackTitle: "Back" }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          {/* SettingsProvider must be outermost so Bypass + Tasks can read settings */}
          <SettingsProvider>
            <BypassProvider>
              <TasksProvider>
                {/* FocusProvider depends on Settings + Tasks to decide nag state */}
                <FocusProvider>
                  <GestureHandlerRootView>
                    <KeyboardProvider>
                      <RootLayoutNav />
                    </KeyboardProvider>
                  </GestureHandlerRootView>
                </FocusProvider>
              </TasksProvider>
            </BypassProvider>
          </SettingsProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
