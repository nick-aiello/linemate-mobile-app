import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, View } from 'react-native';

import { AuthProvider, useAuth } from './src/hooks/useAuth';
import { usePushNotifications } from './src/hooks/usePushNotifications';

import LoginScreen from './src/screens/LoginScreen';
import TeamPickerScreen from './src/screens/TeamPickerScreen';
import LineupScreen from './src/screens/LineupScreen';
import ChatScreen from './src/screens/ChatScreen';
import ScheduleScreen from './src/screens/ScheduleScreen';
import RosterScreen from './src/screens/RosterScreen';
import SettingsScreen from './src/screens/SettingsScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function TeamTabs({ route }) {
  const { teamId, teamName, primaryColor = '#c0392b' } = route.params;
  return (
    <Tab.Navigator
      screenOptions={({ route: tabRoute }) => ({
        tabBarActiveTintColor: primaryColor,
        tabBarInactiveTintColor: '#999',
        tabBarStyle: { borderTopColor: '#e0ddd8' },
        headerStyle: { backgroundColor: primaryColor },
        headerTintColor: '#fff',
        headerTitle: teamName,
        tabBarIcon: ({ color, size }) => {
          const icons = { Lineup: 'list', Chat: 'chatbubbles', Schedule: 'calendar', Roster: 'people', Settings: 'settings' };
          return <Ionicons name={icons[tabRoute.name] + '-outline'} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Lineup" component={LineupScreen} initialParams={{ teamId, primaryColor }} />
      <Tab.Screen name="Chat" component={ChatScreen} initialParams={{ teamId, primaryColor }} />
      <Tab.Screen name="Schedule" component={ScheduleScreen} initialParams={{ teamId, primaryColor }} />
      <Tab.Screen name="Roster" component={RosterScreen} initialParams={{ teamId, primaryColor }} />
      <Tab.Screen name="Settings" component={SettingsScreen} initialParams={{ teamId, primaryColor }} />
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
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : (
          <>
            <Stack.Screen name="Teams" component={TeamPickerScreen} />
            <Stack.Screen name="Team" component={TeamTabs} />
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
