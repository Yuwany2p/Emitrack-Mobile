import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet, Text, View, ScrollView, TouchableOpacity,
  Dimensions, ActivityIndicator, Modal, Share as RNShare, Animated, Alert
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Map, History, Gift, Trophy, Flame, ChevronRight,
  TreePine, BookOpen, Calculator, Zap, Share as ShareIcon, X, MessageSquare
} from 'lucide-react-native';
import Svg, { Path, Defs, LinearGradient as SvgLinearGradient, Stop, Rect, Text as SvgText } from 'react-native-svg';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { RATA_RATA_NASIONAL } from '../lib/emisi';
import LevelBadge from '../components/LevelBadge';
import { getLevelByPoin } from '../lib/level';
import { SkeletonCard, SkeletonRow } from '../components/Skeleton';
import { useFocusEffect } from '@react-navigation/native';

const { width, height: screenHeight } = Dimensions.get('window');

function sapaanWaktu() {
  const jam = new Date().getHours();
  if (jam >= 5 && jam < 11) return 'Selamat pagi';
  if (jam >= 11 && jam < 15) return 'Selamat siang';
  if (jam >= 15 && jam < 19) return 'Selamat sore';
  return 'Selamat malam';
}

function fmtEmisi(n: number) { return Number(n.toFixed(3)); }

const MEDAL_COLORS = ['#F59E0B', '#9CA3AF', '#EA580C'];

type Profile = {
  id: string;
  username: string | null;
  kota: string | null;
  total_poin: number;
  total_hemat: number;
  streak: number;
};

type Trip = {
  id: string;
  jenis: string;
  bbm: string;
  jarak_km: number;
  emisi_kg: number;
  emisi_dihemat: number;
  poin_didapat: number;
  created_at: string;
};

export default function DashboardScreen({ navigation }: any) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [topUsers, setTopUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  const [showShareModal, setShowShareModal] = useState(false);
  const [emisiHariIni, setEmisiHariIni] = useState(0);
  const [chartData, setChartData] = useState<any[]>([]);

  // Animated Header Setup
  const HEADER_HEIGHT = 90;
  const scrollY = useRef(new Animated.Value(0)).current;
  const diffClamp = Animated.diffClamp(scrollY, 0, HEADER_HEIGHT);
  const headerOpacity = diffClamp.interpolate({
    inputRange: [0, HEADER_HEIGHT],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  // const handleSeedData = async () => {
  //   if (!user) return;
  //   setLoading(true);

  //   // Delete existing trips
  //   await supabase.from('trips').delete().eq('user_id', user.id);

  //   const dummyTrips = [];
  //   let totalPoin = 0;
  //   let totalHemat = 0;

  //   const tripTemplates = [
  //     { jenis: 'motor', bbm: 'pertamax', jarak_km: 8, emisi_kg: 0.9, emisi_dihemat: 0, poin_didapat: 3 },
  //     { jenis: 'mobil', bbm: 'pertalite', jarak_km: 15, emisi_kg: 2.5, emisi_dihemat: 0, poin_didapat: 5 },
  //     { jenis: 'transportasi_umum', bbm: 'listrik', jarak_km: 25, emisi_kg: 0.4, emisi_dihemat: 4.2, poin_didapat: 20 },
  //     { jenis: 'motor', bbm: 'pertamax', jarak_km: 12, emisi_kg: 1.4, emisi_dihemat: 0, poin_didapat: 5 },
  //     { jenis: 'transportasi_umum', bbm: 'solar', jarak_km: 10, emisi_kg: 0.8, emisi_dihemat: 1.5, poin_didapat: 15 },
  //   ];

  //   for (let i = 6; i >= 0; i--) {
  //     const date = new Date();
  //     date.setDate(date.getDate() - i);

  //     // Pilih 2-3 trip per hari
  //     const numTrips = Math.floor(Math.random() * 2) + 2;
  //     for (let j = 0; j < numTrips; j++) {
  //       const randIndex = Math.floor(Math.random() * tripTemplates.length);
  //       const t = tripTemplates[randIndex];

  //       const tripDate = new Date(date);
  //       tripDate.setHours(8 + j * 4); // jam 8, 12, 16

  //       dummyTrips.push({
  //         user_id: user.id,
  //         jenis: t.jenis,
  //         bbm: t.bbm,
  //         jarak_km: t.jarak_km,
  //         emisi_kg: t.emisi_kg,
  //         emisi_dihemat: t.emisi_dihemat,
  //         poin_didapat: t.poin_didapat,
  //         created_at: tripDate.toISOString(),
  //       });

  //       totalPoin += t.poin_didapat;
  //       totalHemat += t.emisi_dihemat;
  //     }
  //   }

  //   await supabase.from('trips').insert(dummyTrips);
  //   await supabase.from('profiles').update({
  //     total_poin: totalPoin + 250, // Base poin agar level terlihat bagus
  //     total_hemat: totalHemat + 70,
  //     streak: 7
  //   }).eq('id', user.id);

  //   await fetchData();
  //   setLoading(false);
  //   Alert.alert('Sukses', 'Data dummy selama 7 hari berhasil dibuat!');
  // };

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const tujuhHariLalu = new Date();
    tujuhHariLalu.setDate(tujuhHariLalu.getDate() - 7);

    const [profileRes, tripsRes, leaderboardRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('trips').select('*').eq('user_id', user.id).gte('created_at', tujuhHariLalu.toISOString()).order('created_at', { ascending: false }),
      supabase.from('profiles').select('id, username, total_poin, total_hemat, kota').order('total_poin', { ascending: false }).limit(3),
    ]);

    if (profileRes.data) setProfile(profileRes.data as Profile);
    if (leaderboardRes.data) setTopUsers(leaderboardRes.data as Profile[]);

    if (tripsRes.data) {
      const dataTrips = tripsRes.data as Trip[];
      setTrips(dataTrips);
      const hariIniStr = new Date().toDateString();
      const emisiToday = dataTrips
        .filter((t) => new Date(t.created_at).toDateString() === hariIniStr)
        .reduce((acc, t) => acc + t.emisi_kg, 0);
      setEmisiHariIni(fmtEmisi(emisiToday));

      // Grafik Data
      const HARI_LABEL = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
      const grouped: any = {};
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        grouped[d.toDateString()] = 0;
      }
      dataTrips.forEach((t) => {
        const key = new Date(t.created_at).toDateString();
        if (grouped[key] !== undefined) grouped[key] += t.emisi_kg;
      });
      setChartData(Object.entries(grouped).map(([k, v]: any) => ({
        hari: HARI_LABEL[new Date(k).getDay()],
        emisi: v
      })));
    }
    setLoading(false);
  }, [user]);

  useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

  // --- Calculations ---
  const displayName = profile?.username || user?.email?.split('@')[0] || 'User';
  const poin = profile?.total_poin ?? 0;
  const streak = profile?.streak ?? 0;

  const totalHematTrips = profile?.total_hemat ?? 0;
  const vsAvg = Number(((emisiHariIni / RATA_RATA_NASIONAL) * 100).toFixed(0));
  const targetHarian = 3;
  const progressPercent = Math.min((emisiHariIni / targetHarian) * 100, 100);
  const isOverLimit = emisiHariIni > targetHarian;

  const todayTrips = trips.filter(t => new Date(t.created_at).toDateString() === new Date().toDateString());
  const todayPoints = todayTrips.reduce((s, t) => s + (t.poin_didapat || 0), 0);
  const yesterdayStr = new Date(new Date().setDate(new Date().getDate() - 1)).toDateString();
  const yesterdayPoints = trips.filter(t => new Date(t.created_at).toDateString() === yesterdayStr).reduce((s, t) => s + (t.poin_didapat || 0), 0);
  const pointDiff = todayPoints - yesterdayPoints;

  // Logika: Pohon ke-X (1 Pohon = 21kg)
  const pohonKe = Math.floor(totalHematTrips / 21) + 1;
  const progressPohonSekarang = Math.round(((totalHematTrips % 21) / 21) * 100);

  const hematHariIni = todayTrips.reduce((s, t) => s + (t.emisi_dihemat || 0), 0);
  const smartMsg = todayTrips.length === 0
    ? 'Belum ada perjalanan hari ini. Mulai gunakan transportasi umum untuk menghemat emisi!'
    : hematHariIni > 0
      ? `${fmtEmisi(hematHariIni)} kg CO₂ yang dihemat hari ini setara dengan kemampuan serap ${Math.max(1, Math.floor(hematHariIni / 0.0575))} Pohon Mahoni!`
      : `Hari ini kamu menghasilkan ${fmtEmisi(emisiHariIni)} kg CO₂. Coba rute hijau besok!`;

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

  return (
    <View style={{ flex: 1, backgroundColor: '#F8FAF9' }}>

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
            {/* <TouchableOpacity style={{ flex: 1 }} onPress={handleSeedData}>
              <Text style={styles.greeting}>{sapaanWaktu()}, {displayName}! 👋</Text>
              <Text style={styles.subtitle}>Mari buat bumi lebih hijau. (Tap to seed data)</Text>
            </TouchableOpacity> */}
            <View style={{ flex: 1 }}>
              <Text style={styles.greeting}>{sapaanWaktu()}, {displayName}! 👋</Text>
              <Text style={styles.subtitle}>Mari buat bumi lebih hijau.</Text>
            </View>


            <TouchableOpacity style={styles.bagikanPill} onPress={() => setShowShareModal(true)}>
              <ShareIcon color="#1D9E75" size={14} />
              <Text style={styles.bagikanText}>Bagikan</Text>
            </TouchableOpacity>

            <View style={styles.streakBadge}>
              <Flame color="#EA580C" size={14} fill="#EA580C" />
              <Text style={styles.streakText}>{streak}</Text>
            </View>
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarText}>{displayName[0]?.toUpperCase()}</Text>
            </View>
          </View>
        </View>
      </Animated.View>

      <Animated.ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + HEADER_HEIGHT - 10,
          paddingBottom: 100 + insets.bottom,
        }}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
      >
        <View style={{ marginBottom: 14 }}><LevelBadge poin={poin} size="lg" /></View>

        {/* Leaderboard Preview */}
        {topUsers.length > 0 && (
          <View style={styles.leaderboardCard}>
            <View style={styles.leaderboardHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Trophy color="#FAC775" size={18} />
                <Text style={styles.leaderboardTitle}>PAHLAWAN BUMI MINGGU INI</Text>
              </View>
              <TouchableOpacity onPress={() => navigation.navigate('Leaderboard')}><Text style={styles.seeAllText}>Lihat Semua</Text></TouchableOpacity>
            </View>
            <View style={styles.podiumRow}>
              {topUsers.map((u, i) => (
                <View key={u.id} style={styles.podiumItem}>
                  <View style={[styles.podiumAvatar, i === 0 ? styles.bgAmber : styles.bgMintSoft]}>
                    <Text style={[styles.podiumAvatarText, i === 0 ? styles.textWhite : styles.textEmerald]}>{(u.username || '?')[0].toUpperCase()}</Text>
                    <View style={styles.medalPill}><Text style={{ fontSize: 8 }}>{i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}</Text></View>
                  </View>
                  <Text style={styles.podiumName} numberOfLines={1}>{u.username || 'User'}</Text>
                  <Text style={styles.podiumPoin}>{u.total_poin} pts</Text>
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
            <Text style={styles.h2hMotivation}>
              {pointDiff > 0 ? '🔥 Mantap, performa naik!' : pointDiff < 0 ? '🚀 Ayo, kejar lagi!' : '⚡Stabil, lanjut terus!'}
            </Text>
          </View>

          {/* 4. EFISIENSI SPECTRUM */}
          <View style={[styles.statCard, styles.bgMintSoft]}>
            <Text style={styles.statLabel}>EFISIENSI</Text>
            <View style={styles.spectrumContainer}>
              <Svg width="100%" height="6">
                <Defs><SvgLinearGradient id="grad" x1="0" y1="0" x2="1" y2="0"><Stop offset="0" stopColor="#4ADE80" /><Stop offset="0.5" stopColor="#FACC15" /><Stop offset="1" stopColor="#EF4444" /></SvgLinearGradient></Defs>
                <Rect width="100%" height="6" rx="3" fill="url(#grad)" />
              </Svg>
              <View style={[styles.spectrumPointer, { left: `${Math.min(vsAvg, 100)}%` }]} />
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
        <Text style={styles.sectionTitle}>AKSI CEPAT</Text>
        <View style={styles.quickActions}>
          {[
            { icon: Map, label: 'Peta', bg: '#E1F5EE', color: '#1D9E75', screen: 'Peta' },
            { icon: Calculator, label: 'Kalkulator', bg: '#FEF3C7', color: '#F59E0B', screen: 'Kalkulator' },
            { icon: History, label: 'Riwayat', bg: '#E0E7FF', color: '#6366F1', screen: 'Riwayat' },
            { icon: BookOpen, label: 'Edukasi', bg: '#E0F2FE', color: '#0EA5E9', screen: 'Edukasi' }
          ].map((item, i) => (
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

        {/* Riwayat Terkini */}
        <View style={{ marginTop: 24 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text style={styles.sectionTitle}>RIWAYAT TERKINI</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Riwayat')}>
              <Text style={{ fontSize: 10, fontWeight: '900', color: '#1D9E75', backgroundColor: '#F0FFF9', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}>Lihat Semua</Text>
            </TouchableOpacity>
          </View>

          {trips.length === 0 ? (
            <View style={styles.emptyCard}>
              <History color="#D1D5DB" size={32} />
              <Text style={styles.emptyTitle}>Belum ada riwayat</Text>
              <Text style={styles.emptySub}>Mulai catat perjalananmu!</Text>
            </View>
          ) : (
            trips.slice(0, 3).map(trip => (
              <View key={trip.id} style={styles.tripRow}>
                <View style={styles.tripIconWrap}>
                  {trip.jenis === 'motor' ? <Flame color="#EF4444" size={18} /> :
                    trip.jenis === 'mobil' ? <Map color="#F59E0B" size={18} /> :
                      <Zap color="#1D9E75" size={18} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.tripTitle}>
                    {trip.jenis === 'motor' ? 'Motor' : trip.jenis === 'mobil' ? 'Mobil' : 'Trans. Umum'}
                    {trip.bbm && trip.bbm !== 'listrik' && trip.jenis !== 'transportasi_umum' && ` • ${trip.bbm.toUpperCase()}`}
                  </Text>
                  <Text style={styles.tripTime}>{trip.jarak_km} km • {new Date(trip.created_at).toLocaleDateString('id-ID')}</Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Text style={{ fontSize: 12, fontWeight: '900', color: trip.jenis === 'transportasi_umum' ? '#1D9E75' : '#EF4444' }}>
                    {trip.emisi_kg.toFixed(2)} kg CO₂
                  </Text>
                  <Text style={{ fontSize: 10, fontWeight: '900', color: '#F59E0B' }}>+{trip.poin_didapat} poin</Text>
                </View>
              </View>
            ))
          )}
        </View>

      </Animated.ScrollView>

      {/* Share Modal */}
      <Modal visible={showShareModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setShowShareModal(false)}><X color="white" size={24} /></TouchableOpacity>
            <View style={styles.shareCard}>
              <View style={styles.shareCardHeader}><Text style={styles.shareLogoText}>EmiTrack</Text><View style={styles.wrappedBadge}><Text style={styles.wrappedText}>Earth Hero 2026</Text></View></View>
              <View style={styles.shareCardContent}><Text style={styles.shareTitle}>Aksi Nyata Saya</Text><Text style={styles.shareSubtitle}>Telah Menebus Emisi Sebesar</Text><Text style={styles.shareBigValue}>{fmtEmisi(totalHematTrips)}</Text><Text style={styles.shareUnit}>kg CO₂</Text></View>
              <View style={styles.shareCardFooter}><View style={styles.footerStatBox}><Text style={styles.footerStatLabel}>Level</Text><Text style={styles.footerStatVal}>{getLevelByPoin(poin).nama}</Text></View><View style={styles.footerStatBox}><Text style={styles.footerStatLabel}>Streak</Text><Text style={styles.footerStatVal}>{profile?.streak ?? 0} Hari</Text></View></View>
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.shareBtnMain} onPress={() => RNShare.share({ message: `🌿 Saya hemat ${fmtEmisi(totalHematTrips)}kg CO₂ di EmiTrack!` })}><MessageSquare color="white" size={16} /><Text style={styles.shareBtnText}>Share Achievement</Text></TouchableOpacity>
              <TouchableOpacity style={styles.closeBtnText} onPress={() => setShowShareModal(false)}><Text style={styles.cancelText}>Tutup</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
  container: { flex: 1, paddingHorizontal: 16 },
  greeting: { fontSize: 18, fontWeight: 'bold', color: '#1F2937' },
  subtitle: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  bagikanPill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#E1F5EE', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#C2EBD9' },
  bagikanText: { fontSize: 11, fontWeight: 'bold', color: '#1D9E75' },
  streakBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FFEDD5', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#FFEDD5' },
  streakText: { fontSize: 12, fontWeight: '900', color: '#EA580C' },
  avatarPlaceholder: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#1D9E75', justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: 'white', fontWeight: 'bold', fontSize: 14 },

  // Leaderboard
  leaderboardCard: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  leaderboardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  leaderboardTitle: { fontSize: 10, fontWeight: '900', color: '#1F2937', letterSpacing: 1 },
  seeAllText: { fontSize: 10, fontWeight: '900', color: '#1D9E75', backgroundColor: '#F0FFF9', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  podiumRow: { flexDirection: 'row', justifyContent: 'space-around' },
  podiumItem: { alignItems: 'center', width: '30%' },
  podiumAvatar: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginBottom: 6, borderWidth: 2, borderColor: '#F8FAFC' },
  podiumAvatarText: { fontWeight: 'bold', fontSize: 14 },
  podiumName: { fontSize: 11, fontWeight: '800', color: '#374151' },
  podiumPoin: { fontSize: 10, color: '#1D9E75', fontWeight: '700' },
  medalPill: { position: 'absolute', bottom: -4, right: -4, backgroundColor: 'white', borderRadius: 10, padding: 2 },

  // Stats
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  statCard: { width: (width - 44) / 2, backgroundColor: '#FFFFFF', borderRadius: 24, padding: 16, minHeight: 140, justifyContent: 'space-between', borderWidth: 1, borderColor: '#F1F5F9', overflow: 'hidden' },
  statLabel: { fontSize: 8, fontWeight: '900', color: '#9CA3AF', letterSpacing: 1 },
  statLabelWhite: { fontSize: 8, fontWeight: '900', color: 'rgba(255,255,255,0.7)', letterSpacing: 1 },
  gaugeBox: { alignItems: 'center', justifyContent: 'center', height: 50 },
  gaugeTextOverlay: { position: 'absolute', bottom: 0 },
  gaugeVal: { fontSize: 18, fontWeight: '900', color: '#111827' },
  statusBadge: { alignSelf: 'center', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
  statusText: { fontSize: 9, fontWeight: '900' },
  bgEmerald: { backgroundColor: '#1D9E75' },
  centeredContent: { alignItems: 'center', gap: 4 },
  iconCircleWhite: { width: 32, height: 32, backgroundColor: 'white', borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  statValueWhite: { fontSize: 18, fontWeight: '900', color: 'white' },
  treePercentText: { fontSize: 8, color: 'white', fontWeight: 'bold', opacity: 0.9 },
  miniProgressBar: { height: 6, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 3, marginTop: 8, overflow: 'hidden', width: '100%' },
  miniProgressFill: { height: '100%', backgroundColor: 'white', borderRadius: 3 },
  treeSubText: { fontSize: 7, fontWeight: '800', color: 'white', opacity: 0.7, textAlign: 'center', marginTop: 4 },
  h2hHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  miniDiff: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  diffText: { fontSize: 9, fontWeight: '900' },
  h2hRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  h2hBox: { flex: 1, backgroundColor: '#F8FAFC', borderRadius: 10, padding: 6, alignItems: 'center' },
  h2hLabel: { fontSize: 6, fontWeight: '900', color: '#9CA3AF', marginBottom: 2 },
  h2hVal: { fontSize: 14, fontWeight: '900', color: '#9CA3AF' },
  h2hMotivation: { fontSize: 7, fontWeight: 'bold', color: '#9CA3AF', textAlign: 'center', marginTop: 4, fontStyle: 'italic' },
  spectrumContainer: { height: 6, marginVertical: 10, position: 'relative' },
  spectrumPointer: { position: 'absolute', width: 12, height: 12, backgroundColor: '#111827', borderRadius: 6, top: -3, borderWidth: 3, borderColor: 'white', zIndex: 10 },
  statValueEmerald: { fontSize: 20, fontWeight: '900', color: '#1D9E75', textAlign: 'center' },
  spectrumStatusText: { fontSize: 8, fontWeight: '900', color: '#1D9E75', textAlign: 'center' },

  // Charts & Actions
  chartCard: { backgroundColor: 'white', borderRadius: 24, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: '#F1F5F9' },
  chartContent: { marginTop: 10, alignItems: 'center' },
  sectionTitle: { fontSize: 10, fontWeight: '900', color: '#9CA3AF', letterSpacing: 1.5, marginBottom: 12 },
  quickActions: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  actionButton: { alignItems: 'center', width: '22%' },
  actionIconContainer: { width: 50, height: 50, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginBottom: 6, elevation: 1 },
  actionText: { fontSize: 9, color: '#4B5563', fontWeight: '700', textAlign: 'center' },

  // Smart Card
  smartCard: { backgroundColor: 'white', borderRadius: 24, padding: 24, borderWidth: 1, borderColor: '#F1F5F9' },
  smartHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  smartTitle: { fontSize: 10, fontWeight: '900', color: '#1D9E75', letterSpacing: 1 },
  smartMsg: { fontSize: 14, fontWeight: '700', color: '#4B5563', lineHeight: 22, marginBottom: 20 },
  smartProgressBox: { backgroundColor: '#F8FAF9', borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: '#E1F5EE' },
  smartProgressTextRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  smartProgressLabel: { fontSize: 9, fontWeight: '900', color: '#9CA3AF' },
  smartProgressVal: { fontSize: 10, fontWeight: '900', color: '#1F2937' },
  smartBarBg: { height: 8, backgroundColor: '#E5E7EB', borderRadius: 4, overflow: 'hidden' },
  smartBarFill: { height: '100%', borderRadius: 4 },
  smartBtn: { backgroundColor: '#1D9E75', height: 54, borderRadius: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  smartBtnText: { color: 'white', fontSize: 13, fontWeight: '900', letterSpacing: 1 },

  // Riwayat Terkini
  emptyCard: { backgroundColor: 'white', borderRadius: 24, padding: 24, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#F1F5F9' },
  emptyTitle: { fontSize: 13, fontWeight: '900', color: '#4B5563', marginTop: 8 },
  emptySub: { fontSize: 11, color: '#9CA3AF', marginTop: 4, fontWeight: '600' },
  tripRow: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#FFFFFF', borderRadius: 20, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: '#F1F5F9' },
  tripIconWrap: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center' },
  tripTitle: { fontSize: 12, fontWeight: '900', color: '#374151' },
  tripTime: { fontSize: 10, color: '#9CA3AF', marginTop: 4, fontWeight: '700' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContainer: { width: '100%', alignItems: 'center' },
  closeBtn: { alignSelf: 'flex-end', marginBottom: 10, padding: 10 },
  shareCard: { width: width * 0.85, height: screenHeight * 0.55, backgroundColor: '#085041', borderRadius: 32, padding: 30, justifyContent: 'space-between' },
  shareCardHeader: { alignItems: 'center', gap: 8 },
  shareLogoText: { fontSize: 24, fontWeight: '900', color: 'white' },
  wrappedBadge: { backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  wrappedText: { color: '#FAC775', fontSize: 10, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase' },
  shareCardContent: { alignItems: 'center' },
  shareTitle: { fontSize: 20, fontWeight: '900', color: '#FAC775', marginBottom: 4 },
  shareSubtitle: { fontSize: 12, color: 'white', opacity: 0.8, marginBottom: 15 },
  shareBigValue: { fontSize: 60, fontWeight: '900', color: 'white' },
  shareUnit: { fontSize: 16, fontWeight: 'bold', color: '#E1F5EE', letterSpacing: 2 },
  shareCardFooter: { flexDirection: 'row', gap: 10 },
  footerStatBox: { flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', padding: 12, borderRadius: 16, alignItems: 'center' },
  footerStatLabel: { fontSize: 8, color: 'white', opacity: 0.5, fontWeight: 'bold' },
  footerStatVal: { fontSize: 12, color: 'white', fontWeight: '900', marginTop: 2 },
  modalActions: { width: '100%', marginTop: 20, gap: 12 },
  shareBtnMain: { backgroundColor: '#1D9E75', height: 60, borderRadius: 20, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10 },
  shareBtnText: { color: 'white', fontSize: 15, fontWeight: '900' },
  closeBtnText: { height: 50, justifyContent: 'center', alignItems: 'center' },
  cancelText: { color: 'white', fontSize: 13, fontWeight: 'bold', opacity: 0.6 },

  // Utility Colors
  bgAmber: { backgroundColor: '#F59E0B' },
  bgMintSoft: { backgroundColor: '#F0FFF9' },
  bgAmberSoft: { backgroundColor: '#FFFBEB' },
  bgRedSoft: { backgroundColor: '#FEF2F2' },
  textWhite: { color: 'white' },
  textEmerald: { color: '#1D9E75' },
  textRed: { color: '#EF4444' },
  textGreen: { color: '#10B981' },
  textAmber: { color: '#D97706' },
});