// Root layout — context providers, font loading, push notifications.
// CHANGE 1: SetupGate shows a full-screen setup Modal on first launch.
// Provider order: Settings → SetupGate → Bypass → Tasks → Focus.
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
import { Modal } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { SetupScreen } from "@/components/SetupScreen";
import { SettingsProvider } from "@/contexts/SettingsContext";
import { BypassProvider } from "@/contexts/BypassContext";
import { TasksProvider } from "@/contexts/TasksContext";
import { FocusProvider } from "@/contexts/FocusContext";
import { useSettings } from "@/contexts/SettingsContext";
import { registerForPushNotifications } from "@/utils/notifications";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  useEffect(() => {
    registerForPushNotifications().catch(() => {});
  }, []);

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = (response.notification.request.content.data ?? {}) as {
          taskId?: string;
          kind?: string;
        };
        if (data.kind === "focus_nag") return;
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

// CHANGE 1: SetupGate — renders a blocking Modal over the main app until
// the user completes first-time setup. Uses a Modal (not route-based) so
// all providers below still mount and hydrate in the background.
function SetupGate({ children }: { children: React.ReactNode }) {
  const { settings, isLoaded } = useSettings();
  const showSetup = isLoaded && !settings.hasCompletedSetup;

  return (
    <>
      {children}
      <Modal
        visible={showSetup}
        animationType="fade"
        presentationStyle="fullScreen"
        onRequestClose={() => {/* cannot dismiss without completing setup */}}
      >
        <SetupScreen />
      </Modal>
    </>
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
          <SettingsProvider>
            <SetupGate>
              <BypassProvider>
                <TasksProvider>
                  <FocusProvider>
                    <GestureHandlerRootView>
                      <KeyboardProvider>
                        <RootLayoutNav />
                      </KeyboardProvider>
                    </GestureHandlerRootView>
                  </FocusProvider>
                </TasksProvider>
              </BypassProvider>
            </SetupGate>
          </SettingsProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
