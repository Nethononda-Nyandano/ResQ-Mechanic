import { supabase } from '@/utils/supabase';
import { getDiagnosisFunctionErrorMessage } from './diagnosisFunctionErrors';

export interface GeminiDiagnosisResult {
  conversationId: string;
  message: string;
  likelyCause: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  possibleCauses: string[];
  followUpQuestions: string[];
  nextSteps: string[];
  suggestedFixSteps: string[];
  toolsOrPartsNeeded: string[];
  urgent: boolean;
  notes?: string;
  urgentWarning?: string | null;
}

export async function runGeminiVehicleDiagnosis(
  getToken: () => Promise<string | null>,
  conversationId: string | null,
  imageBase64: string | null,
  mimeType: string | null,
  description: string,
): Promise<GeminiDiagnosisResult> {
  const token = await getToken();
  if (!token) throw new Error('Your session is invalid or expired. Please sign in again.');

  const { data, error } = await supabase.functions.invoke('diagnosis', {
    body: {
      action: 'diagnose',
      audience: 'mechanic',
      conversationId,
      message: description,
      imageBase64: imageBase64 || undefined,
      imageMimeType: imageBase64 ? mimeType || 'image/jpeg' : undefined,
    },
    headers: { Authorization: `Bearer ${token}` },
  });

  if (error) {
    throw new Error(await getDiagnosisFunctionErrorMessage(error));
  }

  const response = data?.assistantMessage?.response;
  if (!data?.conversationId || !response) {
    throw new Error('The diagnosis service returned an incomplete response. Please try again.');
  }

  return {
    conversationId: data.conversationId,
    message: response.message || data.assistantMessage.text,
    likelyCause: response.likelyCause || 'No single cause can be confirmed from the available information.',
    severity: response.severity || (response.urgent ? 'high' : 'medium'),
    possibleCauses: response.possibleCauses || [],
    followUpQuestions: response.followUpQuestions || [],
    nextSteps: response.nextSteps || [],
    suggestedFixSteps: response.nextSteps || [],
    toolsOrPartsNeeded: response.toolsOrPartsNeeded || [],
    urgent: response.urgent === true,
    urgentWarning: response.urgentWarning || null,
    notes: response.message || undefined,
  };
}
