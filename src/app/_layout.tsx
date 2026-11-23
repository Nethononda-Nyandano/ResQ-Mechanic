import { useCallback, useEffect, useRef, useState } from "react";
import { View, ActivityIndicator, Image, Text, TouchableOpacity } from "react-native";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { Stack, useRouter, useSegments } from "expo-router";
import { ClerkProvider, ClerkLoaded, useAuth, useUser } from "@clerk/expo";

import { tokenCache } from "@clerk/expo/token-cache";
import * as WebBrowser from "expo-web-browser";
import { AlertDialogProvider } from "@/components/AppDialog";

import { isProfileComplete } from "@/utils/authCheck";
import { getUserProfileFromSupabase, saveUserProfileToSupabase } from "@/utils/profileService";
import "../../global.css";

WebBrowser.maybeCompleteAuthSession();

SplashScreen.preventAutoHideAsync();

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY || "";

if (!publishableKey) {
  throw new Error("Missing EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY in environment variables.");
}

function InitialLayout() {
  const { isLoaded: isAuthLoaded, isSignedIn } = useAuth();
  const { isLoaded: isUserLoaded, user } = useUser();
  const segments = useSegments();
  const router = useRouter();
  const [profileSyncState, setProfileSyncState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [profileSyncError, setProfileSyncError] = useState<string | null>(null);
  const [syncedUserId, setSyncedUserId] = useState<string | null>(null);
  const syncRequest = useRef(0);

  const syncProfile = useCallback(async () => {
    if (!user || !isUserLoaded || !isSignedIn || !isProfileComplete(user)) return;

    const requestId = ++syncRequest.current;
    setProfileSyncState("loading");
    setProfileSyncError(null);
    setSyncedUserId(null);
    const metadata = (user.unsafeMetadata || {}) as Record<string, unknown>;
    const publicMetadata = (user.publicMetadata || {}) as Record<string, unknown>;
    const firstName = user.firstName?.trim() || String(metadata.firstName || publicMetadata.firstName || "").trim();
    const lastName = user.lastName?.trim() || String(metadata.lastName || publicMetadata.lastName || "").trim();
    const phoneNumber =
      user.primaryPhoneNumber?.phoneNumber ||
      user.phoneNumbers?.[0]?.phoneNumber ||
      String(metadata.phoneNumber || publicMetadata.phoneNumber || "");

    const { data: existingProfile, error: profileError } = await getUserProfileFromSupabase(user.id);
    if (requestId !== syncRequest.current) return;
    if (profileError) {
      setProfileSyncError(profileError.message || "Could not load your account profile.");
      setProfileSyncState("error");
      return;
    }

    const { error } = await saveUserProfileToSupabase({
      userId: user.id,
      email: user.primaryEmailAddress?.emailAddress || null,
      firstName,
      lastName,
      fullName: `${firstName} ${lastName}`.trim(),
      phoneNumber,
      role: "mobile_mechanic",
      avatarUrl: existingProfile?.avatar_url || user.imageUrl || null,
    });
    if (requestId !== syncRequest.current) return;
    if (error) {
      setProfileSyncError(error.message || "Could not save your account profile.");
      setProfileSyncState("error");
      return;
    }
    setSyncedUserId(user.id);
    setProfileSyncState("ready");
  }, [isSignedIn, isUserLoaded, user]);

  useEffect(() => {
    if (isSignedIn && isProfileComplete(user)) {
      void syncProfile();
    } else {
      syncRequest.current += 1;
      setProfileSyncState("idle");
      setProfileSyncError(null);
      setSyncedUserId(null);
    }
    return () => { syncRequest.current += 1; };
  }, [isSignedIn, syncProfile, user]);

  const profileComplete = isProfileComplete(user);
  const profileSynced = profileSyncState === "ready" && syncedUserId === user?.id;
  const isAuthReady =
    isAuthLoaded &&
    (!isSignedIn ||
      (isUserLoaded && Boolean(user) && (!profileComplete || profileSynced)));

  useEffect(() => {
    if (!isAuthLoaded) return;

    const segs = (segments || []) as string[];
    const inAuthGroup = segs[0] === "(auth)";
    const onSignInOrMfa =
      inAuthGroup && (segs[1] === "sign-in" || segs[1] === "mfa" || !segs[1]);
    const onCompleteProfile = inAuthGroup && segs[1] === "complete-profile";

    if (!isSignedIn) {
      if (!inAuthGroup || onCompleteProfile) {
        router.replace("/(auth)/sign-in");
      }
    } else {
      // If user is currently on sign-in or mfa after auth, move to resolver
      if (onSignInOrMfa) {
        router.replace("/");
        return;
      }

      // Wait until user details are fully loaded
      if (!isUserLoaded || !user) return;

      const complete = isProfileComplete(user);
      if (complete && !profileSynced) return;

      if (!complete) {
        if (!onCompleteProfile) {
          router.replace("/(auth)/complete-profile");
        }
      } else {
        if (inAuthGroup || segs.length === 0 || segs[0] === "index") {
          router.replace("/(tabs)");
        }
      }
    }
  }, [isAuthLoaded, isUserLoaded, isSignedIn, user, segments, router, profileSynced]);

  return (
    <View className="flex-1 bg-gray-50">
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="crud_vehicle" />
        <Stack.Screen name="+not-found" />
      </Stack>

      {!isAuthReady && (
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "#f9fafb",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
          }}
        >
          <Image
            source={require("@/assets/images/logo4.png")}
            className="w-44 h-24"
            resizeMode="contain"
          />
          {profileSyncState !== "error" && <ActivityIndicator size="small" color="#111827" className="mt-4" />}
          {profileSyncState === "error" && (
            <View className="items-center px-8 mt-4">
              <Text className="text-center text-sm text-gray-700 font-poppin">{profileSyncError}</Text>
              <TouchableOpacity onPress={() => { void syncProfile(); }} className="mt-3 rounded-xl bg-gray-900 px-4 py-2">
                <Text className="font-poppin-medium text-white">Retry saving profile</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

export default function RootLayout() {
  const [loaded, error] = useFonts({
    poppin: require("@/assets/fonts/Poppins/Poppins-Regular.ttf"),
    "poppin-semibold": require("@/assets/fonts/Poppins/Poppins-SemiBold.ttf"),
    "poppin-light": require("@/assets/fonts/Poppins/Poppins-Light.ttf"),
    "poppin-bold": require("@/assets/fonts/Poppins/Poppins-Bold.ttf"),
    "poppin-extrabold": require("@/assets/fonts/Poppins/Poppins-ExtraBold.ttf"),
    "poppin-medium": require("@/assets/fonts/Poppins/Poppins-Medium.ttf"),
  });

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  if (!loaded && !error) {
    return null;
  }

  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <ClerkLoaded>
        <AlertDialogProvider>
          <InitialLayout />
        </AlertDialogProvider>
      </ClerkLoaded>
    </ClerkProvider>
  );
}
