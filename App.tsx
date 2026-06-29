import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';
import LoginScreen from './src/screens/LoginScreen';
import ToastContainer from './src/components/Toast';
import { View, ActivityIndicator, Text } from 'react-native';

function RootNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' }}>
        <ActivityIndicator size="large" color="#1D9E75" />
        <Text style={{ marginTop: 12, color: '#6B7280', fontSize: 13 }}>Memuat...</Text>
      </View>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  return <AppNavigator />;
}

import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NavigationContainer>
          <StatusBar style="dark" />
          <RootNavigator />
          <ToastContainer />
        </NavigationContainer>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
