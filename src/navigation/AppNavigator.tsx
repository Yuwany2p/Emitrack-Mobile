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
import RewardsScreen from '../screens/RewardsScreen';
import RiwayatScreen from '../screens/RiwayatScreen';

const Tab = createMaterialTopTabNavigator();
const Stack = createNativeStackNavigator();

const { width: windowWidth } = Dimensions.get('window');
const TAB_BAR_MARGIN_LEFT = 20;
const TAB_BAR_WIDTH = windowWidth - (TAB_BAR_MARGIN_LEFT * 2);
const TAB_WIDTH = TAB_BAR_WIDTH / 4;
const INDICATOR_WIDTH = 64; 
const INDICATOR_MARGIN = (TAB_WIDTH - INDICATOR_WIDTH) / 2;

function CustomTabBar({ state, descriptors, navigation, position }: any) {
  const [isDragging, setIsDragging] = useState(false);
  const dragX = useRef(new Animated.Value(0)).current;

  // PanResponder khusus untuk mendeteksi swipe/slide jari di atas Tab Bar
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false, 
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        return Math.abs(gestureState.dx) > 5;
      },
      onPanResponderGrant: (evt) => {
        setIsDragging(true);
        // Posisikan gelembung tepat di bawah jari saat mulai menggeser
        const x = evt.nativeEvent.pageX - TAB_BAR_MARGIN_LEFT - INDICATOR_MARGIN - (INDICATOR_WIDTH / 2);
        dragX.setValue(x);
      },
      onPanResponderMove: (evt) => {
        // Gelembung mengikuti pergerakan jari secara realtime
        let x = evt.nativeEvent.pageX - TAB_BAR_MARGIN_LEFT - INDICATOR_MARGIN - (INDICATOR_WIDTH / 2);
        
        // Batasi agar gelembung tidak keluar dari area tab bar
        const maxTranslateX = TAB_BAR_WIDTH - INDICATOR_WIDTH - (INDICATOR_MARGIN * 2);
        if (x < 0) x = 0;
        if (x > maxTranslateX) x = maxTranslateX;
        
        dragX.setValue(x);
      },
      onPanResponderRelease: (evt) => {
        setIsDragging(false);
        const x = evt.nativeEvent.pageX - TAB_BAR_MARGIN_LEFT;
        let index = Math.floor(x / TAB_WIDTH);
        
        // Pastikan index valid
        if (index < 0) index = 0;
        if (index >= state.routes.length) index = state.routes.length - 1;

        if (index !== state.index) {
          const targetRoute = state.routes[index];
          const event = navigation.emit({
            type: 'tabPress',
            target: targetRoute.key,
            canPreventDefault: true,
          });

          if (!event.defaultPrevented) {
            navigation.navigate({ name: targetRoute.name, merge: true });
          }
        }
      },
      onPanResponderTerminate: () => {
        setIsDragging(false);
      }
    })
  ).current;

  // Animasi untuk menggeser gelembung sesuai posisi halaman (saat layar di-swipe atau diklik)
  // PENTING: Gunakan useMemo agar node animasi tidak di-reset setiap kali komponen merender ulang!
  const defaultTranslateX = React.useMemo(() => {
    return position.interpolate({
      inputRange: state.routes.map((_: any, i: number) => i),
      outputRange: state.routes.map((_: any, i: number) => i * TAB_WIDTH),
    });
  }, [position, state.routes, TAB_WIDTH]);

  const focusedOptions = descriptors[state.routes[state.index].key].options;
  if (focusedOptions.tabBarStyle?.display === 'none') {
    return null;
  }

  return (
    <View
      {...panResponder.panHandlers}
      style={{
        position: 'absolute',
        bottom: 24,
        left: TAB_BAR_MARGIN_LEFT,
        right: 20,
        height: 70,
        backgroundColor: '#FFFFFF',
        borderRadius: 34,
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
      }}
    >
      {/* Gelembung Utama (Sinkron dengan geser layar) */}
      <Animated.View
        style={{
          position: 'absolute',
          bottom: 10,
          left: INDICATOR_MARGIN,
          width: INDICATOR_WIDTH,
          height: 50,
          borderRadius: 16,
          backgroundColor: '#E1F5EE',
          transform: [{ translateX: defaultTranslateX }],
          opacity: isDragging ? 0 : 1, // Sembunyikan kalau lagi didrag manual
        }}
      />

      {/* Gelembung Manual (Sinkron dengan tarikan jari di Tab Bar) */}
      <Animated.View
        style={{
          position: 'absolute',
          bottom: 10,
          left: INDICATOR_MARGIN,
          width: INDICATOR_WIDTH,
          height: 50,
          borderRadius: 16,
          backgroundColor: '#E1F5EE',
          transform: [{ translateX: dragX }],
          opacity: isDragging ? 1 : 0, // Munculkan hanya saat didrag
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
            <View style={{ alignItems: 'center', justifyContent: 'center', height: 32 }}>
              <IconComponent color={isFocused ? '#1D9E75' : '#6B7280'} size={22} strokeWidth={isFocused ? 2.5 : 2} />
            </View>
            <Text style={{
              fontSize: 10,
              fontWeight: isFocused ? '700' : '500',
              color: isFocused ? '#1F2937' : '#6B7280',
              marginTop: 2,
            }}>
              {route.name}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function DashboardStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="DashboardHome" component={DashboardScreen} />
      <Stack.Screen name="Kalkulator" component={KalkulatorScreen} />
      <Stack.Screen name="Edukasi" component={EdukasiScreen} />
      <Stack.Screen name="Rewards" component={RewardsScreen} />
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
