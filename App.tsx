import React, { useState, useEffect, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';
import LoginScreen from './src/screens/LoginScreen';
import ToastContainer from './src/components/Toast';
import { View, ActivityIndicator, Animated } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

function SplashScreen() {
  const translateY = useRef(new Animated.Value(30)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const floatY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // 1. Animasi Masuk (Muncul & Naik)
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        friction: 6,
        tension: 40,
        useNativeDriver: true,
      })
    ]).start(() => {
      // 2. Animasi Mengambang (Floating) berkelanjutan
      Animated.loop(
        Animated.sequence([
          Animated.timing(floatY, { toValue: -8, duration: 1500, useNativeDriver: true }),
          Animated.timing(floatY, { toValue: 0, duration: 1500, useNativeDriver: true })
        ])
      ).start();
    });
  }, []);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'white' }}>
      <Animated.View style={{ transform: [{ translateY: Animated.add(translateY, floatY) }], opacity }}>
        <Animated.Image 
          source={require('./assets/EmiTrackLogo2.png')} 
          style={{ width: 320, height: 130 }} 
          resizeMode="contain" 
        />
      </Animated.View>
      <Animated.View style={{ transform: [{ translateY }], opacity, marginTop: 40 }}>
        <ActivityIndicator size="large" color="#1D9E75" />
      </Animated.View>
    </View>
  );
}

function RootNavigator() {
  const { user, loading } = useAuth();
  const [minDelayPassed, setMinDelayPassed] = useState(false);

  useEffect(() => {
    // Memberikan waktu minimum 2 detik agar animasi loading screen terlihat bagus
    const timer = setTimeout(() => {
      setMinDelayPassed(true);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  if (loading || !minDelayPassed) {
    return <SplashScreen />;
  }

  if (!user) {
    return <LoginScreen />;
  }

  return <AppNavigator />;
}

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
