import React, { useState } from 'react';
import { useAuth } from '@clerk/expo';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Alert, Modal } from '@/components/dialogNative';
import Ionicons from '@react-native-vector-icons/ionicons';
import * as ImagePicker from 'expo-image-picker';
import { GeminiDiagnosisResult, runGeminiVehicleDiagnosis } from '@/utils/geminiService';

interface AiDiagnosisModalProps {
  visible: boolean;
  isMechanic: boolean;
  onClose: () => void;
}

export const AiDiagnosisModal: React.FC<AiDiagnosisModalProps> = ({
  visible,
  isMechanic,
  onClose,
}) => {
  const { getToken } = useAuth();
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageMimeType, setImageMimeType] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GeminiDiagnosisResult | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);

  if (!visible) return null;

  if (!isMechanic) {
    return (
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <View style={styles.overlay}>
          <View style={styles.card}>
            <Ionicons name="lock-closed" size={48} color="#ef4444" />
            <Text style={styles.unauthorizedTitle}>Access Restricted</Text>
            <Text style={styles.unauthorizedDesc}>
              AI Diagnosis is only available to registered and verified mechanic accounts.
            </Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  const pickImage = async (useCamera: boolean) => {
    try {
      let res;
      if (useCamera) {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Denied', 'Camera permission is required to take photos.');
          return;
        }
        res = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          base64: true,
          quality: 0.7,
        });
      } else {
        res = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          base64: true,
          quality: 0.7,
        });
      }

      if (!res.canceled && res.assets && res.assets[0]) {
        setImageUri(res.assets[0].uri);
        setImageBase64(res.assets[0].base64 || null);
        setImageMimeType(res.assets[0].mimeType || 'image/jpeg');
        setConversationId(null);
        setResult(null);
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to select image');
    }
  };

  const handleAnalyze = async () => {
    const description = notes.trim();
    const imageToAnalyze = result ? null : imageBase64;
    if (!result && imageUri && !imageBase64) {
      Alert.alert('Photo unavailable', 'This photo could not be prepared for analysis. Remove it and continue with text, or take another photo.');
      return;
    }
    if (!description && !imageToAnalyze) {
      Alert.alert('Describe the issue', 'Add symptoms or attach a photo before requesting guidance.');
      return;
    }

    try {
      setLoading(true);
      const diagnosis = await runGeminiVehicleDiagnosis(
        getToken,
        conversationId,
        imageToAnalyze,
        imageToAnalyze ? imageMimeType : null,
        description,
      );
      setConversationId(diagnosis.conversationId);
      setNotes('');
      setResult(diagnosis);
    } catch (err: any) {
      Alert.alert('Diagnosis Failed', err.message || 'Could not get guidance. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (sev: string) => {
    switch (sev?.toLowerCase()) {
      case 'critical':
        return '#dc2626';
      case 'high':
        return '#ea580c';
      case 'medium':
        return '#d97706';
      case 'low':
      default:
        return '#16a34a';
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardAvoider}
        >
        <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Ionicons name="sparkles" size={22} color="#059669" />
            <Text style={styles.title}>Gemini AI Mechanic Diagnosis</Text>
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={24} color="#64748b" />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scrollBody} showsVerticalScrollIndicator={false}>
          {imageUri ? (
            <View style={styles.previewContainer}>
              <Image source={{ uri: imageUri }} style={styles.previewImage} resizeMode="cover" />
              <TouchableOpacity
                style={styles.retakeBtn}
                onPress={() => {
                  setImageUri(null);
                  setImageBase64(null);
                  setImageMimeType(null);
                  setResult(null);
                }}
              >
                <Ionicons name="trash-outline" size={16} color="#ffffff" />
                <Text style={styles.retakeText}>Remove</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.uploadBox}>
              <Ionicons name="camera-outline" size={44} color="#94a3b8" />
              <Text style={styles.uploadText}>Capture or upload vehicle issue photos</Text>
              <View style={styles.photoActions}>
                <TouchableOpacity
                  style={styles.pickButton}
                  onPress={() => pickImage(true)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="camera" size={18} color="#059669" />
                  <Text style={styles.pickButtonText}>Camera</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.pickButton}
                  onPress={() => pickImage(false)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="images" size={18} color="#059669" />
                  <Text style={styles.pickButtonText}>Gallery</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {!result && (
            <View style={{ width: '100%', marginVertical: 12 }}>
              <Text style={{ fontFamily: 'poppin-medium', fontSize: 12, color: '#475569', marginBottom: 4 }}>
                Vehicle symptoms and observations
              </Text>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                multiline
                placeholder="Describe sounds, warning lights, when it happens, or visible damage"
                placeholderTextColor="#94a3b8"
                style={{
                  backgroundColor: '#f8fafc',
                  borderRadius: 12,
                  padding: 12,
                  minHeight: 88,
                  fontSize: 13,
                  fontFamily: 'poppin',
                  color: '#0f172a',
                }}
              />
            </View>
          )}

          {!result && (
            <TouchableOpacity
              style={[styles.analyzeButton, loading && { opacity: 0.7 }]}
              onPress={handleAnalyze}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <>
                  <Ionicons name="flash" size={18} color="#ffffff" style={{ marginRight: 6 }} />
                  <Text style={styles.analyzeButtonText}>Get mechanic guidance</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {result && (
            <View style={styles.resultCard}>
              <View style={styles.resultHeader}>
                <Text style={styles.resultCauseTitle}>Possible leading cause</Text>
                <View
                  style={[
                    styles.severityBadge,
                    { backgroundColor: `${getSeverityColor(result.severity)}20` },
                  ]}
                >
                  <Text
                    style={[
                      styles.severityText,
                      { color: getSeverityColor(result.severity) },
                    ]}
                  >
                    {result.severity.toUpperCase()} SEVERITY
                  </Text>
                </View>
              </View>
              <Text style={styles.resultCauseText}>{result.likelyCause}</Text>
              <Text style={styles.uncertaintyNote}>This is an AI-assisted possibility, not a confirmed fault.</Text>
              <Text style={styles.resultMessage}>{result.message}</Text>

              {result.urgent || result.urgentWarning ? (
                <View style={styles.safetyWarning}>
                  <Ionicons name="warning" size={18} color="#b91c1c" />
                  <Text style={styles.safetyWarningText}>
                    {result.urgentWarning || 'This may need immediate professional attention. Stop work and prioritize safety.'}
                  </Text>
                </View>
              ) : null}

              {result.possibleCauses.length > 0 ? (
                <>
                  <Text style={styles.sectionHeader}>Possible causes · not confirmed</Text>
                  {result.possibleCauses.map((cause, idx) => (
                    <Text key={idx} style={styles.stepText}>• {cause}</Text>
                  ))}
                </>
              ) : null}

              <Text style={styles.sectionHeader}>Recommended next steps</Text>
              {result.nextSteps.map((step, idx) => (
                <View key={idx} style={styles.stepRow}>
                  <Text style={styles.stepNumber}>{idx + 1}.</Text>
                  <Text style={styles.stepText}>{step}</Text>
                </View>
              ))}

              {result.toolsOrPartsNeeded.length > 0 ? (
                <>
                  <Text style={styles.sectionHeader}>Potential tools and parts</Text>
                  <View style={styles.tagsContainer}>
                    {result.toolsOrPartsNeeded.map((item, idx) => (
                      <View key={idx} style={styles.tag}>
                        <Ionicons name="build" size={12} color="#0284c7" />
                        <Text style={styles.tagText}>{item}</Text>
                      </View>
                    ))}
                  </View>
                </>
              ) : null}

              {result.followUpQuestions.length > 0 ? (
                <>
                  <Text style={styles.sectionHeader}>Useful follow-up checks</Text>
                  {result.followUpQuestions.map((question, idx) => (
                    <Text key={idx} style={styles.stepText}>• {question}</Text>
                  ))}
                </>
              ) : null}

              <TextInput
                value={notes}
                onChangeText={setNotes}
                multiline
                placeholder="Ask a follow-up question"
                placeholderTextColor="#94a3b8"
                style={styles.followUpInput}
              />
              <TouchableOpacity
                style={[styles.followUpButton, loading && { opacity: 0.7 }]}
                onPress={handleAnalyze}
                disabled={loading || !notes.trim()}
              >
                {loading ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.analyzeButtonText}>Continue diagnosis</Text>}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.newDiagnosisButton}
                onPress={() => {
                  setResult(null);
                  setConversationId(null);
                  setImageUri(null);
                  setImageBase64(null);
                  setImageMimeType(null);
                  setNotes('');
                }}
              >
                <Text style={styles.newDiagnosisText}>Start a new diagnosis</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
        </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    padding: 16,
  },
  keyboardAvoider: {
    width: '100%',
    alignItems: 'center',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    width: '100%',
    maxWidth: 380,
  },
  unauthorizedTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 12,
  },
  unauthorizedDesc: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  closeButton: {
    backgroundColor: '#f1f5f9',
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  closeButtonText: {
    fontWeight: '600',
    color: '#334155',
  },
  container: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    width: '100%',
    maxHeight: '85%',
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  scrollBody: {
    paddingBottom: 16,
  },
  uploadBox: {
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
  },
  uploadText: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 8,
    textAlign: 'center',
    marginBottom: 16,
  },
  photoActions: {
    flexDirection: 'row',
    gap: 12,
  },
  pickButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    gap: 6,
  },
  pickButtonText: {
    color: '#059669',
    fontWeight: '600',
    fontSize: 13,
  },
  previewContainer: {
    position: 'relative',
    borderRadius: 16,
    overflow: 'hidden',
    height: 180,
    marginBottom: 16,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  retakeBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    gap: 4,
  },
  retakeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  analyzeButton: {
    backgroundColor: '#059669',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 12,
  },
  analyzeButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 15,
  },
  resultCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  resultCauseTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  severityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  severityText: {
    fontSize: 10,
    fontWeight: '800',
  },
  resultCauseText: {
    fontSize: 14,
    color: '#334155',
    marginBottom: 12,
    lineHeight: 20,
  },
  uncertaintyNote: {
    fontSize: 11,
    color: '#64748b',
    marginTop: -8,
    marginBottom: 10,
  },
  resultMessage: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 19,
    marginBottom: 8,
  },
  safetyWarning: {
    backgroundColor: '#fef2f2',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 12,
  },
  safetyWarningText: {
    color: '#991b1b',
    fontSize: 12,
    lineHeight: 18,
    flex: 1,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
    marginTop: 8,
    marginBottom: 6,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4,
    gap: 6,
  },
  stepNumber: {
    fontWeight: '700',
    color: '#059669',
    fontSize: 13,
  },
  stepText: {
    fontSize: 13,
    color: '#334155',
    flex: 1,
    lineHeight: 18,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  tagText: {
    color: '#0369a1',
    fontSize: 12,
    fontWeight: '500',
  },
  followUpInput: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    minHeight: 72,
    marginTop: 16,
    fontSize: 13,
    fontFamily: 'poppin',
    color: '#0f172a',
  },
  followUpButton: {
    backgroundColor: '#059669',
    minHeight: 44,
    borderRadius: 12,
    marginTop: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  newDiagnosisButton: {
    alignItems: 'center',
    padding: 12,
    marginTop: 4,
  },
  newDiagnosisText: {
    color: '#047857',
    fontSize: 13,
    fontWeight: '600',
  },
});
