import React from 'react';
import { View, Text, ScrollView, StatusBar, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Ionicons from "@react-native-vector-icons/ionicons";

export default function AboutScreen() {
  const router = useRouter();
  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <StatusBar barStyle="dark-content" />
      <View className="flex-row items-center px-5 py-3">
        <TouchableOpacity onPress={() => router.back()} className="mr-3">
          <Ionicons name="chevron-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text className="text-lg font-poppin-bold text-gray-900">About ResQ Mechanic</Text>
      </View>
      <ScrollView className="px-5" contentContainerStyle={{ paddingBottom: 32 }}>
        <Text className="text-sm font-poppin text-gray-600 leading-6">
          ResQ Mechanic is the responder app. Go online on Dispatch to see client rescue requests. Accept a job, drive
          with live GPS (clients see your vehicle moving), mark arrived, start the job, then complete it.
        </Text>
        <Text className="text-sm font-poppin-semibold text-gray-900 mt-5 mb-1">Tabs</Text>
        <Text className="text-sm font-poppin text-gray-600 leading-6">
          Dispatch — incoming jobs and navigation to the customer.{'\n'}
          My Vehicle — service vehicle and documents.{'\n'}
          Earnings — completed job totals.{'\n'}
          Profile — account, notifications, and sign out.
        </Text>
        <Text className="text-xs font-poppin text-gray-400 mt-8">Version 1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}
