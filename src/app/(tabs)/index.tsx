import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Alert } from "@/components/dialogNative";
import { StatusBar } from "expo-status-bar";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import Ionicons from "@react-native-vector-icons/ionicons";
import { useUser } from "@clerk/expo";
import { GoogleMapView } from "@/components/GoogleMapView";
import { useMechanic } from "@/context/MechanicContext";
import { getRescuerByUserId, setMechanicStatus } from "@/utils/mechanicService";
import {
  acceptRescueRequest,
  getActiveRescueRequest,
  getOpenRescueRequests,
  RescueRequestRecord,
  subscribeToRescueRequestChanges,
  updateRescueStatus,
} from "@/utils/rescueService";
import { isEligibleForRescueRequest } from "@/utils/rescueEligibility";
import { notifyRescueEvent, prepareRescueNotifications } from "@/utils/notificationService";
import { claimNotificationEvent } from "@/utils/notificationEvents";
import { getActionErrorMessage } from "@/utils/actionErrorMessage";
import {
  getAutoLocation,
  startAutomaticLocationSync,
} from "@/utils/locationService";

const DispatchScreen = () => {
  const { user } = useUser();
  const insets = useSafeAreaInsets();
  const { openAiDiagnosis, openChat, activeRouteEstimate, activeRouteLoading } = useMechanic();
  const [rescuerId, setRescuerId] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [loading, setLoading] = useState(true);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [location, setLocation] = useState({
    latitude: -26.2041,
    longitude: 28.0473,
    heading: 0,
  });
  const [incoming, setIncoming] = useState<RescueRequestRecord[]>([]);
  const [activeJob, setActiveJob] = useState<RescueRequestRecord | null>(null);
  const statusUpdateInFlightRef = useRef(false);
  const [serviceTypes, setServiceTypes] = useState<string[]>([
    "tow",
    "tyre",
    "fuel",
    "battery",
  ]);
  const [mechanicStatus, setMechanicStatusState] = useState<"online" | "busy" | "offline">("online");
  const mechanicStatusRef = useRef<"online" | "busy" | "offline">("online");
  const seenRequestIdsRef = useRef(new Set<string>());
  const hasInitialRequestSnapshotRef = useRef(false);

  const refreshJobs = useCallback(
    async (id?: string | null, types?: string[]) => {
      const currentId = id || rescuerId;
      if (!currentId) return;
      const allowed = types || serviceTypes;
      const [openResult, activeResult] = await Promise.all([
        getOpenRescueRequests(),
        getActiveRescueRequest(currentId),
      ]);
      if (activeResult.error) {
        console.warn("Could not refresh the active rescue request:", activeResult.error);
        return;
      }
      if (openResult.error) {
        console.warn("Could not refresh incoming rescue requests:", openResult.error);
        setActiveJob(activeResult.data);
        if (activeResult.data) setIncoming([]);
        return;
      }
      const { data: open } = openResult;
      const { data: active } = activeResult;
      setActiveJob(active);
      const availableRequests = (open || []).filter((job) =>
        isEligibleForRescueRequest({
          rescueType: job.rescue_type,
          serviceTypes: allowed,
          mechanicStatus: mechanicStatusRef.current,
          hasActiveJob: Boolean(active),
        }),
      );
      if (!hasInitialRequestSnapshotRef.current) {
        (open || []).forEach((job) => {
          claimNotificationEvent(seenRequestIdsRef.current, job.id);
        });
        hasInitialRequestSnapshotRef.current = true;
      } else {
        (open || []).forEach((job) => {
          const isNewRequest = claimNotificationEvent(seenRequestIdsRef.current, job.id);
          if (isNewRequest && availableRequests.some((request) => request.id === job.id)) {
            void notifyRescueEvent(
              `request:${job.id}`,
              job.rescue_type === "diagnostics" ? "New all-rounder request" : "New rescue request",
              job.notes?.trim() || `${job.rescue_type} assistance is waiting for you.`,
            );
          }
        });
      }
      setIncoming(active ? [] : availableRequests);
    },
    [rescuerId, serviceTypes],
  );

  useEffect(() => {
    let unsub: (() => void) | null = null;
    let cancelled = false;
    let poll: ReturnType<typeof setInterval> | null = null;
    let loadedTypes = serviceTypes;

    (async () => {
      if (!user?.id) return;
      const { data } = await getRescuerByUserId(user.id);
      if (cancelled) return;
      if (!data?.id) {
        setLoading(false);
        return;
      }
      setRescuerId(data.id);
      const loadedStatus = data.status === "busy" || data.status === "offline" ? data.status : "online";
      mechanicStatusRef.current = loadedStatus;
      setMechanicStatusState(loadedStatus);
      setIsOnline(loadedStatus === "online");
      if (Array.isArray(data.service_types) && data.service_types.length > 0) {
        loadedTypes = data.service_types;
        setServiceTypes(data.service_types);
      }
      if (
        typeof data.current_latitude === "number" &&
        typeof data.current_longitude === "number"
      ) {
        setLocation({
          latitude: data.current_latitude,
          longitude: data.current_longitude,
          heading: data.heading || 0,
        });
      }

      const gps = await getAutoLocation();
      if (gps && !cancelled) {
        setLocation({
          latitude: gps.latitude,
          longitude: gps.longitude,
          heading: gps.heading || 0,
        });
      }

      await refreshJobs(data.id, loadedTypes);
      void prepareRescueNotifications();
      unsub = subscribeToRescueRequestChanges(() => {
        refreshJobs(data.id, loadedTypes);
      });
      poll = setInterval(() => {
        refreshJobs(data.id, loadedTypes);
      }, 5000);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
      if (poll) clearInterval(poll);
      if (unsub) unsub();
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    let stopLocation: (() => void) | null = null;
    let cancelled = false;
    (async () => {
      stopLocation = await startAutomaticLocationSync(
        user.id,
        (coords) => {
          if (!cancelled) {
            setLocation({
              latitude: coords.latitude,
              longitude: coords.longitude,
              heading: coords.heading || 0,
            });
          }
        },
        { highFrequency: Boolean(activeJob) },
      );
    })();
    return () => {
      cancelled = true;
      if (stopLocation) stopLocation();
    };
  }, [user?.id, activeJob?.id]);

  const handleToggleOnline = async () => {
    if (!user?.id) return;
    if (activeJob) {
      Alert.alert(
        "Job in progress",
        "Complete or cancel the current rescue before going offline.",
      );
      return;
    }
    const next = isOnline ? "offline" : "online";
    const { success } = await setMechanicStatus(user.id, next);
    if (success) {
      mechanicStatusRef.current = next;
      setMechanicStatusState(next);
      setIsOnline(next === "online");
    }
  };

  const handleAccept = async (job: RescueRequestRecord) => {
    if (!rescuerId) return;
    if (!isOnline) {
      Alert.alert(
        "Go online",
        "Turn on availability before accepting a rescue.",
      );
      return;
    }
    setAcceptingId(job.id);
    const result = await acceptRescueRequest(job.id, rescuerId);
    setAcceptingId(null);
    if (!result.success) {
      Alert.alert(
        "Could not accept",
        result.error?.message || "This job may already have been taken.",
      );
      refreshJobs();
      return;
    }
    mechanicStatusRef.current = "busy";
    setMechanicStatusState("busy");
    setIsOnline(false);
    setActiveJob(result.data || job);
    setIncoming([]);
  };

  const handleJobStatus = async (
    next: "arrived" | "in_progress" | "completed" | "cancelled",
  ) => {
    if (!activeJob || !rescuerId || statusUpdateInFlightRef.current) return;
    statusUpdateInFlightRef.current = true;
    setUpdatingStatus(true);
    try {
      const result = await updateRescueStatus(activeJob.id, rescuerId, activeJob.status, next);
      if (!result.success) {
        Alert.alert(
          "Update failed",
          result.error?.message || "The job status could not be updated. Please try again.",
        );
        await refreshJobs();
        return;
      }
      if (next === "completed" || next === "cancelled") {
        mechanicStatusRef.current = "online";
        setMechanicStatusState("online");
        setIsOnline(true);
        setActiveJob(null);
        await refreshJobs();
        return;
      }
      setActiveJob(result.data || { ...activeJob, status: next });
    } catch (error) {
      console.error("Failed to update rescue status:", error);
      Alert.alert("Update failed", "Please check your connection and try again.");
      await refreshJobs();
    } finally {
      statusUpdateInFlightRef.current = false;
      setUpdatingStatus(false);
    }
  };

  const openJobLink = async (url: string, action: string) => {
    try {
      await Linking.openURL(url);
    } catch (error) {
      console.warn(`Could not open ${action}:`, error);
      Alert.alert(
        `Unable to ${action}`,
        getActionErrorMessage(error, "Please check that a supported app is available and try again."),
      );
    }
  };

  const customerDestination = useMemo(() => {
    if (!activeJob) return null;
    return {
      latitude: activeJob.pickup_latitude,
      longitude: activeJob.pickup_longitude,
      name: activeJob.client_name || "Customer",
      address: activeJob.pickup_address || "",
    };
  }, [activeJob]);

  const nextAction =
    activeJob?.status === "en_route" || activeJob?.status === "assigned"
      ? { label: "I've arrived", status: "arrived" as const }
      : activeJob?.status === "arrived"
        ? { label: "Start job", status: "in_progress" as const }
        : activeJob?.status === "in_progress"
          ? { label: "Complete rescue", status: "completed" as const }
          : null;

  return (
    <View className="flex-1 bg-gray-50">
      <StatusBar style="dark" />
      <GoogleMapView
        latitude={location.latitude}
        longitude={location.longitude}
        heading={location.heading}
        zoom={activeJob ? 14 : 15}
        destination={customerDestination}
        showRoute={!!activeJob}
        followVehicle={!!activeJob}
      />

      <SafeAreaView
        edges={["top"]}
        className="absolute top-0 left-0 right-0"
        pointerEvents="box-none"
      >
        <View className="px-4 pt-2 flex-row items-center justify-between">
          <View className="bg-white/95 px-3 py-2 rounded-2xl ">
            <Text className="text-[11px] font-poppin text-gray-500">
              Dispatch
            </Text>
            <Text className="text-sm font-poppin-bold text-gray-900">
              {activeJob
                ? "Job in progress"
                : isOnline
                  ? "Waiting for jobs"
                  : "You are offline"}
            </Text>
          </View>
          <TouchableOpacity
            onPress={handleToggleOnline}
            className={`px-4 py-2.5 rounded-2xl ${isOnline ? "bg-emerald-600" : "bg-gray-800"}`}
          >
            <Text className="text-xs font-poppin-bold text-white">
              {isOnline ? "Online" : mechanicStatus === "busy" ? "Busy" : "Offline"}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <View
        className="absolute left-0 right-0 bg-gray-50 rounded-t-3xl "
        style={{
          bottom: 0,
          maxHeight: "60%",
          paddingBottom: Math.max(insets.bottom, 12),
        }}
      >
        <View className="items-center pt-3">
          <View className="w-12 h-1.5 bg-gray-300 rounded-full" />
        </View>

        {loading ? (
          <View className="py-10 items-center">
            <ActivityIndicator color="#d97706" />
            <Text className="text-xs font-poppin text-gray-500 mt-2">
              Loading dispatch...
            </Text>
          </View>
        ) : !rescuerId ? (
          <View className="px-5 py-6">
            <Text className="text-base font-poppin-bold text-gray-900">
              Mechanic profile missing
            </Text>
            <Text className="text-xs font-poppin text-gray-500 mt-1">
              Finish onboarding so clients can send you rescue requests.
            </Text>
          </View>
        ) : activeJob ? (
          <ScrollView
            className="px-5 pt-3"
            showsVerticalScrollIndicator={false}
          >
            <Text className="text-xs font-poppin-semibold text-amber-700 uppercase">
              {activeJob.rescue_type === "diagnostics" ? "All-rounder mechanic" : activeJob.rescue_type} • {activeJob.status.replace("_", " ")}
            </Text>
            <Text className="text-lg font-poppin-bold text-gray-900 mt-1">
              {activeJob.client_name}
            </Text>
            <Text className="text-xs font-poppin text-gray-500 mt-1">
              {activeJob.pickup_address || "Customer pickup location"}
            </Text>
            {activeJob.destination_address ? (
              <Text className="text-xs font-poppin text-gray-500 mt-1">
                Drop-off: {activeJob.destination_address}
              </Text>
            ) : null}
            <Text className="text-xs font-poppin text-gray-500 mt-1">
              {activeJob.vehicle_info}{" "}
              {activeJob.vehicle_plate ? `• ${activeJob.vehicle_plate}` : ""}
            </Text>
            {activeJob.notes?.trim() ? (
              <View className="bg-white rounded-xl p-3 mt-2">
                <Text className="text-[10px] font-poppin-semibold text-gray-500 uppercase mb-1">
                  Client problem description
                </Text>
                <Text className="text-xs font-poppin text-gray-800">{activeJob.notes}</Text>
              </View>
            ) : null}
            <Text className="text-sm font-poppin-bold text-gray-900 mt-2">
              {activeJob.rescue_type === "diagnostics" ? "Estimate " : ""}
              R {Number(activeJob.estimated_price || 0).toFixed(2)}
              {"  "}
              <Text className="text-xs font-poppin text-gray-500">
                {activeRouteEstimate
                  ? `${activeRouteEstimate.distanceKm.toFixed(1)} km • ${activeRouteEstimate.durationMinutes} min`
                  : activeRouteLoading
                    ? "Calculating road route…"
                    : "Road distance and ETA unavailable"}
              </Text>
            </Text>

            {nextAction ? (
              <TouchableOpacity
                disabled={updatingStatus}
                onPress={() => handleJobStatus(nextAction.status)}
                accessibilityRole="button"
                accessibilityLabel={updatingStatus ? "Updating job status" : nextAction.label}
                className={`h-14 mt-4 mb-2 rounded-2xl items-center justify-center ${updatingStatus ? "bg-gray-500" : "bg-gray-900"}`}
              >
                {updatingStatus ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text className="text-sm font-poppin-bold text-white">
                    {nextAction.label}
                  </Text>
                )}
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              disabled={updatingStatus}
              onPress={() =>
                Alert.alert("Cancel job", "Cancel this rescue?", [
                  { text: "Keep", style: "cancel" },
                  {
                    text: "Cancel job",
                    style: "destructive",
                    onPress: () => handleJobStatus("cancelled"),
                  },
                ])
              }
              accessibilityRole="button"
              accessibilityLabel="Cancel this rescue"
              className={`py-3 mb-2 items-center justify-center rounded-2xl ${updatingStatus ? "bg-rose-50/50" : "bg-rose-50"}`}
            >
              <Text className="text-xs font-poppin-semibold text-rose-600">
                Cancel job
              </Text>
            </TouchableOpacity>

            <View className="flex-row gap-2 mb-2">
              <TouchableOpacity
                onPress={() => {
                  const phone = activeJob.client_phone?.trim();
                  if (!phone) {
                    Alert.alert("Phone number unavailable", "There is no phone number saved for this client.");
                    return;
                  }
                  void openJobLink(`tel:${phone}`, "call the client");
                }}
                accessibilityRole="button"
                accessibilityLabel="Call client"
                className="flex-1 min-h-16 bg-white rounded-xl items-center justify-center py-2"
              >
                <Ionicons name="call" size={18} color="#4b5563" />
                <Text className="text-[10px] font-poppin-semibold text-gray-700 mt-1">Call client</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => openChat(activeJob)}
                accessibilityRole="button"
                accessibilityLabel="Message client"
                className="flex-1 min-h-16 bg-white rounded-xl items-center justify-center py-2"
              >
                <Ionicons name="chatbubble-ellipses" size={18} color="#4b5563" />
                <Text className="text-[10px] font-poppin-semibold text-gray-700 mt-1">Message client</Text>
              </TouchableOpacity>
            </View>
            <View className="flex-row gap-2 mb-2">
              <TouchableOpacity
                onPress={() => {
                  const url = `https://www.google.com/maps/dir/?api=1&destination=${activeJob.pickup_latitude},${activeJob.pickup_longitude}&travelmode=driving`;
                  void openJobLink(url, "open directions");
                }}
                accessibilityRole="button"
                accessibilityLabel="Navigate to client"
                className="flex-1 min-h-16 bg-white rounded-xl items-center justify-center py-2"
              >
                <Ionicons name="navigate" size={18} color="#111827" />
                <Text className="text-[10px] font-poppin-semibold text-gray-700 mt-1">Directions</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={openAiDiagnosis}
                accessibilityRole="button"
                accessibilityLabel="Open AI diagnosis"
                className="flex-1 min-h-16 bg-white rounded-xl items-center justify-center py-2"
              >
                <Ionicons name="sparkles" size={18} color="#4b5563" />
                <Text className="text-[10px] font-poppin-semibold text-gray-700 mt-1">AI diagnosis</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        ) : (
          <ScrollView
            className="px-5 pt-3"
            showsVerticalScrollIndicator={false}
          >
            <Text className="text-base font-poppin-bold text-gray-900 mb-2">
              Incoming requests
            </Text>
            {!isOnline ? (
              <Text className="text-xs font-poppin text-gray-500 mb-3">
                Go online to receive new jobs.
              </Text>
            ) : null}
            {incoming.length === 0 ? (
              <View className="py-8 items-center">
                <Ionicons name="radio-outline" size={28} color="#9ca3af" />
                <Text className="text-xs font-poppin text-gray-500 mt-2 text-center">
                  No client requests yet. When a driver asks for help, it will
                  appear here for you to accept.
                </Text>
              </View>
            ) : (
              incoming.map((job) => (
                <View
                  key={job.id}
                  className="bg-white rounded-2xl p-3.5 mb-3"
                >
                  <View className="flex-row justify-between items-start">
                    <View className="flex-1 pr-3">
                      <Text className="text-xs font-poppin-semibold text-amber-700 uppercase">
                        {job.rescue_type}
                      </Text>
                      <Text className="text-sm font-poppin-bold text-gray-900 mt-0.5">
                        {job.client_name}
                      </Text>
                      <Text
                        className="text-xs font-poppin text-gray-500 mt-1"
                        numberOfLines={2}
                      >
                        {job.pickup_address || "Pickup location shared"}
                      </Text>
                      <Text className="text-xs font-poppin-medium text-gray-700 mt-1">
                        R {Number(job.estimated_price || 0).toFixed(2)}
                      </Text>
                    </View>
                    <TouchableOpacity
                      disabled={acceptingId === job.id}
                      onPress={() => handleAccept(job)}
                      className="bg-amber-500 px-3.5 py-2.5 rounded-xl"
                    >
                      <Text className="text-xs font-poppin-bold text-gray-950">
                        {acceptingId === job.id ? "..." : "Accept"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </ScrollView>
        )}
      </View>
    </View>
  );
};

export default DispatchScreen;
