import { Redirect } from "expo-router";
import { useApp } from "@/context/AppContext";
import { View, ActivityIndicator } from "react-native";
import Colors from "@/constants/colors";

export default function Index() {
  const { isOnboarded, diagnosticDone, isLoading } = useApp();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: Colors.light.background }}>
        <ActivityIndicator size="large" color={Colors.light.navy} />
      </View>
    );
  }

  if (!isOnboarded) return <Redirect href="/onboarding" />;
  if (!diagnosticDone) return <Redirect href="/diagnostic" />;
  return <Redirect href="/(tabs)" />;
}
