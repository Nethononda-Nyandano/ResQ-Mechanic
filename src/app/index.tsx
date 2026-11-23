import React from 'react';
import { View, ActivityIndicator, Image, Text } from 'react-native';
import { StatusBar } from 'expo-status-bar';


export default function Index() {
  return (
    <View className="flex-1 items-center justify-center bg-gray-50">
      <StatusBar style="dark" />
      <Image
        source={require('@/assets/images/logo4.png')}
        className="w-44 h-24"
        resizeMode="contain"
      />
      <View className="flex-row items-center px-3 py-1 rounded-full">
        <Text className="text-gray-800 text-xs font-poppin-semibold tracking-wider">
          Mechanic Portal
        </Text>
      </View>
      <ActivityIndicator size="small" color="#111827" className="mt-6" />
    </View>
  );
}
