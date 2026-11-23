import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useUser } from '@clerk/expo';
import {
  getActiveRescueRequest,
  getOpenRescueRequests,
  RescueRequestRecord,
  subscribeToRescueRequestChanges,
  acceptRescueRequest,
} from '@/utils/rescueService';
import { getRescuerByUserId } from '@/utils/mechanicService';
import { RequestModal } from '@/components/RequestModal';
import { AiDiagnosisModal } from '@/components/AiDiagnosisModal';
import { RescueChatModal } from '@/components/RescueChatModal';
import { Alert } from '@/components/dialogNative';
import { getAutoLocation } from '@/utils/locationService';
import { fetchDrivingRoute } from '@/utils/googleMaps';
import type { DrivingRouteEstimate } from '@/utils/routeEstimate';

interface MechanicContextType {
  rescuerId: string | null;
  activeJob: RescueRequestRecord | null;
  refreshJobs: () => Promise<void>;
  openAiDiagnosis: () => void;
  openChat: (job?: RescueRequestRecord) => void;
  setActiveJob: (job: RescueRequestRecord | null) => void;
  activeRouteEstimate: DrivingRouteEstimate | null;
  activeRouteLoading: boolean;
}

const MechanicContext = createContext<MechanicContextType>({
  rescuerId: null,
  activeJob: null,
  refreshJobs: async () => {},
  openAiDiagnosis: () => {},
  openChat: () => {},
  setActiveJob: () => {},
  activeRouteEstimate: null,
  activeRouteLoading: false,
});

export const useMechanic = () => useContext(MechanicContext);

export const MechanicProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useUser();
  const [rescuerId, setRescuerId] = useState<string | null>(null);
  const [activeJob, setActiveJob] = useState<RescueRequestRecord | null>(null);
  const [modalRequest, setModalRequest] = useState<RescueRequestRecord | null>(null);
  const [showAiModal, setShowAiModal] = useState(false);
  const [showChatModal, setShowChatModal] = useState(false);
  const [chatRequest, setChatRequest] = useState<RescueRequestRecord | null>(null);
  const [declinedIds, setDeclinedIds] = useState<string[]>([]);
  const [requestRoute, setRequestRoute] = useState<DrivingRouteEstimate | null>(null);
  const [requestRouteLoading, setRequestRouteLoading] = useState(false);

  const refreshJobs = useCallback(async () => {
    if (!rescuerId) return;
    const [openResult, activeResult] = await Promise.all([
      getOpenRescueRequests(),
      getActiveRescueRequest(rescuerId),
    ]);
    if (activeResult.error) {
      console.warn('Could not refresh the active rescue request:', activeResult.error);
      return;
    }
    const { data: active } = activeResult;
    setActiveJob(active);
    if (openResult.error) {
      console.warn('Could not refresh incoming rescue requests:', openResult.error);
      if (active) setModalRequest(null);
      return;
    }
    const { data: open } = openResult;

    if (!active && open && open.length > 0) {
      const pending = open.find((req) => !declinedIds.includes(req.id));
      if (pending && (!modalRequest || modalRequest.id !== pending.id)) {
        setModalRequest(pending);
      }
    } else if (active) {
      setModalRequest(null);
    }
  }, [rescuerId, declinedIds, modalRequest]);

  useEffect(() => {
    if (!user?.id) return;
    getRescuerByUserId(user.id).then(({ data }) => {
      if (data?.id) {
        setRescuerId(data.id);
      }
    });
  }, [user?.id]);

  useEffect(() => {
    if (!rescuerId) return;
    refreshJobs();
    const unsub = subscribeToRescueRequestChanges(() => {
      refreshJobs();
    });
    const interval = setInterval(refreshJobs, 6000);
    return () => {
      unsub();
      clearInterval(interval);
    };
  }, [rescuerId, refreshJobs]);

  useEffect(() => {
    let cancelled = false;
    let requestInFlight = false;
    setRequestRoute(null);
    const routeRequest = modalRequest || activeJob;
    if (!routeRequest) {
      setRequestRouteLoading(false);
      return;
    }

    const calculateRoute = async () => {
      if (requestInFlight) return;
      requestInFlight = true;
      setRequestRouteLoading(true);
      try {
        const mechanicLocation = await getAutoLocation();
        if (mechanicLocation) {
          const route = await fetchDrivingRoute(
            mechanicLocation.latitude,
            mechanicLocation.longitude,
            routeRequest.pickup_latitude,
            routeRequest.pickup_longitude,
          );
          if (!cancelled) setRequestRoute(route);
        } else if (!cancelled) {
          setRequestRoute(null);
        }
      } catch (error) {
        console.warn('Could not calculate the incoming rescue route:', error);
        if (!cancelled) setRequestRoute(null);
      } finally {
        requestInFlight = false;
        if (!cancelled) setRequestRouteLoading(false);
      }
    };

    void calculateRoute();
    const interval = activeJob && !modalRequest
      ? setInterval(() => void calculateRoute(), 30000)
      : null;

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
  }, [modalRequest?.id, activeJob?.id]);

  const handleAcceptModal = async (req: RescueRequestRecord) => {
    if (!rescuerId) return;
    setModalRequest(null);
    const result = await acceptRescueRequest(req.id, rescuerId);
    if (!result.success) {
      Alert.alert('Could not accept', result.error?.message || 'This job may already have been taken.');
      refreshJobs();
      return;
    }
    setActiveJob(result.data || req);
  };

  const handleDeclineModal = (req: RescueRequestRecord) => {
    setDeclinedIds((prev) => [...prev, req.id]);
    setModalRequest(null);
  };

  return (
    <MechanicContext.Provider
      value={{
        rescuerId,
        activeJob,
        refreshJobs,
        activeRouteEstimate: activeJob ? requestRoute : null,
        activeRouteLoading: Boolean(activeJob && requestRouteLoading),
        openAiDiagnosis: () => setShowAiModal(true),
        openChat: (job) => {
          const selectedJob = job || activeJob;
          if (!selectedJob) return;
          setChatRequest(selectedJob);
          setShowChatModal(true);
        },
        setActiveJob,
      }}
    >
      {children}

      <RequestModal
        visible={Boolean(modalRequest && !activeJob)}
        request={modalRequest}
        distanceKm={requestRoute?.distanceKm ?? null}
        durationMinutes={requestRoute?.durationMinutes ?? null}
        routeLoading={requestRouteLoading}
        trafficAware={requestRoute?.trafficAware ?? false}
        timeoutSeconds={30}
        onAccept={handleAcceptModal}
        onDecline={handleDeclineModal}
      />

      <AiDiagnosisModal
        visible={showAiModal}
        isMechanic={Boolean(rescuerId)}
        onClose={() => setShowAiModal(false)}
      />

      {chatRequest && (
        <RescueChatModal
          visible={showChatModal}
          rescueRequestId={chatRequest.id}
          currentUserId={rescuerId || user?.id || ''}
          currentUserRole="mechanic"
          otherPartyName={chatRequest.client_name || 'Customer'}
          onClose={() => {
            setShowChatModal(false);
            setChatRequest(null);
          }}
        />
      )}
    </MechanicContext.Provider>
  );
};
