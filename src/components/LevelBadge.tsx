import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Sparkles, Sprout, Leaf, TreePine, Zap, Gem } from 'lucide-react-native';
import { getLevelProgress } from '../lib/level';

interface LevelBadgeProps {
  poin: number;
  size?: 'sm' | 'md' | 'lg';
}

const ICONS = {
  1: Sprout,
  2: Leaf,
  3: TreePine,
  4: Zap,
  5: Gem,
};

export default function LevelBadge({ poin, size = 'sm' }: LevelBadgeProps) {
  const { current: level, next, progress, poinToNext } = getLevelProgress(poin);
  const Icon = ICONS[level.level as keyof typeof ICONS] || Sprout;
  const NextIcon = next ? ICONS[next.level as keyof typeof ICONS] || Sprout : null;

  if (size === 'sm') {
    return (
      <View style={[styles.smContainer, { backgroundColor: level.warnaLight }]}>
        <Icon color={level.warna} size={12} />
        <Text style={[styles.smText, { color: level.warna }]}>{level.nama}</Text>
      </View>
    );
  }

  if (size === 'md') {
    return (
      <View style={styles.mdContainer}>
        <View style={[styles.mdIconWrap, { backgroundColor: level.warnaLight }]}>
          <Icon color={level.warna} size={16} />
        </View>
        <View>
          <Text style={[styles.mdTitle, { color: level.warna }]}>{level.nama}</Text>
          <Text style={styles.mdSubtitle}>Level {level.level}</Text>
        </View>
      </View>
    );
  }

  // size === 'lg'
  return (
    <View style={styles.lgContainer}>
      <View style={styles.lgHeader}>
        <View style={[styles.lgIconWrap, { backgroundColor: level.warnaLight }]}>
          <Icon color={level.warna} size={28} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.lgTitle, { color: level.warna }]}>{level.nama}</Text>
          <Text style={styles.lgSubtitle}>Level {level.level} · {poin.toLocaleString('id-ID')} poin</Text>
          <Text style={styles.lgDesc}>{level.deskripsi}</Text>
        </View>
      </View>

      {next && (
        <View>
          <View style={styles.progressHeader}>
            <View style={styles.progressLabel}>
              <Text style={styles.progressText}>Progress ke {next.nama}</Text>
              {NextIcon && <NextIcon color="#9CA3AF" size={12} />}
            </View>
            <Text style={styles.progressText}>{poinToNext.toLocaleString('id-ID')} poin lagi</Text>
          </View>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${progress}%`, backgroundColor: level.warna }]} />
          </View>
          <Text style={styles.progressMinPoin}>{next.minPoin.toLocaleString('id-ID')} poin</Text>
        </View>
      )}

      {!next && (
        <View style={styles.maxLevelBox}>
          <Sparkles color="#9333EA" size={14} />
          <Text style={styles.maxLevelText}>Level Tertinggi Tercapai!</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  smContainer: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  smText: { fontSize: 10, fontWeight: '600' },
  
  mdContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  mdIconWrap: { width: 32, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  mdTitle: { fontSize: 13, fontWeight: 'bold' },
  mdSubtitle: { fontSize: 10, color: '#9CA3AF' },

  lgContainer: { backgroundColor: 'white', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#F3F4F6' },
  lgHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  lgIconWrap: { width: 56, height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  lgTitle: { fontSize: 18, fontWeight: 'bold' },
  lgSubtitle: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  lgDesc: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  progressLabel: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  progressText: { fontSize: 11, color: '#9CA3AF' },
  progressBarBg: { height: 8, backgroundColor: '#F3F4F6', borderRadius: 4, overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 4 },
  progressMinPoin: { fontSize: 10, color: '#D1D5DB', marginTop: 4 },

  maxLevelBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#FAF5FF', paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: '#F3E8FF' },
  maxLevelText: { fontSize: 12, fontWeight: '600', color: '#9333EA' },
});
