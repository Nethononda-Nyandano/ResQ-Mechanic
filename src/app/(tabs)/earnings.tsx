import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { Alert } from '@/components/dialogNative';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import Header from '@/components/header';
import Ionicons from "@react-native-vector-icons/ionicons";
import { useUser } from '@clerk/expo';
import { useFocusEffect } from 'expo-router';
import { getRescuerByUserId } from '@/utils/mechanicService';
import { getRescuerHistory, RescueRequestRecord } from '@/utils/rescueService';

const Earnings = () => {
  const { user } = useUser();
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<RescueRequestRecord[]>([]);
  const [total, setTotal] = useState(0);

  const load = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data: rescuer } = await getRescuerByUserId(user.id);
    if (!rescuer?.id) {
      setJobs([]);
      setTotal(0);
      setLoading(false);
      return;
    }
    const { data } = await getRescuerHistory(rescuer.id);
    const list = data || [];
    setJobs(list);
    setTotal(list.reduce((sum, job) => sum + Number(job.estimated_price || 0), 0));
    setLoading(false);
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <>
      <StatusBar style="dark" />
      <SafeAreaView style={{ flex: 1 }}>
        <View className="flex-1 bg-gray-50">
          <Header title={'Earnings'} />
          <ScrollView className="flex-1 bg-gray-50 px-6 py-3" showsVerticalScrollIndicator={false}>
            <View className="bg-gray-800 rounded-2xl p-6 mt-5">
              <Text className="font-poppin text-white/60">Completed rescue earnings</Text>
              {loading ? (
                <ActivityIndicator color="#fff" className="mt-6" />
              ) : (
                <Text className="text-5xl mt-2 font-poppin-bold text-white">R {total.toFixed(2)}</Text>
              )}
              <Text className="text-xs font-poppin text-white/50 mt-2">
                {jobs.length} completed {jobs.length === 1 ? 'job' : 'jobs'}
              </Text>
              <TouchableOpacity
                onPress={() =>
                  Alert.alert(
                    'Withdrawals',
                    'Payouts are settled weekly to the bank account on your verified mechanic profile.'
                  )
                }
                className="mt-5 bg-amber-600 flex-row gap-0.5 items-center justify-center h-12 rounded-2xl"
              >
                <Ionicons name="paper-plane" color={'white'} />
                <Text className="text-white font-poppin-bold"> Withdraw</Text>
              </TouchableOpacity>
            </View>

            <Text className="text-sm font-poppin-bold text-gray-900 mt-6 mb-2">Recent jobs</Text>
            {jobs.length === 0 && !loading ? (
              <Text className="text-xs font-poppin text-gray-500">
                Completed rescues will appear here with the amount earned.
              </Text>
            ) : (
              jobs.slice(0, 20).map((job) => (
                <View key={job.id} className="bg-white rounded-2xl p-3.5 mb-2">
                  <View className="flex-row justify-between">
                    <Text className="text-xs font-poppin-semibold text-amber-700 uppercase">{job.rescue_type}</Text>
                    <Text className="text-sm font-poppin-bold text-gray-900">
                      R {Number(job.estimated_price || 0).toFixed(2)}
                    </Text>
                  </View>
                  <Text className="text-xs font-poppin-medium text-gray-800 mt-1">{job.client_name}</Text>
                  <Text className="text-[11px] font-poppin text-gray-500 mt-0.5" numberOfLines={1}>
                    {job.pickup_address || 'Pickup completed'}
                  </Text>
                </View>
              ))
            )}
          </ScrollView>
        </View>
      </SafeAreaView>
    </>
  );
};
export default Earnings;
