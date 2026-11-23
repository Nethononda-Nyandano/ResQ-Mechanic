import { useSSO } from "@clerk/expo";
import { useSignIn, useSignUp } from "@clerk/expo/legacy";
import Ionicons from "@react-native-vector-icons/ionicons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Alert } from "@/components/dialogNative";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";

WebBrowser.maybeCompleteAuthSession();

export const generateSecureAuthSecret = () => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+";
  let secret = "ResQ9!";
  for (let i = 0; i < 26; i++) {
    secret += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return secret;
};

const useWarmUpBrowser = () => {
  useEffect(() => {
    if (Platform.OS !== "web") {
      void WebBrowser.warmUpAsync();
      return () => {
        void WebBrowser.coolDownAsync();
      };
    }
  }, []);
};

export default function MechanicSignIn() {
  useWarmUpBrowser();

  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeMethod, setActiveMethod] = useState<"email" | "google" | "apple" | null>(null);

  const router = useRouter();
  const { signIn, isLoaded: isSignInLoaded } = useSignIn();
  const { signUp, isLoaded: isSignUpLoaded } = useSignUp();

  const { startSSOFlow } = useSSO();

  const handleContinueWithEmail = async () => {
    const trimmedEmail = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(trimmedEmail)) {
      Alert.alert("Invalid email", "Please enter a valid email address.");
      return;
    }

    if (!isSignInLoaded || !isSignUpLoaded) {
      Alert.alert("Please wait", "Authentication is still loading.");
      return;
    }

    if (isRegistering) {
      const nameParts = fullName.trim().split(/\s+/).filter(Boolean);
      if (nameParts.length < 2) {
        Alert.alert("Full name required", "Enter your first and last name to create an account.");
        return;
      }

      setLoading(true);
      setActiveMethod("email");
      try {
        await signUp.create({
          emailAddress: trimmedEmail,
          password: generateSecureAuthSecret(),
          firstName: nameParts[0],
          lastName: nameParts.slice(1).join(" "),
          unsafeMetadata: { role: "mobile_mechanic" },
        });
        await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
        router.push({
          pathname: "/(auth)/mfa",
          params: {
            email: trimmedEmail,
            mode: "signUp",
            firstName: nameParts[0],
            lastName: nameParts.slice(1).join(" "),
          },
        });
      } catch (err: any) {
        Alert.alert(
          "Registration failed",
          err?.errors?.[0]?.message || err?.message || "Could not start registration. Please try again.",
        );
      } finally {
        setLoading(false);
        setActiveMethod(null);
      }
      return;
    }

    setLoading(true);
    setActiveMethod("email");
    try {
      const signInAttempt = await signIn.create({ identifier: trimmedEmail });
      const emailCodeFactor = signInAttempt.supportedFirstFactors?.find(
        (factor: any) => factor.strategy === "email_code",
      ) as any;
      const resetPasswordFactor = signInAttempt.supportedFirstFactors?.find(
        (factor: any) => factor.strategy === "reset_password_email_code",
      ) as any;

      const targetFactor = emailCodeFactor || resetPasswordFactor;

      if (!targetFactor?.emailAddressId) {
        Alert.alert("Email sign-in unavailable", "This account cannot sign in with an email verification code. Try Google or Apple.");
        return;
      }

      await signIn.prepareFirstFactor({
        strategy: targetFactor.strategy,
        emailAddressId: targetFactor.emailAddressId,
      });
      router.push({
        pathname: "/(auth)/mfa",
        params: {
          email: trimmedEmail,
          mode: "signIn",
          strategy: targetFactor.strategy,
          emailAddressId: targetFactor.emailAddressId,
        },
      });
    } catch (err: any) {
      const firstError = err?.errors?.[0];
      Alert.alert(
        firstError?.code === "form_identifier_not_found" ? "Account not found" : "Sign in failed",
        firstError?.code === "form_identifier_not_found"
          ? "No account exists for this email. Choose Create account to register."
          : firstError?.message || "Something went wrong. Please try again.",
      );
    } finally {
      setLoading(false);
      setActiveMethod(null);
    }
  };

  const handleGoogleSignIn = useCallback(async () => {
    try {
      setLoading(true);
      setActiveMethod("google");
      const redirectUrl = AuthSession.makeRedirectUri();
      const { createdSessionId, setActive, authSessionResult, signIn: pendingSignIn, signUp: pendingSignUp } = await startSSOFlow({
        strategy: "oauth_google",
        redirectUrl,
        unsafeMetadata: { role: "mobile_mechanic" },
      });

      const sessionId =
        createdSessionId ||
        pendingSignIn?.createdSessionId ||
        pendingSignUp?.createdSessionId;

      if (sessionId && setActive) {
        await setActive({ session: sessionId });
        router.replace("/(auth)/complete-profile");
      } else if (authSessionResult?.type === "cancel" || authSessionResult?.type === "dismiss") {
        Alert.alert("Sign in cancelled", "The Google sign-in was cancelled. You can try again whenever you are ready.");
      } else if (pendingSignIn?.status === "needs_second_factor" || pendingSignUp?.status === "missing_requirements") {
        Alert.alert("Additional verification needed", "Complete sign-in with email verification, then try Google again.");
      } else {
        Alert.alert("Sign in not completed", "No session was created. You can try again or continue with email.");
      }
    } catch (err: any) {
      const message = err?.errors?.[0]?.message || err?.message || "Could not sign in with Google.";
      const cancelled = err?.code === "ERR_CANCELED" || /cancel(?:led|ed)/i.test(message);
      Alert.alert(
        cancelled ? "Sign in cancelled" : "Google sign-in failed",
        cancelled ? "The Google sign-in was cancelled. You can try again whenever you are ready." : message,
      );
    } finally {
      setLoading(false);
      setActiveMethod(null);
    }
  }, [startSSOFlow, router]);

  const handleAppleSignIn = useCallback(async () => {
    try {
      setLoading(true);
      setActiveMethod("apple");
      const redirectUrl = AuthSession.makeRedirectUri();
      const { createdSessionId, setActive, authSessionResult, signIn: pendingSignIn, signUp: pendingSignUp } = await startSSOFlow({
        strategy: "oauth_apple",
        redirectUrl,
        unsafeMetadata: { role: "mobile_mechanic" },
      });

      const sessionId =
        createdSessionId ||
        pendingSignIn?.createdSessionId ||
        pendingSignUp?.createdSessionId;

      if (sessionId && setActive) {
        await setActive({ session: sessionId });
        router.replace("/(auth)/complete-profile");
      } else if (authSessionResult?.type === "cancel" || authSessionResult?.type === "dismiss") {
        Alert.alert("Sign in cancelled", "The Apple sign-in was cancelled. You can try again whenever you are ready.");
      } else {
        Alert.alert("Sign in not completed", "No session was created. Please try again.");
      }
    } catch (err: any) {
      console.error("Apple sign in error", err);
      Alert.alert(
        "Apple Sign In Failed",
        err?.errors?.[0]?.message ||
          err?.message ||
          "Could not sign in with Apple.",
      );
    } finally {
      setLoading(false);
      setActiveMethod(null);
    }
  }, [startSSOFlow, router]);

  return (
    <>
      <StatusBar style="dark" />
      <SafeAreaView style={{ flex: 1, backgroundColor: "#f9fafb" }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <ScrollView
            contentContainerStyle={{ flexGrow: 1 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View
              className={"flex-1 bg-gray-50 p-6 items-center justify-center"}
            >
              {/* Logo & Header */}
              <View className="items-center mt-2 mb-6">
                <Image
                  source={require("@/assets/images/logo4.png")}
                  className="w-40 h-18"
                  resizeMode="contain"
                />

                <Text className="text-gray-500 text-xs font-poppin text-center">
                  Sign in to accept rescue requests, manage service jobs, and
                  assist motorists.
                </Text>
              </View>

              {/* Form Section */}
              <View className="gap-4">
                  <View className="bg-white p-3.5 rounded-xl mb-1 flex-row items-start">
                    <Ionicons
                      name="information-circle"
                      size={20}
                      color="#101828"
                      className="mt-0.5"
                    />
                    <Text className="text-gray-700 text-xs font-poppin ml-2 flex-1 leading-relaxed">
                      <Text className="font-poppin-semibold text-gray-900">
                        Individual Mobile Mechanic:
                      </Text>{" "}
                      Continue with Google or Email. You can complete your trade
                      certifications and service vehicle details right after
                      login.
                    </Text>
                  </View>

                  {isRegistering && (
                    <View className="w-full flex-row items-center rounded-xl h-14 px-3.5 bg-white">
                      <Ionicons name="person-outline" size={20} color="#6b7280" />
                      <TextInput
                        className="flex-1 ml-2.5 h-full font-poppin text-gray-900 text-sm"
                        placeholder="Full name"
                        placeholderTextColor="#9ca3af"
                        value={fullName}
                        onChangeText={setFullName}
                        autoCapitalize="words"
                        autoComplete="name"
                        editable={!loading}
                      />
                    </View>
                  )}

                  {/* Email Input */}
                  <View className="w-full flex-row h-16 items-center rounded-xl h-14 px-3.5 bg-white ">
                    <Ionicons name="mail-outline" size={20} color="#6b7280" />
                    <TextInput
                      className="flex-1 ml-2.5 h-full font-poppin text-gray-900 text-sm"
                      placeholder="Enter your email address"
                      placeholderTextColor="#9ca3af"
                      value={email}
                      onChangeText={setEmail}
                      autoCapitalize="none"
                      autoComplete="email"
                      keyboardType="email-address"
                      editable={!loading}
                    />
                  </View>

                  {/* Continue with Email button */}
                  <TouchableOpacity
                    onPress={handleContinueWithEmail}
                    disabled={loading}
                    className="bg-gray-900 flex-row gap-2 justify-center h-16 items-center rounded-xl shadow-sm"
                  >
                    {activeMethod === "email" ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Ionicons name="mail-outline" size={18} color="#fff" />
                        <Text className="text-white font-poppin-medium text-sm">
                          {isRegistering ? "Create account and continue" : "Continue with Email"}
                        </Text>
                        <Ionicons
                          name="chevron-forward"
                          size={18}
                          color="#fff"
                        />
                      </>
                    )}
                  </TouchableOpacity>

                  <View className="flex-row justify-center items-center mt-2">
                    <Text className="text-gray-500 font-poppin text-xs">
                      {isRegistering ? "Already have an account? " : "New to ResQ Mechanic? "}
                    </Text>
                    <TouchableOpacity
                      onPress={() => setIsRegistering((value) => !value)}
                      disabled={loading}
                    >
                      <Text className="text-gray-900 font-poppin-semibold text-xs underline">
                        {isRegistering ? "Sign in" : "Create account"}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Divider */}
                  <View className="flex-row items-center my-1">
                    <View className="flex-1 h-px bg-gray-300" />
                    <Text className="mx-3 text-gray-400 font-poppin-light text-xs">
                      OR
                    </Text>
                    <View className="flex-1 h-px bg-gray-300" />
                  </View>

                  {/* Google Sign In Button */}
                  <TouchableOpacity
                    onPress={handleGoogleSignIn}
                    disabled={loading}
                    className=" h-16 flex-row gap-3 justify-center items-center rounded-xl bg-white "
                  >
                    {activeMethod === "google" ? (
                      <ActivityIndicator size="small" color="#111827" />
                    ) : (
                      <Image
                        source={require("@/assets/images/google.png")}
                        className="w-5 h-5"
                        resizeMode="contain"
                      />
                    )}
                    <Text className="text-gray-900 font-poppin-semibold text-sm">
                      {activeMethod === "google" ? "Connecting to Google…" : "Continue with Google"}
                    </Text>
                  </TouchableOpacity>

                  {/* Apple Sign In Button */}
                  {Platform.OS === "ios" && (
                    <TouchableOpacity
                      onPress={handleAppleSignIn}
                      disabled={loading}
                      className="bg-black flex-row gap-3 justify-center h-14 items-center rounded-xl shadow-sm"
                    >
                      {activeMethod === "apple" ? (
                        <ActivityIndicator size="small" color="#ffffff" />
                      ) : (
                        <Ionicons name="logo-apple" size={20} color="#fff" />
                      )}
                      <Text className="text-white font-poppin-semibold text-sm">
                        {activeMethod === "apple" ? "Connecting…" : "Continue with Apple"}
                      </Text>
                    </TouchableOpacity>
                  )}
              </View>

              {/* Support / Footer info */}
              <View className="mt-8 items-center">
                <Text className="text-gray-400 text-xs font-poppin text-center">
                  Need help with your mechanic account?
                </Text>
                <TouchableOpacity
                  onPress={() =>
                    Alert.alert(
                      "ResQ Mechanic Support",
                      "For mechanic account assistance, write to support@resq.co.za.",
                    )
                  }
                  className="mt-1.5"
                >
                  <Text className="text-gray-800 text-xs font-poppin-semibold underline">
                    Contact Mechanic Support
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
}
