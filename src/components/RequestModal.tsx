import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Modal } from '@/components/dialogNative';
import Ionicons from '@react-native-vector-icons/ionicons';
import { RescueRequestRecord } from '@/utils/rescueService';

interface RequestModalProps {
  visible: boolean;
  request: RescueRequestRecord | null;
  distanceKm?: number | null;
  durationMinutes?: number | null;
  routeLoading?: boolean;
  trafficAware?: boolean;
  timeoutSeconds?: number;
  onAccept: (request: RescueRequestRecord) => void;
  onDecline: (request: RescueRequestRecord) => void;
}

export const RequestModal: React.FC<RequestModalProps> = ({
  visible,
  request,
  distanceKm,
  durationMinutes,
  routeLoading = false,
  trafficAware = false,
  timeoutSeconds = 30,
  onAccept,
  onDecline,
}) => {
  const [timeLeft, setTimeLeft] = useState(timeoutSeconds);

  useEffect(() => {
    if (!visible || !request) {
      setTimeLeft(timeoutSeconds);
      return;
    }

    setTimeLeft(timeoutSeconds);
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onDecline(request);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [visible, request?.id]);

  if (!visible || !request) return null;

  const vehicleName = request.vehicle_info || 'Vehicle';

  const issueDesc =
    request.notes ||
    request.battery_action ||
    request.fuel_type ||
    request.rescue_type ||
    'Roadside assistance required';

  const clientName = request.client_name || 'Client';

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header & Timer */}
          <View style={styles.header}>
            <View style={styles.badge}>
              <Ionicons name="flash" size={16} color="#ffffff" />
              <Text style={styles.badgeText}>NEW RESCUE REQUEST</Text>
            </View>
            <View style={styles.timerContainer}>
              <Ionicons name="time-outline" size={16} color="#d97706" />
              <Text style={styles.timerText}>{timeLeft}s</Text>
            </View>
          </View>

          {/* Pricing & Service */}
          <View style={styles.serviceRow}>
            <View>
              <Text style={styles.serviceType}>
                {request.rescue_type === 'diagnostics'
                  ? 'ALL-ROUNDER MECHANIC'
                  : (request.rescue_type || 'Rescue').toUpperCase()}
              </Text>
              <Text style={styles.clientName}>{clientName}</Text>
            </View>
            {request.estimated_price != null && (
              <View style={styles.priceContainer}>
                <Text style={styles.priceText}>
                  {request.rescue_type === 'diagnostics' ? 'Estimate ' : ''}
                  R {Number(request.estimated_price).toFixed(2)}
                </Text>
              </View>
            )}
          </View>

          {/* Details list */}
          <View style={styles.card}>
            <View style={styles.detailRow}>
              <Ionicons name="car" size={18} color="#475569" />
              <Text style={styles.detailText}>{vehicleName}</Text>
              {request.vehicle_plate && (
                <Text style={styles.plateText}>({request.vehicle_plate})</Text>
              )}
            </View>

            <View style={styles.detailRow}>
              <Ionicons name="alert-circle" size={18} color="#e11d48" />
              <Text style={styles.detailText} numberOfLines={2}>
                {issueDesc}
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Ionicons name="location" size={18} color="#059669" />
              <Text style={styles.detailText} numberOfLines={2}>
                {request.pickup_address ||
                  `${request.pickup_latitude.toFixed(4)}, ${request.pickup_longitude.toFixed(4)}`}
              </Text>
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Road distance</Text>
                <Text style={styles.statValue}>
                  {routeLoading ? 'Calculating…' : distanceKm != null ? `${distanceKm.toFixed(1)} km` : 'Unavailable'}
                </Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Road ETA</Text>
                <Text style={styles.statValue}>
                  {routeLoading ? 'Calculating…' : durationMinutes != null ? `${Math.round(durationMinutes)} min` : 'Unavailable'}
                </Text>
              </View>
            </View>
            {(distanceKm != null || durationMinutes != null) && (
              <Text style={styles.routeNote}>
                {trafficAware ? 'Traffic-aware estimate' : 'Route estimate without live traffic'}
              </Text>
            )}
          </View>

          {/* Actions */}
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={styles.declineButton}
              onPress={() => onDecline(request)}
              activeOpacity={0.8}
            >
              <Text style={styles.declineText}>Decline</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.acceptButton}
              onPress={() => onAccept(request)}
              activeOpacity={0.8}
            >
              <Ionicons name="checkmark-circle" size={20} color="#ffffff" style={{ marginRight: 6 }} />
              <Text style={styles.acceptText}>Accept Job</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 36,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dc2626',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  timerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  timerText: {
    color: '#b45309',
    fontWeight: '700',
    fontSize: 14,
  },
  serviceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  serviceType: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
  },
  clientName: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 2,
  },
  priceContainer: {
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  priceText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#059669',
  },
  card: {
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 16,
    gap: 12,
    marginBottom: 20,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  detailText: {
    fontSize: 14,
    color: '#334155',
    flex: 1,
    fontWeight: '500',
  },
  plateText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 6,
    paddingTop: 10,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#ffffff',
    padding: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500',
  },
  statValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 2,
  },
  routeNote: {
    color: '#64748b',
    fontSize: 10,
    textAlign: 'right',
    marginTop: 6,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  declineButton: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  declineText: {
    color: '#64748b',
    fontWeight: '700',
    fontSize: 15,
  },
  acceptButton: {
    flex: 2,
    backgroundColor: '#059669',
    paddingVertical: 14,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 15,
  },
});
