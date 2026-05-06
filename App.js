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
import ShareScreen from './src/screens/ShareScreen';
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
const TeamStack = createNativeStackNavigator();
const AccountStack = createNativeStackNavigator();

const TAB_ICONS = {
  Lineup: 'list',
  Share: 'share-social',
  Team: 'people',
  Chat: 'chatbubbles',
  Account: 'person',
};

function TeamHubNavigator({ route }) {
  const { teamId, teamName, primaryColor = '#c0392b' } = route.params;
  const headerOpts = {
    headerStyle: { backgroundColor: primaryColor },
    headerTintColor: '#fff',
    headerTitleStyle: { textTransform: 'uppercase', letterSpacing: 2, fontSize: 15 },
  };
  return (
    <TeamStack.Navigator screenOptions={headerOpts}>
      <TeamStack.Screen
        name="TeamHub"
        component={TeamHubScreen}
        initialParams={{ teamId, teamName, primaryColor }}
        options={{ headerTitle: teamName }}
      />
      <TeamStack.Screen
        name="TeamHistory"
        component={HistoryScreen}
        initialParams={{ teamId, primaryColor }}
        options={{ headerTitle: 'Lineup History' }}
      />
      <TeamStack.Screen
        name="TeamRoster"
        component={RosterScreen}
        initialParams={{ teamId, primaryColor }}
        options={{ headerTitle: 'Roster' }}
      />
      <TeamStack.Screen
        name="TeamSchedule"
        component={ScheduleScreen}
        initialParams={{ teamId, primaryColor, teamName }}
        options={{ headerTitle: 'Schedule' }}
      />
      <TeamStack.Screen
        name="TeamStats"
        component={StatsScreen}
        initialParams={{ teamId, primaryColor }}
        options={{ headerTitle: 'Stats' }}
      />
    </TeamStack.Navigator>
  );
}

function AccountNavigator({ route }) {
  const { teamId, primaryColor = '#c0392b' } = route.params;
  const headerOpts = {
    headerStyle: { backgroundColor: primaryColor },
    headerTintColor: '#fff',
    headerTitleStyle: { textTransform: 'uppercase', letterSpacing: 2, fontSize: 15 },
  };
  return (
    <AccountStack.Navigator screenOptions={headerOpts}>
      <AccountStack.Screen
        name="AccountSettings"
        component={SettingsScreen}
        initialParams={{ teamId, primaryColor }}
        options={{ headerTitle: 'Account' }}
      />
      <AccountStack.Screen
        name="PlayerProfile"
        component={ProfileScreen}
        initialParams={{ teamId, primaryColor }}
        options={{ headerTitle: 'My Profile' }}
      />
    </AccountStack.Navigator>
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
        headerStyle: { backgroundColor: primaryColor },
        headerTintColor: '#fff',
        headerTitleStyle: { textTransform: 'uppercase', letterSpacing: 2, fontSize: 15 },
        headerTitle: teamName,
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
      <Tab.Screen
        name="Share"
        component={ShareScreen}
        initialParams={{ teamId, primaryColor, teamName }}
      />
      <Tab.Screen
        name="Team"
        component={TeamHubNavigator}
        initialParams={{ teamId, primaryColor, teamName }}
        options={{ headerShown: false }}
      />
      <Tab.Screen
        name="Chat"
        component={ChatScreen}
        initialParams={{ teamId, primaryColor }}
      />
      <Tab.Screen
        name="Account"
        component={AccountNavigator}
        initialParams={{ teamId, primaryColor }}
        options={{ headerShown: false }}
      />
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
            <Stack.Screen
              name="Admin"
              component={AdminScreen}
              options={{
                headerShown: true,
                headerTitle: 'Admin',
                headerStyle: { backgroundColor: '#1a1a1a' },
                headerTintColor: '#fff',
                headerTitleStyle: { textTransform: 'uppercase', letterSpacing: 2, fontSize: 15 },
              }}
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
