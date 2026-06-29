import React, { useRef, useState } from 'react';
import { View, Text, Dimensions, Animated, PanResponder, TouchableOpacity } from 'react-native';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Home, Map, Trophy, User } from 'lucide-react-native';

import DashboardScreen from '../screens/DashboardScreen';
import MapScreen from '../screens/MapScreen';
import LeaderboardScreen from '../screens/LeaderboardScreen';
import ProfileScreen from '../screens/ProfileScreen';
import KalkulatorScreen from '../screens/KalkulatorScreen';
import EdukasiScreen from '../screens/EdukasiScreen';
import RiwayatScreen from '../screens/RiwayatScreen';

const Tab = createMaterialTopTabNavigator();
const Stack = createNativeStackNavigator();

const { width: windowWidth } = Dimensions.get('window');
const TAB_BAR_MARGIN_LEFT = 32;
const TAB_BAR_WIDTH = windowWidth - (TAB_BAR_MARGIN_LEFT * 2);
const TAB_WIDTH = TAB_BAR_WIDTH / 4;
const INDICATOR_WIDTH = 64;
const INDICATOR_MARGIN = (TAB_WIDTH - INDICATOR_WIDTH) / 2;

function CustomTabBar({ state, descriptors, navigation, position }: any) {
  const bubbleX = useRef(new Animated.Value(state.index * TAB_WIDTH)).current;
  const lastDragX = useRef(0);

  // 1. TAMBAHKAN DUA REF INI UNTUK MENCEGAH STALE CLOSURE
  const stateRef = useRef(state);
  const navRef = useRef(navigation);

  // 2. SELALU PERBARUI REF SETIAP KALI PINDAH TAB
  React.useEffect(() => {
    stateRef.current = state;
    navRef.current = navigation;
  }, [state, navigation]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        return Math.abs(gestureState.dx) > 5;
      },
      onPanResponderGrant: (evt) => {
        let x = evt.nativeEvent.pageX - TAB_BAR_MARGIN_LEFT - INDICATOR_MARGIN - (INDICATOR_WIDTH / 2);
        const maxTranslateX = TAB_BAR_WIDTH - INDICATOR_WIDTH - (INDICATOR_MARGIN * 2);
        if (x < 0) x = 0;
        if (x > maxTranslateX) x = maxTranslateX;

        bubbleX.setValue(x);
        lastDragX.current = x;
      },
      onPanResponderMove: (evt, gestureState) => {
        let x = gestureState.moveX - TAB_BAR_MARGIN_LEFT - INDICATOR_MARGIN - (INDICATOR_WIDTH / 2);
        const maxTranslateX = TAB_BAR_WIDTH - INDICATOR_WIDTH - (INDICATOR_MARGIN * 2);
        if (x < 0) x = 0;
        if (x > maxTranslateX) x = maxTranslateX;

        bubbleX.setValue(x);
        lastDragX.current = x;
      },
      onPanResponderRelease: (evt, gestureState) => {
        // 3. GUNAKAN DATA DARI REF, BUKAN DATA LAMA
        const currentState = stateRef.current;
        const currentNav = navRef.current;

        let index = Math.round(lastDragX.current / TAB_WIDTH);
        if (index < 0) index = 0;
        if (index >= currentState.routes.length) index = currentState.routes.length - 1;

        Animated.spring(bubbleX, {
          toValue: index * TAB_WIDTH,
          useNativeDriver: false,
          friction: 7,
          tension: 40
        }).start();

        // 4. CEK MENGGUNAKAN currentState.index
        if (index !== currentState.index) {
          const targetRoute = currentState.routes[index];
          const event = currentNav.emit({
            type: 'tabPress',
            target: targetRoute.key,
            canPreventDefault: true,
          });

          if (!event.defaultPrevented) {
            currentNav.navigate({ name: targetRoute.name, merge: true });
          }
        }
      },
      onPanResponderTerminate: () => {
        // 5. PASTIKAN GELEMBUNG KEMBALI KE POSISI ASLI JIKA SWIPE BATAL
        let index = stateRef.current.index;
        Animated.spring(bubbleX, {
          toValue: index * TAB_WIDTH,
          useNativeDriver: false,
          friction: 7,
          tension: 40
        }).start();
      }
    })
  ).current;

  React.useEffect(() => {
    Animated.spring(bubbleX, {
      toValue: state.index * TAB_WIDTH,
      useNativeDriver: false,
      friction: 7,
      tension: 40
    }).start();
  }, [state.index]);

  const focusedOptions = descriptors[state.routes[state.index].key].options;
  if (focusedOptions.tabBarStyle?.display === 'none') {
    return null;
  }

  const { BlurView } = require('expo-blur');
  const { useSafeAreaInsets } = require('react-native-safe-area-context');
  const insets = useSafeAreaInsets();

  const AnimatedBlurView = Animated.createAnimatedComponent(BlurView);

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={{
        position: 'absolute',
        bottom: insets.bottom + 16,
        left: TAB_BAR_MARGIN_LEFT,
        right: TAB_BAR_MARGIN_LEFT,
        height: 64,
        borderRadius: 32,
        overflow: 'hidden',
        borderColor: 'rgba(0,0,0,0.1)',
        borderWidth: 1,
      }}
    >
      <BlurView
        intensity={100}
        tint="light"
        style={{
          flex: 1,
          backgroundColor: 'rgba(255, 255, 255, 0.85)',
          flexDirection: 'row',
          alignItems: 'center',
        }}
      >
        {/* Gelembung Utama yang melayang mulus */}
        <AnimatedBlurView
          intensity={50}
          tint="light"
          style={{
            position: 'absolute',
            bottom: 8,
            left: INDICATOR_MARGIN,
            width: INDICATOR_WIDTH,
            height: 48,
            borderRadius: 24,
            backgroundColor: 'rgba(29, 158, 117, 0.2)',
            overflow: 'hidden',
            transform: [{ translateX: bubbleX }],
          }}
        />

        {/* Ikon & Teks Menu */}
        {state.routes.map((route: any, index: number) => {
          const isFocused = state.index === index;

          let IconComponent = Home;
          if (route.name === 'Peta') IconComponent = Map;
          else if (route.name === 'Leaderboard') IconComponent = Trophy;
          else if (route.name === 'Profil') IconComponent = User;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate({ name: route.name, merge: true });
            }
          };

          const tabCenter = index * TAB_WIDTH;
          const scale = bubbleX.interpolate({
            inputRange: [tabCenter - TAB_WIDTH, tabCenter, tabCenter + TAB_WIDTH],
            outputRange: [1, 1.25, 1],
            extrapolate: 'clamp',
          });

          return (
            <TouchableOpacity
              key={route.key}
              onPress={onPress}
              activeOpacity={0.8}
              style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
              }}
            >
              <Animated.View style={{ alignItems: 'center', justifyContent: 'center', transform: [{ scale }] }}>
                <IconComponent color={isFocused ? '#1D9E75' : '#6B7280'} size={24} strokeWidth={isFocused ? 2.5 : 2} />
              </Animated.View>
            </TouchableOpacity>
          );
        })}
      </BlurView>
    </Animated.View>
  );
}

function DashboardStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="DashboardHome" component={DashboardScreen} />
      <Stack.Screen name="Kalkulator" component={KalkulatorScreen} />
      <Stack.Screen name="Edukasi" component={EdukasiScreen} />
      <Stack.Screen name="Riwayat" component={RiwayatScreen} />
    </Stack.Navigator>
  );
}

export default function AppNavigator() {
  return (
    <Tab.Navigator
      tabBarPosition="bottom"
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ lazy: true, swipeEnabled: false }}
    >
      <Tab.Screen name="Dashboard" component={DashboardStack} />
      <Tab.Screen name="Peta" component={MapScreen} />
      <Tab.Screen name="Leaderboard" component={LeaderboardScreen} />
      <Tab.Screen name="Profil" component={ProfileScreen} />
    </Tab.Navigator>
  );
}
