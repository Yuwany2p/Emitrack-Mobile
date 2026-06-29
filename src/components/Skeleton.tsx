import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, ViewStyle } from 'react-native';

const usePulse = () => {
  const anim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 0.4,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [anim]);

  return anim;
};

export function SkeletonCard({ style }: { style?: ViewStyle }) {
  const opacity = usePulse();
  return (
    <Animated.View style={[styles.card, { opacity }, style]}>
      <View style={styles.cardLine1} />
      <View style={styles.cardLine2} />
      <View style={styles.cardLine3} />
    </Animated.View>
  );
}

import { DimensionValue } from 'react-native';

export function SkeletonText({ width = '100%', style }: { width?: DimensionValue, style?: ViewStyle }) {
  const opacity = usePulse();
  return (
    <Animated.View style={[styles.text, { opacity, width }, style]} />
  );
}

export function SkeletonRow({ style }: { style?: ViewStyle }) {
  const opacity = usePulse();
  return (
    <Animated.View style={[styles.row, { opacity }, style]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
        <View style={styles.rowAvatar} />
        <View style={{ flex: 1, gap: 8 }}>
          <View style={styles.rowLine1} />
          <View style={styles.rowLine2} />
        </View>
      </View>
      <View style={styles.rowRight} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: 'white', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#F3F4F6' },
  cardLine1: { height: 16, backgroundColor: '#E5E7EB', borderRadius: 4, width: '50%', marginBottom: 16 },
  cardLine2: { height: 32, backgroundColor: '#E5E7EB', borderRadius: 8, width: '75%', marginBottom: 8 },
  cardLine3: { height: 12, backgroundColor: '#F3F4F6', borderRadius: 4, width: '33%', marginTop: 12 },

  text: { height: 16, backgroundColor: '#E5E7EB', borderRadius: 4 },

  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F9FAFB' },
  rowAvatar: { width: 32, height: 32, backgroundColor: '#E5E7EB', borderRadius: 16 },
  rowLine1: { height: 12, backgroundColor: '#E5E7EB', borderRadius: 4, width: '100%' },
  rowLine2: { height: 8, backgroundColor: '#F3F4F6', borderRadius: 4, width: '66%' },
  rowRight: { height: 16, backgroundColor: '#E5E7EB', borderRadius: 4, width: 64 },
});
