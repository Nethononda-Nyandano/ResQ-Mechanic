import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
} from "react-native";
import { Alert } from "@/components/dialogNative";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@react-native-vector-icons/ionicons";
import { useRouter } from "expo-router";
import { useUser, useClerk } from "@clerk/expo";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { saveUserProfileToSupabase } from "@/utils/profileService";
import { saveRescuerProfile, MechanicType } from "@/utils/mechanicService";
import { getAutoLocation, geocodeAddress } from "@/utils/locationService";
import { uploadFileToSupabaseStorage } from "@/utils/storageService";

const AVAILABLE_SERVICES = [
  {
    id: "tow",
    label: "Towing & Recovery",
    desc: "Flatbed and wheel-lift towing",
    icon: require("@/assets/images/truck.png"),
  },
  {
    id: "tyre",
    label: "Tyre Assist",
    desc: "Puncture repair & wheel changes",
    icon: require("@/assets/images/tyre.png"),
  },
  {
    id: "battery",
    label: "Battery Jumpstart",
    desc: "Jumpstart & diagnostics",
    icon: require("@/assets/images/batery.png"),
  },
  {
    id: "fuel",
    label: "Emergency Fuel",
    desc: "Petrol & Diesel on-demand refills",
    icon: require("@/assets/images/fuel.png"),
  },
  {
    id: "diagnostics",
    label: "All-rounder Mechanic",
    desc: "Engine, gearbox, lights, electrical & roadside repair",
    icon: require("@/assets/images/fuel.png"),
  },
];

const VEHICLE_TYPES = [
  "Flatbed Tow Truck",
  "Rapid Response Bakkie",
  "Service & Repair Van",
  "Motorcycle Unit",
];

const LICENSE_CODES = ["Code 8 (B / EB)", "Code 10 (C1 / EC1)", "Code 14 (EC)"];

const STEPS = [
  {
    id: 1,
    title: "Personal Information",
    subtitle: "Your basic contact & responder profile",
  },
  {
    id: 2,
    title: "Qualifications & Docs",
    subtitle: "Driver's license and certification documents",
  },
  {
    id: 3,
    title: "Rescue Services",
    subtitle: "Select the breakdown services you provide",
  },
  {
    id: 4,
    title: "Service Vehicle",
    subtitle: "Your roadside recovery vehicle details",
  },
  {
    id: 5,
    title: "Operating Depot",
    subtitle: "Base location & service coverage",
  },
];

export default function CompleteMechanicProfile() {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [loading, setLoading] = useState(false);

  // Step 1: Personal Info
  const [firstName, setFirstName] = useState(user?.firstName || "");
  const [lastName, setLastName] = useState(user?.lastName || "");
  const [phone, setPhone] = useState(
    user?.primaryPhoneNumber?.phoneNumber ||
      (user?.unsafeMetadata as Record<string, any>)?.phoneNumber ||
      ""
  );
  const [garageName, setGarageName] = useState("");
  const [baseAddress, setBaseAddress] = useState("");
  const [avatarUri, setAvatarUri] = useState<string | null>(null);

  // Step 2: Qualifications & Docs
  const [licenseCode, setLicenseCode] = useState("Code 10 (C1 / EC1)");
  const [tradeCertNumber, setTradeCertNumber] = useState("");
  const [driverLicenseNumber, setDriverLicenseNumber] = useState("");
  const [licenseDoc, setLicenseDoc] = useState<{ name: string; uri: string } | null>(null);
  const [idDoc, setIdDoc] = useState<{ name: string; uri: string } | null>(null);

  // Step 3: Rescue Services
  const [selectedServices, setSelectedServices] = useState<string[]>([

  ]);

  // Step 4: Service Vehicle
  const [vehicleType, setVehicleType] = useState("Rapid Response Bakkie");
  const [vehicleMake, setVehicleMake] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");
  const [vehicleYear, setVehicleYear] = useState("");
  const [vehiclePlate, setVehiclePlate] = useState("");
  const [vehicleColor, setVehicleColor] = useState("White");
  const [fuelType, setFuelType] = useState("Diesel");
  const [vehicleTypeDropdownOpen, setVehicleTypeDropdownOpen] = useState(false);

  // Step 5: Depot & Finish
  const [operatingRadius, setOperatingRadius] = useState<number>(35);
  const [termsAccepted, setTermsAccepted] = useState<boolean>(true);
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [autoCoords, setAutoCoords] = useState<{ latitude: number; longitude: number } | null>(null);

  // Fetch live location using expo-location
  const fetchLiveLocation = async () => {
    setIsLocating(true);
    try {
      const loc = await getAutoLocation();
      if (loc) {
        setAutoCoords({ latitude: loc.latitude, longitude: loc.longitude });
        if (loc.address) {
          setBaseAddress(loc.address);
        }
      }
    } catch {
      // ignore
    } finally {
      setIsLocating(false);
    }
  };

  // Automatically determine responder live location on mount (keeping business name empty)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchLiveLocation()
  }, []);

  const currentStep = STEPS[currentStepIndex];

  const handlePickAvatar = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]?.uri) {
        setAvatarUri(result.assets[0].uri);
      }
    } catch (err) {
      console.warn("Avatar pick error:", err);
    }
  };

  const handlePickDoc = async (type: "license" | "id") => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "image/*"],
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets && result.assets[0]) {
        const file = result.assets[0];
        const docObj = { name: file.name || "document", uri: file.uri };
        if (type === "license") setLicenseDoc(docObj);
        else setIdDoc(docObj);
      }
    } catch (err) {
      console.warn("Document pick error:", err);
    }
  };

  const toggleService = (id: string) => {
    setSelectedServices((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const handleNext = () => {
    if (currentStepIndex === 0) {
      if (!firstName.trim() || !lastName.trim()) {
        Alert.alert("Required Fields", "Please enter your first and last name.");
        return;
      }
      if (!phone.trim()) {
        Alert.alert("Required Fields", "Please enter a valid phone number.");
        return;
      }
    } else if (currentStepIndex === 1) {
      if (!driverLicenseNumber.trim()) {
        Alert.alert("Driver's License", "Please enter your driver license number.");
        return;
      }
    } else if (currentStepIndex === 2) {
      if (selectedServices.length === 0) {
        Alert.alert("Select Services", "Please select at least one rescue service.");
        return;
      }
    } else if (currentStepIndex === 3) {
      if (!vehicleMake.trim() || !vehiclePlate.trim()) {
        Alert.alert("Service Vehicle", "Please enter your vehicle make and registration plate.");
        return;
      }
    }

    if (currentStepIndex < STEPS.length - 1) {
      setCurrentStepIndex((prev) => prev + 1);
    } else {
      handleSubmitProfile();
    }
  };

  const handleSubmitProfile = async () => {
    if (!user) return;
    if (!termsAccepted) {
      Alert.alert("Terms & Conditions", "Please accept the ResQ Responder Agreement.");
      return;
    }

    setLoading(true);
    try {
      // 1. Upload avatar to Supabase Storage if local image was picked
      let finalAvatarUrl = avatarUri || user.imageUrl || null;
      if (avatarUri && !avatarUri.startsWith("http")) {
        try {
          const avatarUpload = await uploadFileToSupabaseStorage(
            avatarUri,
            `avatar_${user.id}.jpg`,
            `avatars/${user.id}`
          );
          if (avatarUpload.url) {
            finalAvatarUrl = avatarUpload.url;
          }
        } catch (uploadErr) {
          console.warn("Avatar upload to Supabase storage notice:", uploadErr);
        }
      }

      // 2. Update Clerk user metadata & name
      const mechanicMetadata = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phoneNumber: phone.trim(),
        role: "mobile_mechanic",
        mechanicOnboarded: true,
        isProfileComplete: true,
        onboarded: true,
      };
      await user.update({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
      });

      // 3. Save user profile to Supabase `profiles` table
      const { error: profileError } = await saveUserProfileToSupabase({
        userId: user.id,
        email: user.primaryEmailAddress?.emailAddress || null,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        fullName: `${firstName.trim()} ${lastName.trim()}`,
        phoneNumber: phone.trim(),
        role: "mobile_mechanic",
        avatarUrl: finalAvatarUrl,
      });
      if (profileError) throw profileError;

      // 4. Determine coordinates from edited base location or auto detected live location
      let finalLat: number | undefined = autoCoords?.latitude;
      let finalLng: number | undefined = autoCoords?.longitude;

      if (baseAddress.trim()) {
        const customGeocode = await geocodeAddress(baseAddress.trim());
        if (customGeocode) {
          finalLat = customGeocode.latitude;
          finalLng = customGeocode.longitude;
        }
      }

      // 5. Save rescuer record to Supabase `rescuers` table and vehicle to `vehicles` table
      const { error: rescuerError } = await saveRescuerProfile({
        userId: user.id,
        mechanicType: "mobile_mechanic",
        fullName: `${firstName.trim()} ${lastName.trim()}`,
        phoneNumber: phone.trim(),
        avatarUrl: finalAvatarUrl,
        serviceTypes: selectedServices,
        garageName: garageName.trim(),
        driverLicenseNumber: driverLicenseNumber.trim(),
        tradeCertNumber: tradeCertNumber.trim(),
        driverLicenseDocUri: licenseDoc?.uri,
        idDocUri: idDoc?.uri,
        latitude: finalLat,
        longitude: finalLng,
        vehicleMake: vehicleMake.trim(),
        vehicleModel: vehicleModel.trim() || vehicleType,
        vehicleYear: vehicleYear.trim() || undefined,
        vehiclePlate: vehiclePlate.trim(),
        vehicleColor: vehicleColor.trim() || "White",
        vehicleType,
        fuelType,
      });

      if (rescuerError) {
        throw rescuerError;
      }

      await user.updateMetadata({
        unsafeMetadata: {
          ...user.unsafeMetadata,
          ...mechanicMetadata,
        },
      });

      try {
        await user.reload();
      } catch (reloadErr) {
        console.warn("User reload notice:", reloadErr);
      }
      router.replace("/(tabs)" as any);
    } catch (err: any) {
      console.error("Failed to complete mechanic profile:", err);
      Alert.alert(
        "Update Failed",
        err?.message || "Could not save your profile. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      router.replace("/(auth)/sign-in" as any);
    } catch (err) {
      console.error("Sign out error", err);
    }
  };

  return (
    <>
      <StatusBar style="dark" />
      <SafeAreaView style={{ flex: 1 }} className="bg-gray-50">
        <View className={"flex-1 bg-gray-50"}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          {/* Header / Navigation */}
          <View className="w-full flex-row justify-between items-center px-6 pt-3">
            {currentStepIndex > 0 ? (
              <TouchableOpacity
                onPress={() => setCurrentStepIndex((prev) => prev - 1)}
                disabled={loading}
                className="w-10 h-10 items-center justify-center rounded-full "
              >
                <Ionicons name="chevron-back" size={20} color="#111828" />
              </TouchableOpacity>
            ) : (
              <View className="w-10 h-10" />
            )}

            <TouchableOpacity onPress={handleSignOut} disabled={loading}>
              <Text className="text-xs text-gray-500 font-poppin">Sign out</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={{ flexGrow: 1 }}
            keyboardShouldPersistTaps="handled"
            className="flex-1 px-6 py-4"
          >
            <View className="items-center w-full mb-4">
              <Image
                source={require("@/assets/images/logo4.png")}
                className="w-40 h-20 mb-2"
                resizeMode="contain"
              />

              {/* Step indicator */}
              <View className="w-full mb-4">
                <View className="flex-row items-center justify-between mb-2">
                  <Text >

                  </Text>
                  <Text className="text-xs font-poppin text-gray-500">
                    Mobile Mechanic Onboarding
                  </Text>
                </View>

                {/* Progress bar */}
                <View className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <View
                    className="h-full bg-gray-900 rounded-full"
                    style={{
                      width: `${((currentStepIndex + 1) / STEPS.length) * 100}%`,
                    }}
                  />
                </View>
              </View>

              {/* Title & Subtitle */}
              <View className="w-full mb-4">
                <Text className="text-2xl font-poppin-bold text-gray-900 mb-1 text-left">
                  {currentStep.title}
                </Text>
                <Text className="text-sm font-poppin text-gray-500 text-left">
                  {currentStep.subtitle}
                </Text>
              </View>
            </View>

            {/* STEP 1: Personal Info */}
            {currentStepIndex === 0 && (
              <View className="w-full gap-3">
                {/* Avatar selection */}
                <View className="items-center mb-2">
                  <TouchableOpacity
                    onPress={handlePickAvatar}
                    className="relative w-20 h-20 rounded-full bg-gray-100 items-center justify-center overflow-hidden"
                  >
                    {avatarUri ? (
                      <Image source={{ uri: avatarUri }} className="w-full h-full" />
                    ) : (
                      <Ionicons name="camera-outline" size={28} color="#101828" />
                    )}
                  </TouchableOpacity>
                  <Text className="text-xs font-poppin text-gray-500 mt-1">
                    Upload Profile Photo
                  </Text>
                </View>

                <View className="w-full flex-row items-center rounded-xl h-14 px-3 bg-white">
                  <Ionicons name="person-outline" size={20} color="#6b7280" />
                  <TextInput
                    value={firstName}
                    onChangeText={setFirstName}
                    placeholder="First Name"
                    placeholderTextColor="#9ca3af"
                    className="flex-1 ml-3 font-poppin text-base text-gray-900"
                    editable={!loading}
                  />
                </View>

                <View className="w-full flex-row items-center rounded-xl h-14 px-3 bg-white">
                  <Ionicons name="person-outline" size={20} color="#6b7280" />
                  <TextInput
                    value={lastName}
                    onChangeText={setLastName}
                    placeholder="Last Name"
                    placeholderTextColor="#9ca3af"
                    className="flex-1 ml-3 font-poppin text-base text-gray-900"
                    editable={!loading}
                  />
                </View>

                <View className="w-full flex-row items-center rounded-xl h-14 px-3 bg-white">
                  <Ionicons name="call-outline" size={20} color="#6b7280" />
                  <TextInput
                    value={phone}
                    onChangeText={setPhone}
                    placeholder="+27 (00) 000-0000"
                    placeholderTextColor="#9ca3af"
                    keyboardType="phone-pad"
                    className="flex-1 ml-3 font-poppin text-base text-gray-900"
                    editable={!loading}
                  />
                </View>

                <View className="w-full flex-row items-center rounded-xl h-14 px-3 bg-white">
                  <Ionicons name="business-outline" size={20} color="#6b7280" />
                  <TextInput
                    value={garageName}
                    onChangeText={setGarageName}
                    placeholder="Business / Garage Name (Leave empty if independent)"
                    placeholderTextColor="#9ca3af"
                    className="flex-1 ml-3 font-poppin text-base text-gray-900"
                    editable={!loading}
                  />
                </View>

                <View className="w-full">
                  <View className="w-full flex-row items-center rounded-xl h-14 px-3 bg-white">
                    <Ionicons name="location-outline" size={20} color="#6b7280" />
                    <TextInput
                      value={baseAddress}
                      onChangeText={setBaseAddress}
                      placeholder="Base Operating Location (e.g. Sandton)"
                      placeholderTextColor="#9ca3af"
                      className="flex-1 ml-3 font-poppin text-base text-gray-900"
                      editable={!loading}
                    />
                    {isLocating ? (
                      <ActivityIndicator size="small" color="#f59e0b" className="mr-1" />
                    ) : (
                      <TouchableOpacity
                        onPress={fetchLiveLocation}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        className="p-1.5"
                        disabled={loading}
                      >
                        <Ionicons name="locate" size={22} color="#101828" />
                      </TouchableOpacity>
                    )}
                  </View>
                  <Text className="text-[11px] font-poppin text-gray-500 mt-1 ml-1">
                    Auto-detected with live GPS. You can edit this base area.
                  </Text>
                </View>
              </View>
            )}

            {/* STEP 2: Qualifications & Docs */}
            {currentStepIndex === 1 && (
              <View className="w-full gap-3">
                <Text className="text-xs font-poppin-semibold text-gray-700 uppercase">
                  Driver`&apos;`s License Code
                </Text>
                <View className="flex-row gap-2">
                  {LICENSE_CODES.map((code) => {
                    const isSelected = licenseCode === code;
                    return (
                      <TouchableOpacity
                        key={code}
                        onPress={() => setLicenseCode(code)}
                        className={`flex-1 py-3 px-2 rounded-xl items-center justify-center ${isSelected ? "bg-gray-900" : "bg-white"}`}
                      >
                        <Text
                          className={`text-xs font-poppin-semibold text-center ${ isSelected ? "text-white" : "text-gray-700" }`}
                        >
                          {code}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <View className="w-full flex-row items-center rounded-xl h-14 px-3 bg-white mt-2">
                  <Ionicons name="card-outline" size={20} color="#6b7280" />
                  <TextInput
                    value={driverLicenseNumber}
                    onChangeText={setDriverLicenseNumber}
                    placeholder="Driver's License Number"
                    placeholderTextColor="#9ca3af"
                    className="flex-1 ml-3 font-poppin text-base text-gray-900"
                    editable={!loading}
                  />
                </View>

                <View className="w-full flex-row items-center rounded-xl h-14 px-3 bg-white">
                  <Ionicons name="ribbon-outline" size={20} color="#6b7280" />
                  <TextInput
                    value={tradeCertNumber}
                    onChangeText={setTradeCertNumber}
                    placeholder="Trade Cert / Registration No (Optional)"
                    placeholderTextColor="#9ca3af"
                    className="flex-1 ml-3 font-poppin text-base text-gray-900"
                    editable={!loading}
                  />
                </View>

                {/* Document Upload Buttons */}
                <TouchableOpacity
                  onPress={() => handlePickDoc("license")}
                  className="w-full p-3.5 bg-white rounded-xl flex-row items-center justify-between"
                >
                  <View className="flex-row items-center flex-1">
                    <Ionicons name="document-attach-outline" size={22} color="#4b5563" />
                    <View className="ml-3 flex-1">
                      <Text className="text-sm font-poppin-medium text-gray-800">
                        {licenseDoc ? licenseDoc.name : "Upload Driver's License"}
                      </Text>
                      <Text className="text-xs font-poppin text-gray-400">PDF, PNG or JPG</Text>
                    </View>
                  </View>
                  <Ionicons
                    name={licenseDoc ? "checkmark-circle" : "cloud-upload-outline"}
                    size={22}
                    color={licenseDoc ? "#10b981" : "#6b7280"}
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => handlePickDoc("id")}
                  className="w-full p-3.5 bg-white rounded-xl flex-row items-center justify-between"
                >
                  <View className="flex-row items-center flex-1">
                    <Ionicons name="finger-print-outline" size={22} color="#4b5563" />
                    <View className="ml-3 flex-1">
                      <Text className="text-sm font-poppin-medium text-gray-800">
                        {idDoc ? idDoc.name : "Upload ID Document / Passport"}
                      </Text>
                      <Text className="text-xs font-poppin text-gray-400">PDF, PNG or JPG</Text>
                    </View>
                  </View>
                  <Ionicons
                    name={idDoc ? "checkmark-circle" : "cloud-upload-outline"}
                    size={22}
                    color={idDoc ? "#10b981" : "#6b7280"}
                  />
                </TouchableOpacity>
              </View>
            )}

            {/* STEP 3: Rescue Services */}
            {currentStepIndex === 2 && (
              <View className="w-full gap-2.5">
                {AVAILABLE_SERVICES.map((srv) => {
                  const isSelected = selectedServices.includes(srv.id);
                  return (
                    <TouchableOpacity
                      key={srv.id}
                      onPress={() => toggleService(srv.id)}
                      className="w-full p-3.5 rounded-xl flex-row items-center justify-between bg-white"
                    >
                      <View className="flex-row items-center flex-1">
                        <Image source={srv.icon} className="w-12 h-8 mr-3" resizeMode="contain" />
                        <View className="flex-1">
                          <Text className="text-sm font-poppin-semibold text-gray-900">
                            {srv.label}
                          </Text>
                          <Text className="text-xs font-poppin text-gray-500">{srv.desc}</Text>
                        </View>
                      </View>
                      <Ionicons
                        name={isSelected ? "checkbox" : "square-outline"}
                        size={22}
                        color={isSelected ? "#1018282" : "#9ca3af"}
                      />
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}



            {/* STEP 4: Service Vehicle */}
            {currentStepIndex === 3 && (
              <View className="w-full gap-3">
                <Text className="text-xs font-poppin-semibold text-gray-700 uppercase">
                  Service Vehicle Type
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  {VEHICLE_TYPES.map((type) => {
                    const isSelected = vehicleType === type;
                    return (
                      <TouchableOpacity
                        key={type}
                        onPress={() => setVehicleType(type)}
                        className={`py-2.5 px-3 rounded-xl ${isSelected ? "bg-gray-900" : "bg-white"}`}
                      >
                        <Text
                          className={`text-xs font-poppin-semibold ${ isSelected ? "text-white" : "text-gray-700" }`}
                        >
                          {type}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Make & Model Row */}
                <View className="flex-row gap-2 mt-1">
                  <View className="flex-1 flex-row items-center rounded-xl h-14 px-3 bg-white">
                    <Ionicons name="car-outline" size={20} color="#6b7280" />
                    <TextInput
                      value={vehicleMake}
                      onChangeText={setVehicleMake}
                      placeholder="Make (e.g. Toyota)"
                      placeholderTextColor="#9ca3af"
                      className="flex-1 ml-2 font-poppin text-sm text-gray-900"
                      editable={!loading}
                    />
                  </View>
                  <View className="flex-1 flex-row items-center rounded-xl h-14 px-3 bg-white">
                    <Ionicons name="speedometer-outline" size={20} color="#6b7280" />
                    <TextInput
                      value={vehicleModel}
                      onChangeText={setVehicleModel}
                      placeholder="Model (e.g. Hilux)"
                      placeholderTextColor="#9ca3af"
                      className="flex-1 ml-2 font-poppin text-sm text-gray-900"
                      editable={!loading}
                    />
                  </View>
                </View>

                {/* Year & Fuel Type Row */}
                <View className="flex-row gap-2">
                  <View className="flex-1 flex-row items-center rounded-xl h-14 px-3 bg-white">
                    <Ionicons name="calendar-outline" size={20} color="#6b7280" />
                    <TextInput
                      value={vehicleYear}
                      onChangeText={setVehicleYear}
                      placeholder="Year (e.g. 2023)"
                      placeholderTextColor="#9ca3af"
                      keyboardType="numeric"
                      maxLength={4}
                      className="flex-1 ml-2 font-poppin text-sm text-gray-900"
                      editable={!loading}
                    />
                  </View>
                  <View className="flex-1">
                    <View className="flex-row gap-1">
                      {["Diesel", "Petrol"].map((f) => (
                        <TouchableOpacity
                          key={f}
                          onPress={() => setFuelType(f)}
                          className={`flex-1 h-14 rounded-xl items-center justify-center ${fuelType === f ? "bg-gray-900" : "bg-white"}`}
                        >
                          <Text
                            className={`text-xs font-poppin-semibold ${ fuelType === f ? "text-white" : "text-gray-700" }`}
                          >
                            {f}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </View>

                {/* Registration / License Plate */}
                <View className="w-full flex-row items-center rounded-xl h-14 px-3 bg-white">
                  <Ionicons name="barcode-outline" size={20} color="#6b7280" />
                  <TextInput
                    value={vehiclePlate}
                    onChangeText={(t) => setVehiclePlate(t.toUpperCase())}
                    placeholder="Registration Plate (e.g. CA 123-456)"
                    placeholderTextColor="#9ca3af"
                    autoCapitalize="characters"
                    className="flex-1 ml-3 font-poppin text-sm text-gray-900"
                    editable={!loading}
                  />
                </View>

                {/* Color */}
                <View className="w-full flex-row items-center rounded-xl h-14 px-3 bg-white">
                  <Ionicons name="color-palette-outline" size={20} color="#6b7280" />
                  <TextInput
                    value={vehicleColor}
                    onChangeText={setVehicleColor}
                    placeholder="Color (e.g. White, Silver, Red)"
                    placeholderTextColor="#9ca3af"
                    className="flex-1 ml-3 font-poppin text-sm text-gray-900"
                    editable={!loading}
                  />
                </View>
              </View>
            )}

            {/* STEP 5: Depot & Finish */}
            {currentStepIndex === 4 && (
              <View className="w-full gap-4">
                <View className="bg-white rounded-xl p-4 gap-2">
                  <Text className="text-sm font-poppin-semibold text-gray-900">
                    Operating Radius Coverage
                  </Text>
                  <Text className="text-xs font-poppin text-gray-500">
                    You will receive emergency dispatch calls within this perimeter:
                  </Text>
                  <View className="flex-row gap-2 mt-2">
                    {[15, 25, 35, 50].map((radius) => (
                      <TouchableOpacity
                        key={radius}
                        onPress={() => setOperatingRadius(radius)}
                        className={`flex-1 py-2.5 rounded-lg items-center justify-center ${operatingRadius === radius ? "bg-gray-800" : "bg-gray-100"}`}
                      >
                        <Text
                          className={`text-xs font-poppin-bold ${ operatingRadius === radius ? "text-white" : "text-gray-700" }`}
                        >
                          {radius} km
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <TouchableOpacity
                  onPress={() => setTermsAccepted(!termsAccepted)}
                  className="flex-row items-center p-3 bg-white rounded-xl"
                >
                  <Ionicons
                    name={termsAccepted ? "checkbox" : "square-outline"}
                    size={22}
                    color={termsAccepted ? "#101828" : "#9ca3af"}
                  />
                  <Text className="ml-3 flex-1 text-xs font-poppin text-gray-600">
                    I agree to the ResQ Responder Agreement, SLA response times, and emergency roadside standards.
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Next / Submit Button */}
            <View className="w-full mt-6 mb-8">
              <TouchableOpacity
                onPress={handleNext}
                disabled={loading}
                className={`w-full bg-gray-900 py-4 rounded-xl items-center ${ loading ? "opacity-60" : "" }`}
              >
                {loading ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text className="text-white font-poppin-semibold text-base">
                    {currentStepIndex === STEPS.length - 1 ? "Complete & Go Online" : "Continue"}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
        </View>
      </SafeAreaView>
    </>
  );
}
