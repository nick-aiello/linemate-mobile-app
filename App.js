import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Image, View } from 'react-native';
import { BASE_URL } from './src/api/client';
import { AuthProvider, useAuth } from './src/hooks/useAuth';
import { usePushNotifications } from './src/hooks/usePushNotifications';

import LoginScreen from './src/screens/LoginScreen';
import SignupScreen from './src/screens/SignupScreen';
import TeamPickerScreen from './src/screens/TeamPickerScreen';
import LineupScreen from './src/screens/LineupScreen';
import TeamHubScreen from './src/screens/TeamHubScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import ChatScreen from './src/screens/ChatScreen';
import ScheduleScreen from './src/screens/ScheduleScreen';
import StatsScreen from './src/screens/StatsScreen';
import RosterScreen from './src/screens/RosterScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import AdminScreen from './src/screens/AdminScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const TAB_ICONS = {
  Team: 'people',
  Lineup: 'list',
  Chat: 'chatbubbles',
  Account: 'person',
};

function headerOpts(primaryColor) {
  return {
    headerStyle: { backgroundColor: primaryColor },
    headerTintColor: '#fff',
    headerTitleStyle: { letterSpacing: 2, fontSize: 15, fontWeight: '600' },
  };
}


function TeamLogo({ teamId }) {
  return (
    <Image
      source={{ uri: `${BASE_URL}/${teamId}/logo/main` }}
      style={{ height: 30, width: 120 }}
      resizeMode="contain"
    />
  );
}

function TeamTabs({ route }) {
  const { teamId, teamName, primaryColor = '#c0392b' } = route.params;
  return (
    <Tab.Navigator
      screenOptions={({ route: tabRoute }) => ({
        tabBarActiveTintColor: primaryColor,
        tabBarInactiveTintColor: '#999',
        tabBarStyle: { borderTopColor: '#e0ddd8', backgroundColor: '#fff' },
        tabBarLabelStyle: { fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
        ...headerOpts(primaryColor),
        headerTitle: () => <TeamLogo teamId={teamId} />,
        tabBarIcon: ({ color, size }) => (
          <Ionicons name={(TAB_ICONS[tabRoute.name] || 'list') + '-outline'} size={size} color={color} />
        ),
      })}
    >
      <Tab.Screen name="Team" component={TeamHubScreen} initialParams={{ teamId, primaryColor, teamName }} />
      <Tab.Screen name="Lineup" component={LineupScreen} initialParams={{ teamId, primaryColor, teamName }} />
      <Tab.Screen name="Chat" component={ChatScreen} initialParams={{ teamId, primaryColor }} />
      <Tab.Screen name="Account" component={SettingsScreen} initialParams={{ teamId, primaryColor }} />
    </Tab.Navigator>
  );
}

function AppNavigator() {
  const { user, loading } = useAuth();
  usePushNotifications(user);

  if (loading) {
    return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator color="#c0392b" /></View>;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!user ? (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Signup" component={SignupScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name="Teams" component={TeamPickerScreen} />
            <Stack.Screen name="Team" component={TeamTabs} />
            <Stack.Screen name="TeamHistory" component={HistoryScreen} options={{ headerShown: false }} />
            <Stack.Screen name="TeamRoster" component={RosterScreen} options={{ headerShown: false }} />
            <Stack.Screen name="TeamSchedule" component={ScheduleScreen} options={{ headerShown: false }} />
            <Stack.Screen name="TeamStats" component={StatsScreen} options={{ headerShown: false }} />
            <Stack.Screen name="PlayerProfile" component={ProfileScreen} options={{ headerShown: false }} />
            <Stack.Screen
              name="Admin"
              component={AdminScreen}
              options={{ headerShown: true, headerTitle: 'ADMIN', headerLargeTitle: false, ...headerOpts('#1a1a1a') }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppNavigator />
    </AuthProvider>
  );
}
