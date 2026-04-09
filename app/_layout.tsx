import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { View, Text, StyleSheet, Modal, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { queryClient } from "@/lib/query-client";
import { AppProvider, useApp } from "@/context/AppContext";
import { ClerkProvider, useAuth } from "@clerk/clerk-expo";
import * as SecureStore from "expo-secure-store";
import Colors from "@/constants/colors";

SplashScreen.preventAutoHideAsync();

const PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";

const tokenCache = {
  async getToken(key: string) {
    return SecureStore.getItemAsync(key);
  },
  async saveToken(key: string, value: string) {
    return SecureStore.setItemAsync(key, value);
  },
  async clearToken(key: string) {
    return SecureStore.deleteItemAsync(key);
  },
};

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: "slide_from_right" }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="auth" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="diagnostic" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen
        name="results"
        options={{ presentation: "modal", animation: "slide_from_bottom" }}
      />
    </Stack>
  );
}

function AuthGuard() {
  const { isSignedIn, isLoading } = useApp();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    const onAuthScreen = segments[0] === "auth";
    if (!isSignedIn && !onAuthScreen) {
      router.replace("/auth");
    }
  }, [isSignedIn, isLoading, segments]);

  return null;
}

function MigrationPromptModal() {
  const { pendingMigration, confirmMigration } = useApp();
  return (
    <Modal visible={pendingMigration} transparent animationType="fade">
      <View style={migrStyles.overlay}>
        <View style={migrStyles.card}>
          <View style={migrStyles.iconWrap}>
            <Ionicons name="cloud-upload-outline" size={44} color={Colors.light.navy} />
          </View>
          <Text style={migrStyles.title}>Transfer Your Progress?</Text>
          <Text style={migrStyles.body}>
            We found practice data on this device from before you signed in.
            Would you like to transfer it to your new account?
          </Text>
          <TouchableOpacity
            style={migrStyles.confirmBtn}
            onPress={() => confirmMigration(true)}
            activeOpacity={0.85}
          >
            <Text style={migrStyles.confirmTxt}>Yes, Transfer My Progress</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={migrStyles.declineBtn}
            onPress={() => confirmMigration(false)}
            activeOpacity={0.85}
          >
            <Text style={migrStyles.declineTxt}>No, Start Fresh</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function SyncErrorBanner() {
  const { syncError } = useApp();
  const insets = useSafeAreaInsets();
  if (!syncError) return null;
  return (
    <View style={[syncBannerStyles.bar, { paddingTop: insets.top + 8 }]}>
      <Ionicons name="cloud-offline-outline" size={14} color="#fff" />
      <Text style={syncBannerStyles.text}>Offline — changes saved locally</Text>
    </View>
  );
}

function AppContent() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
        <AuthGuard />
        <RootLayoutNav />
        <MigrationPromptModal />
        <SyncErrorBanner />
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}

function ClerkAuthRoot() {
  const { getToken, isSignedIn, isLoaded, userId } = useAuth();
  return (
    <AppProvider
      getToken={getToken}
      isSignedIn={isSignedIn ?? false}
      isAuthLoaded={isLoaded}
      userId={userId ?? null}
    >
      <AppContent />
    </AppProvider>
  );
}

function ConfigurationRequiredScreen() {
  return (
    <View style={cfgStyles.container}>
      <View style={cfgStyles.iconWrap}>
        <Text style={cfgStyles.icon}>⚙</Text>
      </View>
      <Text style={cfgStyles.title}>Auth not configured</Text>
      <Text style={cfgStyles.body}>
        Set{" "}
        <Text style={cfgStyles.code}>EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY</Text>
        {" "}in Replit Secrets to enable sign-in.
      </Text>
    </View>
  );
}

const migrStyles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center", alignItems: "center", padding: 24,
  },
  card: {
    backgroundColor: Colors.light.background,
    borderRadius: 28, padding: 28, gap: 16, width: "100%", maxWidth: 400,
    alignItems: "center",
  },
  iconWrap: { marginBottom: 4 },
  title: {
    fontFamily: "Inter_700Bold", fontSize: 22,
    color: Colors.light.navy, textAlign: "center",
  },
  body: {
    fontFamily: "Inter_400Regular", fontSize: 15,
    color: Colors.light.textSecondary, textAlign: "center", lineHeight: 22,
  },
  confirmBtn: {
    width: "100%", backgroundColor: Colors.light.navy,
    borderRadius: 16, paddingVertical: 18,
    alignItems: "center",
  },
  confirmTxt: { fontFamily: "Inter_700Bold", fontSize: 16, color: "#fff" },
  declineBtn: {
    width: "100%", backgroundColor: Colors.light.card,
    borderRadius: 16, paddingVertical: 16,
    alignItems: "center",
    borderWidth: 2, borderColor: Colors.light.border,
  },
  declineTxt: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: Colors.light.textSecondary },
});

const syncBannerStyles = StyleSheet.create({
  bar: {
    position: "absolute", top: 0, left: 0, right: 0,
    backgroundColor: Colors.light.rust,
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    paddingBottom: 8, paddingHorizontal: 16, gap: 6, zIndex: 999,
  },
  text: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: "#fff" },
});

const cfgStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.navy,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  iconWrap: { marginBottom: 20 },
  icon: { fontSize: 48 },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    color: "#fff",
    marginBottom: 12,
    textAlign: "center",
  },
  body: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: "rgba(255,255,255,0.75)",
    textAlign: "center",
    lineHeight: 22,
  },
  code: {
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.gold,
  },
});

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

  if (!PUBLISHABLE_KEY) {
    return (
      <ErrorBoundary>
        <ConfigurationRequiredScreen />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ClerkProvider publishableKey={PUBLISHABLE_KEY} tokenCache={tokenCache}>
          <ClerkAuthRoot />
        </ClerkProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
