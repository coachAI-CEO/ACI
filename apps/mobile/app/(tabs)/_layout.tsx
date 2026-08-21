import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { colors } from '../../constants/colors';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarAccessibilityLabel: 'Home tab',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons color={color} name={focused ? 'home' : 'home-outline'} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="generate"
        options={{
          title: 'Generate',
          tabBarAccessibilityLabel: 'Generate tab',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons color={color} name={focused ? 'sparkles' : 'sparkles-outline'} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="vault"
        options={{
          title: 'Vault',
          tabBarAccessibilityLabel: 'Vault tab',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons color={color} name={focused ? 'folder-open' : 'folder-outline'} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="video"
        options={{
          title: 'Video',
          tabBarAccessibilityLabel: 'Video tab',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons color={color} name={focused ? 'videocam' : 'videocam-outline'} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: 'Calendar',
          tabBarAccessibilityLabel: 'Calendar tab',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons color={color} name={focused ? 'calendar' : 'calendar-outline'} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
