import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, View } from 'react-native';
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
  Lineup: 'list',
  Team: 'people',
  Chat: 'chatbubbles',
  Account: 'person',
};

function headerOpts(primaryColor) {
  return {
    headerStyle: { backgroundColor: primaryColor },
    headerTintColor: '#fff',
    headerTitleStyle: { textTransform: 'uppercase', letterSpacing: 2, fontSize: 15 },
    headerBackTitleVisible: false,
  };
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
        tabBarIcon: ({ color, size }) => (
          <Ionicons name={(TAB_ICONS[tabRoute.name] || 'list') + '-outline'} size={size} color={color} />
        ),
      })}
    >
      <Tab.Screen
        name="Lineup"
        component={LineupScreen}
        initialParams={{ teamId, primaryColor, teamName }}
      />
      <Tab.Screen name="Team" component={TeamHubScreen} initialParams={{ teamId, primaryColor, teamName }} options={{ headerTitle: 'Team' }} />
      <Tab.Screen name="Chat" component={ChatScreen} initialParams={{ teamId, primaryColor }} />
      <Tab.Screen name="Account" component={SettingsScreen} initialParams={{ teamId, primaryColor }} options={{ headerTitle: 'Account' }} />
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
            <Stack.Screen name="TeamHistory" component={HistoryScreen} options={({ route }) => ({ headerShown: true, headerTitle: 'History', ...headerOpts(route.params?.primaryColor) })} />
            <Stack.Screen name="TeamRoster" component={RosterScreen} options={({ route }) => ({ headerShown: true, headerTitle: 'Roster', ...headerOpts(route.params?.primaryColor) })} />
            <Stack.Screen name="TeamSchedule" component={ScheduleScreen} options={({ route }) => ({ headerShown: true, headerTitle: 'Schedule', ...headerOpts(route.params?.primaryColor) })} />
            <Stack.Screen name="TeamStats" component={StatsScreen} options={({ route }) => ({ headerShown: true, headerTitle: 'Stats', ...headerOpts(route.params?.primaryColor) })} />
            <Stack.Screen name="PlayerProfile" component={ProfileScreen} options={({ route }) => ({ headerShown: true, headerTitle: 'Profile', ...headerOpts(route.params?.primaryColor) })} />
            <Stack.Screen
              name="Admin"
              component={AdminScreen}
              options={{ headerShown: true, headerTitle: 'Admin', ...headerOpts('#1a1a1a') }}
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
