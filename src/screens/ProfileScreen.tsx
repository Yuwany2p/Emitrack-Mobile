import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { User, LogOut, Settings, Award, ChevronRight, Leaf, Shield, CheckCircle, MapPin, X } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { getLevelByPoin, getLevelProgress, LEVEL_BADGES } from '../lib/level';
import LevelBadge from '../components/LevelBadge';
import { SkeletonCard, SkeletonRow } from '../components/Skeleton';
import { KOTA_INDONESIA } from '../lib/wilayah';
import { showToast } from '../components/Toast';

type Profile = {
  username: string | null;
  kota: string | null;
  total_poin: number;
  total_hemat: number;
  streak: number;
};

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const [showCityModal, setShowCityModal] = useState(false);
  const [searchCity, setSearchCity] = useState('');
  const [isUpdatingCity, setIsUpdatingCity] = useState(false);

  useEffect(() => {
    if (user) fetchProfile();
  }, [user]);

  const fetchProfile = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user!.id)
      .single();

    if (data) setProfile(data as Profile);
    setLoading(false);
  };

  const handleSignOut = async () => {
    Alert.alert(
      'Keluar',
      'Apakah kamu yakin ingin keluar dari EmiTrack?',
      [
        { text: 'Batal', style: 'cancel' },
        { 
          text: 'Keluar', 
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut();
            } catch (error: any) {
              Alert.alert('Gagal Keluar', error.message);
            }
          }
        },
      ]
    );
  };

  const updateCity = async (kota: string) => {
    setIsUpdatingCity(true);
    const { error } = await supabase.from('profiles').update({ kota }).eq('id', user!.id);
    if (!error) {
      setProfile(prev => prev ? { ...prev, kota } : null);
      showToast('Kota berhasil diperbarui', 'success');
      setShowCityModal(false);
    } else {
      showToast('Gagal memperbarui kota', 'warning');
    }
    setIsUpdatingCity(false);
  };

  const filteredCities = KOTA_INDONESIA.filter(c => c.toLowerCase().includes(searchCity.toLowerCase())).slice(0, 50);

  if (loading) {
    return (
      <View style={{ flex: 1, padding: 16, backgroundColor: '#F8FAFC', paddingTop: 60 }}>
        <View style={{ alignItems: 'center', marginBottom: 32 }}>
          <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: '#E5E7EB', marginBottom: 12 }} />
          <SkeletonCard style={{ height: 24, width: 120, marginBottom: 4 }} />
          <SkeletonCard style={{ height: 16, width: 160 }} />
        </View>
        <SkeletonRow style={{ marginBottom: 24, borderBottomWidth: 0 }} />
        <SkeletonCard style={{ height: 100, marginBottom: 16 }} />
      </View>
    );
  }

  const displayName = profile?.username || user?.email?.split('@')[0] || 'User';
  const email = user?.email || '';
  const poin = profile?.total_poin ?? 0;
  const levelInfo = getLevelProgress(poin);

  const unlockedBadges = LEVEL_BADGES.filter(b => levelInfo.current.level >= b.levelRequired);
  const lockedBadges = LEVEL_BADGES.filter(b => levelInfo.current.level < b.levelRequired);

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header Profile */}
      <View style={styles.header}>
        <View style={styles.avatarContainer}>
          <Text style={styles.avatarText}>{displayName[0]?.toUpperCase()}</Text>
          <View style={styles.editBadge}>
            <Settings color="white" size={10} />
          </View>
        </View>
        <Text style={styles.name}>{displayName}</Text>
        <Text style={styles.email}>{email}</Text>
        <TouchableOpacity 
          style={styles.cityBtn} 
          onPress={() => { setSearchCity(''); setShowCityModal(true); }}
        >
          <MapPin color="#6B7280" size={14} />
          <Text style={styles.cityText}>{profile?.kota || 'Pilih Kota'}</Text>
        </TouchableOpacity>
      </View>

      {/* Stats Row */}
      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{poin}</Text>
          <Text style={styles.statLabel}>Poin EmiTrack</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{(profile?.total_hemat ?? 0).toFixed(1)} kg</Text>
          <Text style={styles.statLabel}>CO₂ Dihemat</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBox}>
          <Text style={[styles.statValue, { color: '#EA580C' }]}>{profile?.streak ?? 0} Hari</Text>
          <Text style={styles.statLabel}>Streak</Text>
        </View>
      </View>

      {/* Level Info */}
      <View style={styles.section}>
        <LevelBadge poin={poin} size="lg" />
      </View>

      {/* Badges Collection */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Koleksi Lencana</Text>
        <View style={styles.badgeGrid}>
          {unlockedBadges.map((badge, i) => {
            const Icon = badge.icon;
            return (
              <View key={`unlocked-${i}`} style={styles.badgeItem}>
                <View style={[styles.badgeIconWrap, { backgroundColor: '#E1F5EE', borderWidth: 2, borderColor: '#1D9E75' }]}>
                  <Icon color="#1D9E75" size={20} />
                </View>
                <Text style={styles.badgeName}>{badge.nama}</Text>
              </View>
            );
          })}
          {lockedBadges.map((badge, i) => {
            const Icon = badge.icon;
            return (
              <View key={`locked-${i}`} style={[styles.badgeItem, { opacity: 0.5 }]}>
                <View style={[styles.badgeIconWrap, { backgroundColor: '#F3F4F6' }]}>
                  <Icon color="#9CA3AF" size={20} />
                </View>
                <Text style={styles.badgeName}>{badge.nama}</Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* Menu Settings */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Pengaturan Akun</Text>
        <View style={styles.menuCard}>
          {[
            { icon: User, label: 'Edit Profil', color: '#374151', bg: '#F3F4F6' },
            { icon: Shield, label: 'Privasi & Keamanan', color: '#374151', bg: '#F3F4F6' },
            { icon: Award, label: 'Tentang EmiTrack', color: '#374151', bg: '#F3F4F6' },
          ].map((item, i) => {
            const Icon = item.icon;
            return (
              <TouchableOpacity key={i} style={[styles.menuRow, i > 0 && styles.menuDivider]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={[styles.menuIconWrap, { backgroundColor: item.bg }]}>
                    <Icon color={item.color} size={18} />
                  </View>
                  <Text style={styles.menuLabel}>{item.label}</Text>
                </View>
                <ChevronRight color="#D1D5DB" size={18} />
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity style={[styles.menuRow, styles.menuDivider]} onPress={handleSignOut}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={[styles.menuIconWrap, { backgroundColor: '#FEF2F2' }]}>
                <LogOut color="#DC2626" size={18} />
              </View>
              <Text style={[styles.menuLabel, { color: '#DC2626' }]}>Keluar</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      <View style={{ height: 24 }} />

      {/* City Modal */}
      <Modal visible={showCityModal} animationType="slide" transparent={true}>
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
                >
                  <Text style={styles.cityItemText}>{city}</Text>
                  {profile?.kota === city && <CheckCircle color="#1D9E75" size={18} />}
                </TouchableOpacity>
              ))}
              {filteredCities.length === 0 && (
                <Text style={{ textAlign: 'center', color: '#9CA3AF', marginTop: 20 }}>Kota tidak ditemukan</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { alignItems: 'center', paddingTop: 60, paddingBottom: 24, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  avatarContainer: { position: 'relative', marginBottom: 12 },
  avatarText: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#1D9E75', color: 'white', fontSize: 32, fontWeight: 'bold', textAlign: 'center', lineHeight: 80, overflow: 'hidden' },
  editBadge: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#374151', width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#FFFFFF' },
  name: { fontSize: 20, fontWeight: 'bold', color: '#1F2937' },
  email: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  cityBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F3F4F6', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginTop: 12 },
  cityText: { fontSize: 13, fontWeight: '500', color: '#4B5563' },

  statsRow: { flexDirection: 'row', backgroundColor: '#FFFFFF', marginHorizontal: 16, marginTop: -20, borderRadius: 16, paddingVertical: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 12, elevation: 4 },
  statBox: { flex: 1, alignItems: 'center' },
  statDivider: { width: 1, backgroundColor: '#F3F4F6' },
  statValue: { fontSize: 18, fontWeight: 'bold', color: '#1D9E75', marginBottom: 4 },
  statLabel: { fontSize: 11, color: '#6B7280' },

  section: { paddingHorizontal: 16, marginTop: 24 },
  sectionTitle: { fontSize: 14, fontWeight: 'bold', color: '#374151', marginBottom: 12 },

  levelCard: { borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#F3F4F6' },
  levelIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  levelName: { fontSize: 16, fontWeight: 'bold' },
  levelDesc: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  progressBarBg: { height: 8, backgroundColor: 'rgba(0,0,0,0.06)', borderRadius: 4, overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 4 },
  progressText: { fontSize: 11, color: '#6B7280', fontWeight: '500' },

  badgeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  badgeItem: { width: '30%', alignItems: 'center', marginBottom: 8 },
  badgeIconWrap: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  badgeName: { fontSize: 11, fontWeight: '500', color: '#4B5563', textAlign: 'center' },

  menuCard: { backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#F3F4F6', overflow: 'hidden' },
  menuRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16, paddingHorizontal: 16 },
  menuDivider: { borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  menuIconWrap: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  menuLabel: { fontSize: 14, fontWeight: '500', color: '#374151' },
});
