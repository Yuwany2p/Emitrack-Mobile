import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  RefreshControl,
  Animated,
  Dimensions,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useAuth } from '../context/AuthContext';

import {
  MapPin,
  Edit3,
  Mail,
  Calendar,
  Shield,
  Sprout,
  Flame,
  Bus,
  Wind,
  TreePine,
  Trophy,
  Lock,
  Check,
  LogOut,
  Building2,
  X,
  CheckCircle,
} from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { getLevelByPoin, getLevelProgress, LEVEL_BADGES } from '../lib/level';
import LevelBadge from '../components/LevelBadge';
import { SkeletonCard, SkeletonRow, SkeletonText } from '../components/Skeleton';
import { KOTA_INDONESIA } from '../lib/wilayah';
import { showToast } from '../components/Toast';

type Profile = {
  id: string;
  email: string;
  username: string | null;
  full_name: string | null;
  kota: string | null;
  total_poin: number;
  total_hemat: number;
  streak: number;
  created_at: string;
};

type TripStats = {
  totalTrip: number;
  totalJarak: number;
  totalEmisi: number;
  totalHemat: number;
  tripUmumCount: number;
};

const BADGE_DEFINITIONS = [
  {
    id: 'pemula',
    icon: Sprout,
    color: '#1D9E75',
    nama: 'Pemula Hijau',
    deskripsi: 'Catat perjalanan pertamamu',
    check: (p: Profile, s: TripStats) => s.totalTrip >= 1,
    progress: (p: Profile, s: TripStats) => ({ val: Math.min(s.totalTrip, 1), max: 1, label: 'trip' }),
  },
  {
    id: 'konsisten',
    icon: Flame,
    color: '#F97316',
    nama: 'Konsisten',
    deskripsi: 'Streak 3 hari berturut-turut',
    check: (p: Profile, s: TripStats) => p.streak >= 3,
    progress: (p: Profile, s: TripStats) => ({ val: Math.min(p.streak, 3), max: 3, label: 'hari' }),
  },
  {
    id: 'green_commuter',
    icon: Bus,
    color: '#3B82F6',
    nama: 'Green Commuter',
    deskripsi: 'Gunakan transportasi umum 7x',
    check: (p: Profile, s: TripStats) => s.tripUmumCount >= 7,
    progress: (p: Profile, s: TripStats) => ({ val: Math.min(s.tripUmumCount, 7), max: 7, label: 'trip' }),
  },
  {
    id: 'penyelamat',
    icon: Wind,
    color: '#06B6D4',
    nama: 'Penyelamat Udara',
    deskripsi: 'Hemat 10 kg CO₂ total',
    check: (p: Profile, s: TripStats) => p.total_hemat >= 10,
    progress: (p: Profile, s: TripStats) => ({ val: Math.min(p.total_hemat, 10), max: 10, label: 'kg' }),
  },
  {
    id: 'eco_warrior',
    icon: TreePine,
    color: '#16A34A',
    nama: 'Eco Warrior',
    deskripsi: 'Hemat 50 kg CO₂ total',
    check: (p: Profile, s: TripStats) => p.total_hemat >= 50,
    progress: (p: Profile, s: TripStats) => ({ val: Math.min(p.total_hemat, 50), max: 50, label: 'kg' }),
  },
  {
    id: 'legenda',
    icon: Trophy,
    color: '#FAC775',
    nama: 'Legenda Hijau',
    deskripsi: 'Kumpulkan 500 poin',
    check: (p: Profile, s: TripStats) => p.total_poin >= 500,
    progress: (p: Profile, s: TripStats) => ({ val: Math.min(p.total_poin, 500), max: 500, label: 'poin' }),
  },
];

function formatTanggal(iso: string) {
  return new Date(iso).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const { useSafeAreaInsets } = require('react-native-safe-area-context');
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState<TripStats | null>(null);
  const [rankingInfo, setRankingInfo] = useState<{ rank: number; total: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Animated Header Setup
  const HEADER_HEIGHT = 90;
  const scrollY = React.useRef(new Animated.Value(0)).current;
  const diffClamp = Animated.diffClamp(scrollY, 0, HEADER_HEIGHT);
  const headerOpacity = diffClamp.interpolate({
    inputRange: [0, HEADER_HEIGHT],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });
  const [editing, setEditing] = useState(false);
  const [editUsername, setEditUsername] = useState('');
  const [saving, setSaving] = useState(false);

  // City modal
  const [showCityModal, setShowCityModal] = useState(false);
  const [searchCity, setSearchCity] = useState('');
  const [isUpdatingCity, setIsUpdatingCity] = useState(false);

  useEffect(() => {
    if (user) fetchAll();
  }, [user]);

  const fetchAll = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const [{ data: prof }, { data: tripsData }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('trips').select('jenis, jarak_km, emisi_kg, emisi_dihemat').eq('user_id', user.id),
    ]);

    if (prof) {
      setProfile(prof as Profile);
      setEditUsername(prof.username ?? '');

      // Fetch ranking by kota
      if (prof.kota) {
        const { data: kotaProfiles } = await supabase
          .from('profiles')
          .select('id, total_hemat')
          .eq('kota', prof.kota)
          .order('total_hemat', { ascending: false });

        if (kotaProfiles) {
          const rank = kotaProfiles.findIndex((p: any) => p.id === user.id) + 1;
          setRankingInfo({ rank: rank > 0 ? rank : kotaProfiles.length + 1, total: kotaProfiles.length });
        }
      } else {
        setRankingInfo(null);
      }
    }

    if (tripsData) {
      const s: TripStats = {
        totalTrip: tripsData.length,
        totalJarak: tripsData.reduce((a: number, t: any) => a + t.jarak_km, 0),
        totalEmisi: tripsData.reduce((a: number, t: any) => a + t.emisi_kg, 0),
        totalHemat: tripsData.reduce((a: number, t: any) => a + t.emisi_dihemat, 0),
        tripUmumCount: tripsData.filter((t: any) => t.jenis === 'transportasi_umum').length,
      };
      setStats(s);
    }

    setLoading(false);
  }, [user]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAll();
    setRefreshing(false);
  }, [fetchAll]);

  const handleSaveProfil = async () => {
    if (!user || !profile) return;
    setSaving(true);
    const { data, error } = await supabase
      .from('profiles')
      .update({ username: editUsername.trim() || null })
      .eq('id', user.id)
      .select()
      .single();
    if (!error && data) {
      setProfile(data as Profile);
      showToast('Profil berhasil diperbarui', 'success');
    } else {
      showToast('Gagal memperbarui profil', 'warning');
    }
    setSaving(false);
    setEditing(false);
  };

  const updateCity = async (kota: string) => {
    if (!user) return;
    setIsUpdatingCity(true);
    const { error } = await supabase.from('profiles').update({ kota }).eq('id', user.id);
    if (!error) {
      setProfile(prev => prev ? { ...prev, kota } : null);
      showToast('Kota berhasil diperbarui', 'success');
      setShowCityModal(false);

      // Re-fetch ranking
      const { data: kotaProfiles } = await supabase
        .from('profiles')
        .select('id, total_hemat')
        .eq('kota', kota)
        .order('total_hemat', { ascending: false });
      if (kotaProfiles) {
        const rank = kotaProfiles.findIndex((p: any) => p.id === user!.id) + 1;
        setRankingInfo({ rank: rank > 0 ? rank : kotaProfiles.length + 1, total: kotaProfiles.length });
      }
    } else {
      showToast('Gagal memperbarui kota', 'warning');
    }
    setIsUpdatingCity(false);
  };

  const handleSignOut = () => {
    Alert.alert(
      'Keluar',
      'Apakah kamu yakin ingin keluar dari EmiTrack?',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Ya, Keluar',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut();
            } catch (error: any) {
              Alert.alert('Gagal Keluar', error.message);
            }
          },
        },
      ]
    );
  };

  const filteredCities = KOTA_INDONESIA
    .filter(c => c.toLowerCase().includes(searchCity.toLowerCase()))
    .slice(0, 50);

  const googleName = user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? null;
  const googleAvatar = user?.user_metadata?.avatar_url ?? user?.user_metadata?.picture ?? null;
  const displayName = profile?.full_name || googleName || profile?.username || user?.email?.split('@')[0] || 'User';
  const avatarLetter = displayName[0]?.toUpperCase() ?? 'U';

  // ── LOADING STATE ──
  if (loading) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 100 }}>
        <View style={styles.topBar}>
          <Text style={styles.topBarTitle}>Profil Saya</Text>
          <Text style={styles.topBarSub}>Statistik & pencapaian personalmu</Text>
        </View>
        <View style={{ padding: 16 }}>
          <View style={styles.card}>
            <View style={{ flexDirection: 'row', gap: 16 }}>
              <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: '#E5E7EB' }} />
              <View style={{ flex: 1, gap: 8, paddingTop: 8 }}>
                <SkeletonText width="60%" />
                <SkeletonText width="40%" />
                <SkeletonText width="30%" />
              </View>
            </View>
          </View>
          <View style={{ marginTop: 24 }}>
            <SkeletonText width="40%" style={{ marginBottom: 12 }} />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
              {[1, 2, 3, 4].map(i => <SkeletonCard key={i} style={{ width: '47%' }} />)}
            </View>
          </View>
        </View>
      </ScrollView>
    );
  }

  const poin = profile?.total_poin ?? 0;
  const levelInfo = getLevelProgress(poin);

  return (
    <>
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
          <View>
            <Text style={styles.topBarTitle}>Profil Saya</Text>
            <Text style={styles.topBarSub}>Kelola akun dan pengaturan</Text>
          </View>
        </View>
      </Animated.View>

      <Animated.ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingTop: insets.top + HEADER_HEIGHT - 5, paddingBottom: 100 + insets.bottom, minHeight: Dimensions.get('window').height + HEADER_HEIGHT }}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1D9E75']} />}
      >
        <View style={{ padding: 16, paddingTop: 0, gap: 20 }}>

          {/* ── HEADER PROFIL ── */}
          <View style={styles.card}>
            {editing ? (
              // Edit Mode
              <View style={{ gap: 12 }}>
                <Text style={styles.editTitle}>Edit Profil</Text>
                <View>
                  <Text style={styles.inputLabel}>Username</Text>
                  <TextInput
                    style={styles.input}
                    value={editUsername}
                    onChangeText={setEditUsername}
                    placeholder="Masukkan username..."
                    placeholderTextColor="#9CA3AF"
                  />
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity
                    style={styles.saveBtn}
                    onPress={handleSaveProfil}
                    disabled={saving}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.saveBtnText}>{saving ? 'Menyimpan...' : 'Simpan'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.cancelBtn}
                    onPress={() => setEditing(false)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.cancelBtnText}>Batal</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              // Display Mode
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 16 }}>
                {/* Avatar */}
                {googleAvatar ? (
                  <Image source={{ uri: googleAvatar }} style={styles.avatarImage} />
                ) : (
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{avatarLetter}</Text>
                  </View>
                )}
                {/* Info */}
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.displayName} numberOfLines={1}>{displayName}</Text>
                  {profile?.username && (
                    <Text style={styles.username}>@{profile.username}</Text>
                  )}
                  <TouchableOpacity
                    style={styles.cityChip}
                    onPress={() => { setSearchCity(''); setShowCityModal(true); }}
                    activeOpacity={0.7}
                  >
                    <MapPin color="#6B7280" size={13} />
                    <Text style={styles.cityChipText}>{profile?.kota || 'Pilih Kota'}</Text>
                  </TouchableOpacity>
                  {!profile?.username && !profile?.kota && (
                    <Text style={styles.incompleteHint}>Belum lengkap — tambahkan username & kota</Text>
                  )}
                </View>
                {/* Edit button */}
                <TouchableOpacity
                  style={styles.editBtn}
                  onPress={() => setEditing(true)}
                  activeOpacity={0.7}
                >
                  <Edit3 color="#6B7280" size={14} />
                  <Text style={styles.editBtnText}>Edit</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* ── STATISTIK PERJALANAN ── */}
          <View>
            <Text style={styles.sectionLabel}>STATISTIK PERJALANAN</Text>
            <View style={styles.statsGrid}>
              {[
                { label: 'Total Trip', val: `${stats?.totalTrip ?? 0}`, unit: 'perjalanan', color: '#374151' },
                { label: 'Total Jarak', val: `${(stats?.totalJarak ?? 0).toFixed(1)}`, unit: 'km', color: '#3B82F6' },
                { label: 'CO₂ Dihasilkan', val: `${(stats?.totalEmisi ?? 0).toFixed(2)}`, unit: 'kg CO₂', color: '#EF4444' },
                { label: 'CO₂ Dihemat', val: `${(stats?.totalHemat ?? 0).toFixed(2)}`, unit: 'kg CO₂', color: '#1D9E75' },
              ].map((s, i) => (
                <View key={i} style={styles.statCard}>
                  <Text style={styles.statLabel}>{s.label}</Text>
                  <Text style={[styles.statValue, { color: s.color }]}>{s.val}</Text>
                  <Text style={styles.statUnit}>{s.unit}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* ── GAMIFIKASI ── */}
          <View>
            <Text style={styles.sectionLabel}>GAMIFIKASI</Text>
            <View style={{ marginBottom: 12 }}>
              <LevelBadge poin={poin} size="lg" />
            </View>
            <View style={styles.statsGrid}>
              {/* Streak */}
              <View style={[styles.statCard, { alignItems: 'center' }]}>
                <Flame color="#F97316" size={22} />
                <Text style={[styles.statValue, { color: '#F97316', marginTop: 4 }]}>{profile?.streak ?? 0}</Text>
                <Text style={styles.statUnit}>Streak Hari</Text>
              </View>
              {/* Ranking Kota */}
              <View style={[styles.statCard, { alignItems: 'center' }]}>
                <Building2 color="#3B82F6" size={22} />
                {rankingInfo ? (
                  <>
                    <Text style={[styles.statValue, { color: '#1D9E75', marginTop: 4 }]}>#{rankingInfo.rank}</Text>
                    <Text style={[styles.statUnit, { textAlign: 'center' }]}>
                      dari {rankingInfo.total} di {profile?.kota ?? 'kotamu'}
                    </Text>
                  </>
                ) : (
                  <>
                    <Text style={[styles.statValue, { color: '#D1D5DB', marginTop: 4 }]}>—</Text>
                    <Text style={styles.statUnit}>Set kota dulu</Text>
                  </>
                )}
              </View>
            </View>
          </View>

          {/* ── BADGE AKTIVITAS ── */}
          <View>
            <Text style={styles.sectionLabel}>BADGE AKTIVITAS</Text>
            <View style={styles.badgeGrid}>
              {BADGE_DEFINITIONS.map(badge => {
                const unlocked = profile && stats ? badge.check(profile, stats) : false;
                const prog = profile && stats ? badge.progress(profile, stats) : null;
                const pct = prog ? Math.min(100, Math.round((prog.val / prog.max) * 100)) : 0;
                const Icon = badge.icon;

                return (
                  <View
                    key={badge.id}
                    style={[
                      styles.badgeCard,
                      unlocked
                        ? { backgroundColor: '#E1F5EE', borderColor: '#9FE1CB' }
                        : { backgroundColor: '#FAFAFA', borderColor: '#F3F4F6', opacity: 0.65 },
                    ]}
                  >
                    {/* Corner marker */}
                    <View style={styles.badgeCorner}>
                      {unlocked ? (
                        <Check color="#1D9E75" size={12} />
                      ) : (
                        <Lock color="#9CA3AF" size={12} />
                      )}
                    </View>

                    <View style={[styles.badgeIconWrap, !unlocked && { opacity: 0.5 }]}>
                      <Icon color={unlocked ? badge.color : '#9CA3AF'} size={28} />
                    </View>
                    <Text style={styles.badgeName}>{badge.nama}</Text>
                    <Text style={styles.badgeDesc}>{badge.deskripsi}</Text>

                    {/* Progress bar (only if locked) */}
                    {!unlocked && prog && (
                      <View style={{ marginTop: 8, width: '100%' }}>
                        <View style={styles.progressBg}>
                          <View style={[styles.progressFill, { width: `${pct}%` }]} />
                        </View>
                        <Text style={styles.progressLabel}>
                          {typeof prog.val === 'number' ? prog.val.toFixed(prog.label === 'kg' ? 1 : 0) : prog.val}/{prog.max} {prog.label}
                        </Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          </View>

          {/* ── BADGE LEVEL ── */}
          <View>
            <Text style={styles.sectionLabel}>BADGE LEVEL</Text>
            <View style={styles.badgeLevelGrid}>
              {LEVEL_BADGES.map((badge, i) => {
                const currentLevel = getLevelByPoin(poin).level;
                const unlocked = currentLevel >= badge.levelRequired;
                const Icon = badge.icon;

                return (
                  <View
                    key={badge.nama}
                    style={[
                      styles.badgeLevelCard,
                      unlocked
                        ? { backgroundColor: '#E1F5EE', borderColor: '#9FE1CB' }
                        : { backgroundColor: '#FAFAFA', borderColor: '#F3F4F6', opacity: 0.65 },
                    ]}
                  >
                    <View style={styles.badgeCorner}>
                      {unlocked ? (
                        <Check color="#1D9E75" size={12} />
                      ) : (
                        <Lock color="#9CA3AF" size={12} />
                      )}
                    </View>
                    <View style={[styles.badgeIconWrap, !unlocked && { opacity: 0.5 }]}>
                      <Icon color={unlocked ? '#1D9E75' : '#9CA3AF'} size={28} />
                    </View>
                    <Text style={[styles.badgeName, { textAlign: 'center' }]}>{badge.nama}</Text>
                    <Text style={[styles.badgeDesc, { textAlign: 'center' }]}>{badge.deskripsi}</Text>
                  </View>
                );
              })}
            </View>
          </View>

          {/* ── INFO AKUN ── */}
          <View>
            <Text style={styles.sectionLabel}>INFO AKUN</Text>
            <View style={styles.card}>
              {[
                { label: 'Email', val: user?.email ?? '—', icon: Mail },
                { label: 'Bergabung sejak', val: profile ? formatTanggal(profile.created_at) : '—', icon: Calendar },
                { label: 'Provider', val: 'Google', icon: Shield },
              ].map((item, i) => {
                const Icon = item.icon;
                return (
                  <View
                    key={i}
                    style={[
                      styles.infoRow,
                      i < 2 && { borderBottomWidth: 1, borderBottomColor: '#F9FAFB' },
                    ]}
                  >
                    <View style={styles.infoLeft}>
                      <Icon color="#6B7280" size={16} />
                      <Text style={styles.infoLabel}>{item.label}</Text>
                    </View>
                    <Text style={styles.infoValue} numberOfLines={1}>{item.val}</Text>
                  </View>
                );
              })}
            </View>
          </View>

          {/* ── TOMBOL KELUAR ── */}
          <View style={{ paddingVertical: 8 }}>
            <TouchableOpacity
              style={styles.logoutBtn}
              onPress={handleSignOut}
              activeOpacity={0.7}
            >
              <LogOut color="#EF4444" size={18} />
              <Text style={styles.logoutBtnText}>Keluar dari Akun</Text>
            </TouchableOpacity>
          </View>

        </View>
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
      
      {/* ── CITY MODAL ── */}
      <Modal visible={showCityModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Pilih Kota Domisili</Text>
              <TouchableOpacity onPress={() => setShowCityModal(false)}>
                <X color="#9CA3AF" size={24} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.searchInput}
              placeholder="Cari kota..."
              placeholderTextColor="#9CA3AF"
              value={searchCity}
              onChangeText={setSearchCity}
            />
            <ScrollView style={styles.cityList} keyboardShouldPersistTaps="handled">
              {filteredCities.map(city => (
                <TouchableOpacity
                  key={city}
                  style={styles.cityItem}
                  onPress={() => updateCity(city)}
                  disabled={isUpdatingCity}
                  activeOpacity={0.7}
                >
                  <Text style={styles.cityItemText}>{city}</Text>
                  {profile?.kota === city && <CheckCircle color="#1D9E75" size={18} />}
                </TouchableOpacity>
              ))}
              {filteredCities.length === 0 && (
                <Text style={{ textAlign: 'center', color: '#9CA3AF', marginTop: 20 }}>
                  Kota tidak ditemukan
                </Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },

  // Top bar
  topBar: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  topBarTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  topBarSub: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 2,
  },

  // Card
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },

  // Avatar
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#1D9E75',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#1D9E75',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  avatarImage: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  avatarText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  displayName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  username: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 1,
  },
  cityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  cityChipText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#4B5563',
  },
  incompleteHint: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 6,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  editBtnText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },

  // Edit form
  editTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  inputLabel: {
    fontSize: 11,
    color: '#9CA3AF',
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1F2937',
  },
  saveBtn: {
    backgroundColor: '#1D9E75',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  cancelBtn: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  cancelBtnText: {
    color: '#6B7280',
    fontSize: 13,
    fontWeight: '500',
  },

  // Section label
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9CA3AF',
    letterSpacing: 1.5,
    marginBottom: 10,
    paddingHorizontal: 2,
  },

  // Stats grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    padding: 14,
    width: '48%',
    flexGrow: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  statLabel: {
    fontSize: 11,
    color: '#9CA3AF',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#374151',
  },
  statUnit: {
    fontSize: 10,
    color: '#9CA3AF',
    marginTop: 2,
  },

  // Badge Aktivitas grid (3 cols)
  badgeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  badgeCard: {
    width: '31%',
    flexGrow: 1,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    alignItems: 'center',
    position: 'relative',
  },
  badgeCorner: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  badgeIconWrap: {
    marginBottom: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeName: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#374151',
    lineHeight: 14,
  },
  badgeDesc: {
    fontSize: 9,
    color: '#9CA3AF',
    marginTop: 2,
    lineHeight: 12,
  },
  progressBg: {
    height: 5,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#1D9E75',
    borderRadius: 3,
  },
  progressLabel: {
    fontSize: 8,
    color: '#9CA3AF',
    marginTop: 3,
    textAlign: 'center',
  },

  // Badge Level grid (2 cols)
  badgeLevelGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  badgeLevelCard: {
    width: '48%',
    flexGrow: 1,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    alignItems: 'center',
    position: 'relative',
  },

  // Info akun
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  infoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoLabel: {
    fontSize: 13,
    color: '#6B7280',
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '500',
    color: '#374151',
    maxWidth: '55%',
    textAlign: 'right',
  },

  // Logout
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 2,
    borderColor: '#FCA5A5',
    borderRadius: 14,
    paddingVertical: 14,
  },
  logoutBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#EF4444',
  },

  // City modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '70%',
    paddingBottom: 32,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  searchInput: {
    marginHorizontal: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1F2937',
    marginBottom: 8,
  },
  cityList: {
    paddingHorizontal: 20,
  },
  cityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F9FAFB',
  },
  cityItemText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
});
