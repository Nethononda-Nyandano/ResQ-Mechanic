import { MechanicProvider } from "@/context/MechanicContext";
import Ionicons from "@react-native-vector-icons/ionicons";
import { Tabs } from "expo-router";
import "../../../global.css";

export default function MechanicTabLayout() {
  return (
    <MechanicProvider>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: "#101828",
          tabBarInactiveTintColor: "#6b7280",
          tabBarStyle: {
            backgroundColor: "#f9fafb",
            height: 64,
            paddingBottom: 8,
            paddingTop: 8,
          },
          tabBarLabelStyle: {
            fontFamily: "poppin-medium",
            fontSize: 11,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Dispatch",
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? "home" : "home-outline"}
                size={22}
                color={color as string}
              />
            ),
          }}
        />

        <Tabs.Screen
          name="vehicle"
          options={{
            title: "My Vehicle",
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? "car" : "car-outline"}
                size={22}
                color={color as string}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="earnings"
          options={{
            title: "Earnings",
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? "wallet" : "wallet-outline"}
                size={22}
                color={color as string}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: "Profile",
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? "person" : "person-outline"}
                size={22}
                color={color as string}
              />
            ),
          }}
        />
      </Tabs>
    </MechanicProvider>
  );
}
