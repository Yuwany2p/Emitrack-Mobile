import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, ActivityIndicator, Animated, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Medal, Trophy, Users, Globe, Bus, Target, Award } from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

const MEDAL_COLORS = ['#F59E0B', '#9CA3AF', '#EA580C'];
const PODIUM_BG = ['#FAC775', '#D1D5DB', '#C2410C'];

type Profile = {
  id: string;
  username: string | null;
  kota: string | null;
  total_poin: number;
  total_hemat: number;
};

type Tab = 'semua' | 'kota' | 'poin';

export default function LeaderboardScreen() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('semua');
  const [users, setUsers] = useState<Profile[]>([]);
  const [myProfile, setMyProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // Community Stats
  const [totalUsers, setTotalUsers] = useState(0);
  const [totalHemat, setTotalHemat] = useState(0);
  const [totalTrips, setTotalTrips] = useState(0);

  // Animated Header Setup
  const HEADER_HEIGHT = 90;
  const scrollY = React.useRef(new Animated.Value(0)).current;
  const diffClamp = Animated.diffClamp(scrollY, 0, HEADER_HEIGHT);
  const headerOpacity = diffClamp.interpolate({
    inputRange: [0, HEADER_HEIGHT],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  useEffect(() => {
    fetchLeaderboard();
    fetchStats();
  }, [tab]);

  const fetchLeaderboard = async () => {
    setLoading(true);
    let query = supabase.from('profiles').select('*');

    if (tab === 'kota' && myProfile?.kota) {
      query = query.eq('kota', myProfile.kota);
    }

    if (tab === 'poin') {
      query = query.order('total_poin', { ascending: false });
    } else {
      query = query.order('total_hemat', { ascending: false });
    }

    const { data } = await query.limit(50);
    if (data) {
      setUsers(data as Profile[]);
      const me = data.find(u => u.id === user?.id) as Profile | undefined;
      if (me) setMyProfile(me);
    }
    setLoading(false);
  };

  const fetchStats = async () => {
    const [profilesRes, tripsRes, hematRes] = await Promise.all([
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      supabase.from('trips').select('id', { count: 'exact', head: true }),
      supabase.from('profiles').select('total_hemat')
    ]);

    if (profilesRes.count !== null) setTotalUsers(profilesRes.count);
    if (tripsRes.count !== null) setTotalTrips(tripsRes.count);
    
    if (hematRes.data) {
      const sum = hematRes.data.reduce((acc, curr) => acc + (curr.total_hemat || 0), 0);
      setTotalHemat(sum);
    }
  };

  const { useSafeAreaInsets } = require('react-native-safe-area-context');
  const insets = useSafeAreaInsets();

  const podium = users.slice(0, 3);
  const podiumOrder = [podium[1], podium[0], podium[2]];
  const podiumOriginalIdx = [1, 0, 2];
  const podiumHeights = [72, 100, 56];

  return (
    <View style={styles.container}>
      {/* Animated Header */}
      <Animated.View style={{
        position: 'absolute',
        top: insets.top,
        left: 0,
        right: 0,
        zIndex: 30,
        height: HEADER_HEIGHT,
        opacity: headerOpacity
      }}>
        <View style={{ flex: 1, paddingHorizontal: 16, justifyContent: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={styles.topbarTitle}>Leaderboard</Text>
            <View style={styles.liveBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
          </View>
          <View>
            <Text style={styles.topbarSub}>Siapa yang paling hijau?</Text>
          </View>
        </View>
      </Animated.View>

      <Animated.ScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={{ padding: 16, paddingTop: insets.top + HEADER_HEIGHT - 25, paddingBottom: 100 + insets.bottom, minHeight: Dimensions.get('window').height + HEADER_HEIGHT }}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
      >
        {/* Tabs */}
        <View style={styles.tabContainer}>
          {(['semua', 'kota', 'poin'] as Tab[]).map(t => (
            <TouchableOpacity key={t} style={[styles.tab, tab === t && styles.tabActive]} onPress={() => setTab(t)}>
              <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
                {t === 'semua' ? 'Semua' : t === 'kota' ? 'Kota Saya' : 'Top Poin'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#1D9E75" style={{ marginVertical: 40 }} />
        ) : (
          <>
            {/* Podium */}
            {podium.length >= 3 && (
              <View style={styles.podiumCard}>
                <Text style={styles.sectionLabel}>TOP 3</Text>
                <View style={styles.podiumContainer}>
                  {podiumOrder.map((p, col) => {
                    if (!p) return <View key={col} style={{ width: 64 }} />;
                    const origIdx = podiumOriginalIdx[col];
                    return (
                      <View key={p.id} style={styles.podiumItemColumn}>
                        <View style={[styles.podiumAvatar, { backgroundColor: PODIUM_BG[origIdx] + '30' }]}>
                          <Text style={[styles.podiumAvatarText, { color: PODIUM_BG[origIdx] }]}>
                            {(p.username || '?')[0]}
                          </Text>
                        </View>
                        <Medal color={MEDAL_COLORS[origIdx]} size={20} />
                        <Text style={styles.podiumName} numberOfLines={1}>{p.username || 'User'}</Text>
                        <Text style={styles.podiumHemat}>
                          {tab === 'poin' ? `${p.total_poin} pts` : `${(p.total_hemat || 0).toFixed(1)} kg`}
                        </Text>
                        <View style={[styles.podiumPillar, { height: podiumHeights[col], backgroundColor: PODIUM_BG[origIdx] }]}>
                          <Text style={styles.podiumRank}>#{origIdx + 1}</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Challenge Card */}
            <View style={styles.challengeCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Target color="#F59E0B" size={20} />
                <Text style={styles.challengeLabel}>TANTANGAN MINGGU INI</Text>
              </View>
              <Text style={styles.challengeTitle}>Pekan Tanpa Mobil</Text>
              <Text style={styles.challengeDesc}>Input 5 trip transportasi umum minggu ini</Text>
              <View style={styles.challengeProgressBar}>
                <View style={[styles.challengeProgressFill, { width: '0%' }]} />
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                <Text style={styles.challengeProgressText}>Progress: 0/5</Text>
                <View style={styles.challengeReward}>
                  <Text style={styles.challengeRewardText}>+500 poin</Text>
                  <Award color="#92400E" size={12} />
                </View>
              </View>
            </View>

            {/* Community Stats */}
            <View style={styles.communityCard}>
              <Text style={styles.sectionLabel}>STATISTIK KOMUNITAS</Text>
              {[
                { label: 'Total pengguna', value: `${totalUsers} orang`, icon: Users },
                { label: 'CO₂ dihemat komunitas', value: `${totalHemat.toFixed(1)} kg`, icon: Globe },
                { label: 'Total trip', value: `${totalTrips} trip`, icon: Bus },
              ].map((s, i) => {
                const Icon = s.icon;
                return (
                  <View key={i} style={styles.communityRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Icon color="#1D9E75" size={16} />
                      <Text style={styles.communityLabel}>{s.label}</Text>
                    </View>
                    <Text style={styles.communityValue}>{s.value}</Text>
                  </View>
                );
              })}
            </View>

            {/* Ranking List */}
            <View style={styles.rankingCard}>
              <Text style={styles.sectionLabel}>SEMUA PESERTA</Text>
              {users.map((r, i) => {
                const isMe = r.id === user?.id;
                return (
                  <View key={r.id} style={[styles.rankingRow, isMe && styles.rankingRowMe]}>
                    <View style={styles.rankNumber}>
                      {i < 3 ? (
                        <Medal color={MEDAL_COLORS[i]} size={18} />
                      ) : (
                        <Text style={styles.rankNumberText}>{i + 1}</Text>
                      )}
                    </View>
                    <View style={[styles.rankAvatar, isMe && { backgroundColor: '#1D9E75' }]}>
                      <Text style={[styles.rankAvatarText, isMe && { color: 'white' }]}>
                        {(r.username || '?')[0]}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.rankName, isMe && { color: '#065F46' }]}>
                        {r.username || 'User'}{isMe && <Text style={styles.rankMeTag}> (Kamu)</Text>}
                      </Text>
                      <Text style={styles.rankKota}>{r.kota || 'Unknown'}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[styles.rankHemat, isMe && { color: '#1D9E75' }]}>
                        {tab === 'poin' ? r.total_poin : (r.total_hemat || 0).toFixed(1)}
                      </Text>
                      <Text style={styles.rankHematLabel}>{tab === 'poin' ? 'poin' : 'kg CO₂'}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        )}

        <View style={{ height: 24 }} />
      </Animated.ScrollView>

      {/* Dynamic Status Bar Overlay with translateY for native driver support */}
      <Animated.View
        style={{
          position: 'absolute',
          top: -(HEADER_HEIGHT),
          left: 0,
          right: 0,
          height: insets.top + (HEADER_HEIGHT * 1.6),
          zIndex: 20,
          transform: [{
            translateY: diffClamp.interpolate({
              inputRange: [0, HEADER_HEIGHT],
              outputRange: [0, -((HEADER_HEIGHT * 0.6) - 15)],
              extrapolate: 'clamp',
            })
          }],
        }}
        pointerEvents="none"
      >
        <LinearGradient
          colors={['rgba(255, 255, 255, 1)', 'rgba(255, 255, 255, 1)', 'rgba(255, 255, 255, 0.8)', 'rgba(255, 255, 255, 0)']}
          locations={[0, 0.7, 0.9, 1]}
          style={{ flex: 1 }}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  topbar: { paddingHorizontal: 16, paddingTop: 48, paddingBottom: 12, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  topbarTitle: { fontSize: 16, fontWeight: '600', color: '#1F2937' },
  topbarSub: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#EF4444' },
  liveText: { fontSize: 10, color: '#EF4444', fontWeight: '600' },
  tabContainer: { flexDirection: 'row', backgroundColor: '#F3F4F6', margin: 16, marginBottom: 0, borderRadius: 10, padding: 3 },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  tabActive: { backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  tabText: { fontSize: 12, fontWeight: '500', color: '#6B7280' },
  tabTextActive: { color: '#1D9E75' },
  sectionLabel: { fontSize: 10, fontWeight: '600', color: '#9CA3AF', letterSpacing: 1.5, marginBottom: 12 },

  // Podium
  podiumCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#F3F4F6' },
  podiumContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end', gap: 20, paddingTop: 8 },
  podiumItemColumn: { alignItems: 'center', gap: 4 },
  podiumAvatar: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  podiumAvatarText: { fontWeight: 'bold', fontSize: 14 },
  podiumName: { fontSize: 11, fontWeight: '600', color: '#374151', maxWidth: 64, textAlign: 'center' },
  podiumHemat: { fontSize: 10, color: '#9CA3AF' },
  podiumPillar: { width: 64, borderTopLeftRadius: 12, borderTopRightRadius: 12, justifyContent: 'center', alignItems: 'center' },
  podiumRank: { color: 'white', fontWeight: 'bold', fontSize: 14 },

  // Challenge
  challengeCard: { backgroundColor: '#FFFBEB', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#FDE68A' },
  challengeLabel: { fontSize: 10, fontWeight: '600', color: '#B45309', letterSpacing: 1 },
  challengeTitle: { fontSize: 15, fontWeight: 'bold', color: '#92400E', marginBottom: 4 },
  challengeDesc: { fontSize: 12, color: '#B45309', marginBottom: 12 },
  challengeProgressBar: { height: 8, backgroundColor: '#FDE68A', borderRadius: 4, overflow: 'hidden' },
  challengeProgressFill: { height: '100%', backgroundColor: '#F59E0B', borderRadius: 4 },
  challengeProgressText: { fontSize: 11, color: '#B45309', fontWeight: '500' },
  challengeReward: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FBBF24', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 },
  challengeRewardText: { fontSize: 10, fontWeight: 'bold', color: '#92400E' },

  // Community
  communityCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#F3F4F6' },
  communityRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F9FAFB' },
  communityLabel: { fontSize: 13, color: '#6B7280' },
  communityValue: { fontSize: 13, fontWeight: '600', color: '#1D9E75' },

  // Ranking
  rankingCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#F3F4F6' },
  rankingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 8, borderRadius: 12, marginBottom: 4, backgroundColor: '#F9FAFB' },
  rankingRowMe: { backgroundColor: '#E1F5EE', borderWidth: 1, borderColor: '#9FE1CB' },
  rankNumber: { width: 28, alignItems: 'center' },
  rankNumberText: { fontSize: 13, fontWeight: '600', color: '#9CA3AF' },
  rankAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#E1F5EE', justifyContent: 'center', alignItems: 'center' },
  rankAvatarText: { fontWeight: 'bold', fontSize: 12, color: '#1D9E75' },
  rankName: { fontSize: 13, fontWeight: '500', color: '#374151' },
  rankMeTag: { color: '#1D9E75', fontWeight: '600', fontSize: 11 },
  rankKota: { fontSize: 11, color: '#9CA3AF' },
  rankHemat: { fontSize: 13, fontWeight: '600', color: '#374151' },
  rankHematLabel: { fontSize: 9, color: '#9CA3AF' },
});
