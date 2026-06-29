import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Leaf, Coins, Map, History, Gift, Navigation, Trophy, Medal, Star, TrendingDown, Flame, ChevronRight, TreePine, BookOpen, Calculator } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { RATA_RATA_NASIONAL } from '../lib/emisi';
import LevelBadge from '../components/LevelBadge';
import { SkeletonCard, SkeletonRow } from '../components/Skeleton';

function sapaanWaktu() {
  const jam = new Date().getHours();
  if (jam >= 5 && jam < 11) return 'Selamat pagi';
  if (jam >= 11 && jam < 15) return 'Selamat siang';
  if (jam >= 15 && jam < 19) return 'Selamat sore';
  return 'Selamat malam';
}

function fmtEmisi(n: number) { return Number(n.toFixed(3)); }

function fmtEmisi(n: number) { return Number(n.toFixed(3)); }

export default function DashboardScreen({ navigation }: any) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [topUsers, setTopUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  async function fetchData() {
    setLoading(true);
    const [profileRes, tripsRes, leaderboardRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user!.id).single(),
      supabase.from('trips').select('*').eq('user_id', user!.id).order('created_at', { ascending: false }).limit(5),
      supabase.from('profiles').select('id, username, total_poin, total_hemat, kota').order('total_hemat', { ascending: false }).limit(3),
    ]);

    if (profileRes.data) setProfile(profileRes.data as Profile);
    if (tripsRes.data) setTrips(tripsRes.data as Trip[]);
    if (leaderboardRes.data) setTopUsers(leaderboardRes.data as Profile[]);
    setLoading(false);
  }

  if (loading) {
    return (
      <View style={{ flex: 1, padding: 16, backgroundColor: '#F8FAFC', paddingTop: 60 }}>
        <SkeletonRow style={{ marginBottom: 24, borderBottomWidth: 0 }} />
        <SkeletonCard style={{ height: 100, marginBottom: 16 }} />
        <SkeletonCard style={{ height: 150, marginBottom: 16 }} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          <SkeletonCard style={{ width: '48%', height: 100 }} />
          <SkeletonCard style={{ width: '48%', height: 100 }} />
        </View>
      </View>
    );
  }

  const displayName = profile?.username || user?.email?.split('@')[0] || 'User';
  const poin = profile?.total_poin ?? 0;
  const totalHemat = profile?.total_hemat ?? 0;
  const streak = profile?.streak ?? 0;

  // Calculate today's emission
  const today = new Date().toISOString().split('T')[0];
  const todayTrips = trips.filter(t => t.created_at.startsWith(today));
  const emisiHariIni = todayTrips.reduce((sum, t) => sum + t.emisi_kg, 0);
  const vsAvg = emisiHariIni > 0 ? Math.round((emisiHariIni / RATA_RATA_NASIONAL) * 100) : 0;

  function getBbmLabel(trip: Trip) {
    return LABEL_BBM[trip.bbm] ?? MODA_UMUM_LABEL[trip.bbm] ?? trip.bbm;
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting}>{sapaanWaktu()}, {displayName}! 👋</Text>
          <Text style={styles.subtitle}>Mari buat bumi lebih hijau hari ini.</Text>
        </View>
        {streak > 0 && (
          <View style={styles.streakBadge}>
            <Flame color="#EA580C" size={14} />
            <Text style={styles.streakText}>{streak}</Text>
          </View>
        )}
        <View style={styles.avatarPlaceholder}>
          <Text style={styles.avatarText}>{displayName[0]?.toUpperCase()}</Text>
        </View>
      </View>

      {/* Level Badge */}
      <View style={{ marginBottom: 14 }}>
        <LevelBadge poin={poin} size="lg" />
      </View>

      {/* Leaderboard Preview */}
      {topUsers.length > 0 && (
        <View style={styles.leaderboardCard}>
          <View style={styles.leaderboardHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Trophy color="#FAC775" size={18} />
              <Text style={styles.leaderboardTitle}>Pahlawan Bumi</Text>
            </View>
            <TouchableOpacity onPress={() => navigation.navigate('Leaderboard')}>
              <Text style={styles.seeAllText}>Lihat Semua</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.podiumRow}>
            {topUsers.map((u, i) => (
              <View key={u.id} style={styles.podiumItem}>
                <View style={[styles.podiumAvatar, { backgroundColor: MEDAL_COLORS[i] + '30' }]}>
                  <Text style={[styles.podiumAvatarText, { color: MEDAL_COLORS[i] }]}>
                    {(u.username || '?')[0]}
                  </Text>
                </View>
                <Medal color={MEDAL_COLORS[i]} size={14} />
                <Text style={styles.podiumName} numberOfLines={1}>{u.username || 'User'}</Text>
                <Text style={styles.podiumPoin}>{(u.total_hemat ?? 0).toFixed(1)} kg</Text>
              </View>
            ))}
          </View>
        </View>
      )}

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          {/* 1. EMISI GAUGE */}
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>EMISI HARI INI</Text>
            <View style={styles.gaugeBox}>
              <Svg width="80" height="45" viewBox="0 0 100 55">
                <Path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#F1F5F9" strokeWidth="10" strokeLinecap="round" />
                <Path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke={isOverLimit ? '#EF4444' : '#F59E0B'} strokeWidth="10" strokeLinecap="round" strokeDasharray="125.6" strokeDashoffset={125.6 - (progressPercent / 100 * 125.6)} />
              </Svg>
              <View style={styles.gaugeTextOverlay}><Text style={[styles.gaugeVal, isOverLimit && { color: '#EF4444' }]}>{emisiHariIni}</Text></View>
            </View>
            <View style={[styles.statusBadge, isOverLimit ? styles.bgRedSoft : styles.bgAmberSoft]}><Text style={[styles.statusText, isOverLimit ? styles.textRed : styles.textAmber]}>{isOverLimit ? 'LIMIT' : 'AMAN'}</Text></View>
          </View>

          {/* 2. TOTAL HEMAT*/}
          <View style={[styles.statCard, styles.bgEmerald]}>
            <TreePine color="rgba(255,255,255,0.1)" size={80} style={{ position: 'absolute', bottom: -20, right: -20 }} />
            <Text style={styles.statLabelWhite}>TOTAL HEMAT</Text>
            <View style={styles.centeredContent}>
              <View style={styles.iconCircleWhite}><TreePine size={20} color="#1D9E75" /></View>
              <Text style={styles.statValueWhite}>{fmtEmisi(totalHematTrips)} <Text style={{ fontSize: 10 }}>kg CO₂</Text></Text>
              <Text style={styles.treePercentText}>Progres Pohon ke-{pohonKe}</Text>
            </View>
            {/* Progress Bar Putih */}
            <View style={styles.miniProgressBar}>
              <View style={[styles.miniProgressFill, { width: `${progressPohonSekarang}%` }]} />
            </View>
            <Text style={styles.treeSubText}>{progressPohonSekarang}% Selesai</Text>
          </View>

          {/* 3. PERFORMA AKSI */}
          <View style={styles.statCard}>
            <View style={styles.h2hHeader}>
              <Text style={styles.statLabel}>PERFORMA AKSI</Text>
              <View style={[styles.miniDiff, pointDiff >= 0 ? styles.bgMintSoft : styles.bgRedSoft]}>
                <Text style={[styles.diffText, pointDiff >= 0 ? styles.textGreen : styles.textRed]}>{pointDiff > 0 ? '+' : ''}{pointDiff}</Text>
              </View>
            </View>
            <View style={styles.h2hRow}>
              <View style={styles.h2hBox}><Text style={styles.h2hLabel}>KEMARIN</Text><Text style={styles.h2hVal}>{yesterdayPoints}</Text></View>
              <Zap size={14} color="#F59E0B" fill="#F59E0B" />
              <View style={[styles.h2hBox, { backgroundColor: '#F0FFF9' }]}><Text style={[styles.h2hLabel, { color: '#1D9E75' }]}>HARI INI</Text><Text style={[styles.h2hVal, { color: '#1D9E75' }]}>{todayPoints}</Text></View>
            </View>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${Math.min((emisiHariIni / 3) * 100, 100)}%` }]} />
            </View>
            <Text style={styles.statValueEmerald}>{vsAvg}%</Text>
            <Text style={styles.spectrumStatusText}>{vsAvg < 100 ? '🌿 Keren, Emisimu terkendali!' : '⚠️ Yuk, lebih hijau lagi!'}</Text>
          </View>
        </View>

        {/* 7-DAY CHART */}
        <View style={styles.chartCard}>
          <Text style={styles.sectionTitle}>EMISI 7 HARI TERAKHIR (kg CO₂)</Text>
          <View style={styles.chartContent}>
            <Svg width={width - 70} height={140}>
              {chartData.map((d, i) => {
                const maxVal = Math.max(...chartData.map(x => x.emisi), 1.5);
                const barH = (d.emisi / maxVal) * 90;
                const barW = (width - 120) / 7;
                const xPos = i * (barW + 8);
                return (
                  <React.Fragment key={i}>
                    <Rect x={xPos} y={100 - barH} width={barW} height={barH} fill={i === chartData.length - 1 ? '#FAC775' : '#1D9E75'} rx="4" />
                    <SvgText x={xPos + barW / 2} y="120" fontSize="8" fontWeight="bold" fill="#9CA3AF" textAnchor="middle">{d.hari}</SvgText>
                  </React.Fragment>
                );
              })}
            </Svg>
          </View>
        </View>

      {/* Quick Actions */}
      <Text style={styles.sectionTitle}>Aksi Cepat</Text>
      <View style={styles.quickActions}>
        {[
          { icon: Map, label: 'Peta', bg: '#E1F5EE', color: '#1D9E75', screen: 'Peta' },
          { icon: Calculator, label: 'Kalkulator', bg: '#FEF3C7', color: '#F59E0B', screen: 'Kalkulator' },
          { icon: History, label: 'Riwayat', bg: '#E0E7FF', color: '#6366F1', screen: 'Riwayat' },
          { icon: Gift, label: 'Reward', bg: '#FCE7F3', color: '#EC4899', screen: 'Rewards' },
          { icon: BookOpen, label: 'Edukasi', bg: '#E0F2FE', color: '#0EA5E9', screen: 'Edukasi' },
        ].map((item, i) => {
          const Icon = item.icon;
          return (
            <TouchableOpacity key={i} style={styles.actionButton} onPress={() => navigation.navigate(item.screen)}>
              <View style={[styles.actionIconContainer, { backgroundColor: item.bg }]}><item.icon color={item.color} size={22} /></View>
              <Text style={styles.actionText}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Smart Action Plan */}
        <View style={styles.smartCard}>
          <View style={styles.smartHeader}><Zap size={20} color="#1D9E75" fill="#1D9E75" /><Text style={styles.smartTitle}>SMART ACTION PLAN</Text></View>
          <Text style={styles.smartMsg}>{smartMsg}</Text>
          <View style={styles.smartProgressBox}>
            <View style={styles.smartProgressTextRow}><Text style={styles.smartProgressLabel}>PROGRESS VS TARGET AMAN</Text><Text style={styles.smartProgressVal}>{emisiHariIni} / {targetHarian} kg CO₂</Text></View>
            <View style={styles.smartBarBg}><View style={[styles.smartBarFill, { width: `${progressPercent}%`, backgroundColor: isOverLimit ? '#EF4444' : '#1D9E75' }]} /></View>
          </View>
          <TouchableOpacity style={styles.smartBtn} onPress={() => navigation.navigate('Peta')}><Text style={styles.smartBtnText}>COBA RUTE HIJAU</Text><ChevronRight color="white" size={16} /></TouchableOpacity>
        </View>
      ) : (
        trips.map((trip) => (
          <View key={trip.id} style={styles.tripCard}>
            <View style={[styles.tripIcon, {
              backgroundColor: trip.jenis === 'transportasi_umum' ? '#1D9E75' : '#6B7280'
            }]}>
              <Navigation color="white" size={18} />
            </View>
            <View style={styles.tripDetails}>
              <Text style={styles.tripTitle}>
                {trip.jenis === 'transportasi_umum' ? 'Trans. Umum' : trip.jenis === 'motor' ? 'Motor' : 'Mobil'} — {getBbmLabel(trip)}
              </Text>
              <Text style={styles.tripTime}>
                {trip.jarak_km} km · {new Date(trip.created_at).toLocaleDateString('id-ID')}
              </Text>
            </View>
            <View style={styles.tripRight}>
              <Text style={[styles.tripEmisi, {
                color: trip.jenis === 'transportasi_umum' ? '#1D9E75' : '#D97706'
              }]}>
                {trip.emisi_kg.toFixed(3)} kg
              </Text>
              {trip.emisi_dihemat > 0 && (
                <Text style={styles.tripSaved}>Hemat {trip.emisi_dihemat.toFixed(2)}</Text>
              )}
            </View>
          </View>
        ))
      )}

      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC', padding: 16 },
  header: { flexDirection: 'row', alignItems: 'center', marginTop: 40, marginBottom: 16, gap: 8 },
  greeting: { fontSize: 22, fontWeight: 'bold', color: '#1F2937' },
  subtitle: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  streakBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FFEDD5', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  streakText: { fontSize: 12, fontWeight: 'bold', color: '#EA580C' },
  avatarPlaceholder: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#1D9E75', justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: 'white', fontWeight: 'bold', fontSize: 16 },

  // Level
  levelCard: { borderRadius: 14, padding: 14, marginBottom: 14 },
  levelBadge: { color: 'white', fontSize: 10, fontWeight: 'bold', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, overflow: 'hidden' },
  levelName: { fontSize: 14, fontWeight: 'bold' },
  progressBar: { height: 6, backgroundColor: 'rgba(0,0,0,0.08)', borderRadius: 3, overflow: 'hidden', marginBottom: 6 },
  progressFill: { height: '100%', borderRadius: 3 },
  levelDesc: { fontSize: 11, color: '#6B7280' },

  // Leaderboard
  leaderboardCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  leaderboardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  leaderboardTitle: { fontSize: 14, fontWeight: 'bold', color: '#1F2937' },
  seeAllText: { fontSize: 11, color: '#6B7280', backgroundColor: '#F3F4F6', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, overflow: 'hidden' },
  podiumRow: { flexDirection: 'row', justifyContent: 'space-around' },
  podiumItem: { alignItems: 'center', width: '30%' },
  podiumAvatar: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginBottom: 6, borderWidth: 2, borderColor: '#F8FAFC' },
  podiumAvatarText: { fontWeight: 'bold', fontSize: 14 },
  podiumName: { fontSize: 11, fontWeight: '600', color: '#374151', maxWidth: 60, textAlign: 'center' },
  podiumPoin: { fontSize: 10, color: '#1D9E75', fontWeight: '500' },

  // Stats
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  statCard: { width: '48%', backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#F3F4F6' },
  statLabel: { fontSize: 11, color: '#9CA3AF', marginBottom: 4 },
  statValue: { fontSize: 22, fontWeight: '600' },
  statSub: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },

  // Smart Comparison
  smartCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: '#F3F4F6' },
  smartHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  smartTitle: { fontSize: 13, fontWeight: '600', color: '#1D9E75' },
  smartMsg: { fontSize: 13, color: '#4B5563', lineHeight: 20, marginBottom: 12 },
  progressContainer: { backgroundColor: '#F8FAFC', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: '#F3F4F6', marginBottom: 12 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  progressLabel: { fontSize: 10, color: '#6B7280', fontWeight: '500' },
  progressValue: { fontSize: 10, color: '#374151', fontWeight: '500' },
  progressBarBg: { height: 6, backgroundColor: '#E5E7EB', borderRadius: 3, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: '#1D9E75', borderRadius: 3 },
  smartBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1D9E75', paddingVertical: 10, borderRadius: 10, gap: 4 },
  smartBtnText: { color: 'white', fontSize: 12, fontWeight: '600' },

  // Quick Actions
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#1F2937', marginBottom: 12 },
  quickActions: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap' },
  actionButton: { alignItems: 'center', width: '18%' },
  actionIconContainer: { width: 52, height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
  actionText: { fontSize: 10, color: '#4B5563', fontWeight: '500', textAlign: 'center' },

  // Trip cards
  tripCard: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', marginBottom: 10, borderWidth: 1, borderColor: '#F3F4F6' },
  tripIcon: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  tripDetails: { flex: 1 },
  tripTitle: { fontSize: 13, fontWeight: '600', color: '#1F2937' },
  tripTime: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  tripRight: { alignItems: 'flex-end' },
  tripEmisi: { fontSize: 13, fontWeight: '600' },
  tripSaved: { fontSize: 10, color: '#1D9E75', marginTop: 2 },

  // Empty state
  emptyCard: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: '#F3F4F6' },
  emptyText: { fontSize: 13, color: '#9CA3AF', marginBottom: 12 },
  emptyBtn: { backgroundColor: '#1D9E75', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  emptyBtnText: { color: 'white', fontSize: 13, fontWeight: '600' },
});