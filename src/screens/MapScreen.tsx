import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Alert, ScrollView, ActivityIndicator, Dimensions, Animated, PanResponder } from 'react-native';
import MapView, { Polyline, Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { Play, Square, MapPin, Navigation, Bike, Car, Train, Bus, Leaf, LocateFixed } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { hitungJarakKumulatif, validasiPerjalanan, isOffRoute } from '../lib/gps';
import { hitungEmisi, rekomendasiRute, Rekomendasi, RATA_RATA_NASIONAL } from '../lib/emisi';
import { showToast } from '../components/Toast';
import LocationInput, { NominatimResult } from '../components/LocationInput';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { height: windowHeight } = Dimensions.get('window');

export default function MapScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  // -- State Peta & GPS Default --
  const mapRef = useRef<MapView>(null);
  const watchSubscription = useRef<Location.LocationSubscription | null>(null);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);

  // -- State Pencarian Rute (OSM) --
  const [asal, setAsal] = useState<NominatimResult | null>(null);
  const [tujuan, setTujuan] = useState<NominatimResult | null>(null);
  const [ruteOSRM, setRuteOSRM] = useState<{ latitude: number, longitude: number }[] | null>(null);
  const [jarakKm, setJarakKm] = useState(0);
  const [durasiMenit, setDurasiMenit] = useState(0);
  const [isFetchingRoute, setIsFetchingRoute] = useState(false);
  const [selectedModa, setSelectedModa] = useState<string | null>(null);
  const [activeModa, setActiveModa] = useState<string>('Mobil Pribadi');

  // -- State Navigasi (Live Tracking) --
  const [isNavigating, setIsNavigating] = useState(false);
  const [path, setPath] = useState<{ latitude: number, longitude: number }[]>([]);
  const [navWaktu, setNavWaktu] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // -- State Mode Pick Map (Gojek-style) --
  const [isPickingMap, setIsPickingMap] = useState<'asal' | 'tujuan' | null>(null);
  const [mapCenterRegion, setMapCenterRegion] = useState<{ latitude: number, longitude: number } | null>(null);
  const [isReverseGeocoding, setIsReverseGeocoding] = useState(false);
  
  // -- State Rerouting --
  const lastRerouteTime = useRef<number>(0);

  // -- State Bottom Sheet Animasi --
  const SHEET_MAX_HEIGHT = windowHeight * 0.45;
  const SHEET_MIN_HEIGHT = 120;
  const SNAP_EXPANDED = 0;
  const SNAP_COLLAPSED = SHEET_MAX_HEIGHT - SHEET_MIN_HEIGHT;

  const translateY = useRef(new Animated.Value(SNAP_EXPANDED)).current;
  const lastGestureDy = useRef(SNAP_EXPANDED);
  const [isSheetExpanded, setIsSheetExpanded] = useState(true);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dy) > 5,
      onPanResponderGrant: () => {
        translateY.setOffset(lastGestureDy.current);
        translateY.setValue(0);
      },
      onPanResponderMove: (_, gestureState) => {
        const newY = gestureState.dy;
        if (lastGestureDy.current + newY < SNAP_EXPANDED - 20) {
          translateY.setValue(newY * 0.2); // Resistance when swiping up further
        } else {
          translateY.setValue(newY);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        translateY.flattenOffset();
        const currentY = lastGestureDy.current + gestureState.dy;
        
        let targetY = SNAP_EXPANDED;
        if (gestureState.vy > 0.5 || currentY > SNAP_COLLAPSED / 2) {
          targetY = SNAP_COLLAPSED; // Swipe down to collapse
        } else {
          targetY = SNAP_EXPANDED;  // Swipe up to expand
        }

        Animated.spring(translateY, {
          toValue: targetY,
          tension: 50,
          friction: 8,
          useNativeDriver: true,
        }).start(() => {
          lastGestureDy.current = targetY;
          setIsSheetExpanded(targetY === SNAP_EXPANDED);
        });
      },
    })
  ).current;

  // Reset animation when new route is loaded
  useEffect(() => {
    if (ruteOSRM) {
      Animated.spring(translateY, {
        toValue: SNAP_EXPANDED,
        useNativeDriver: true,
      }).start();
      lastGestureDy.current = SNAP_EXPANDED;
      setIsSheetExpanded(true);
    }
  }, [ruteOSRM]);

  // 1. Minta Izin GPS saat pertama buka
  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Izin ditolak', 'Akses lokasi dibutuhkan untuk tracking.');
        return;
      }
      let loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setLocation(loc);

      // Langsung zoom ke lokasi saat ini ketika berhasil didapatkan
      mapRef.current?.animateToRegion({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      }, 1000);

      // Auto-set Asal ke lokasi saat ini jika belum ada
      if (!asal) {
        setAsal({
          lat: loc.coords.latitude.toString(),
          lon: loc.coords.longitude.toString(),
          display_name: 'Lokasi Anda Saat Ini'
        });
      }
    })();
    return () => {
      if (watchSubscription.current) watchSubscription.current.remove();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // 1.5 Sembunyikan Tab Bar saat Pick Map / Navigasi
  useEffect(() => {
    navigation.setOptions({
      tabBarStyle: { display: isPickingMap || isNavigating ? 'none' : 'flex' },
    });
  }, [navigation, isPickingMap, isNavigating]);

  // 2. Kalkulasi Rute GMaps saat Asal & Tujuan atau mode aktif berubah
  useEffect(() => {
    if (asal && tujuan) {
      fetchGoogleRoute(asal, tujuan, activeModa);
    } else {
      setRuteOSRM(null);
      setJarakKm(0);
      setDurasiMenit(0);
      setSelectedModa(null);
    }
  }, [asal, tujuan, activeModa]);

  const GOOGLE_MAPS_API_KEY = 'AIzaSyARVvY83wAu_H6ezvB-WmhOHsaN63hHmMk';

  // Fungsi untuk mendecode Google Polyline menjadi array coordinate
  const decodePolyline = (t: string, e = 5) => {
    let n, o, u = 0, l = 0, r = 0, d: { latitude: number, longitude: number }[] = [], h = 0, i = 0, a = null, c = Math.pow(10, e);
    while (u < t.length) {
      a = null; h = 0; i = 0;
      do { a = t.charCodeAt(u++) - 63; i |= (31 & a) << h; h += 5; } while (a >= 32);
      n = 1 & i ? ~(i >> 1) : i >> 1; h = i = 0;
      do { a = t.charCodeAt(u++) - 63; i |= (31 & a) << h; h += 5; } while (a >= 32);
      o = 1 & i ? ~(i >> 1) : i >> 1; l += n; r += o;
      d.push({ latitude: l / c, longitude: r / c });
    }
    return d;
  };

  const fetchGoogleRoute = async (start: NominatimResult, end: NominatimResult, mode: string) => {
    setIsFetchingRoute(true);
    try {
      let travelMode = 'DRIVE';
      let routingPref: any = 'TRAFFIC_AWARE';

      if (mode.includes('Motor')) {
        travelMode = 'TWO_WHEELER';
      } else if (mode.includes('Sepeda')) {
        travelMode = 'WALK';
        routingPref = undefined;
      } else if (mode.includes('KRL') || mode.includes('TransJakarta') || mode.includes('LRT') || mode.includes('MRT')) {
        travelMode = 'TRANSIT';
        routingPref = undefined;
      }

      const requestBody: any = {
        origin: {
          location: { latLng: { latitude: Number(start.lat), longitude: Number(start.lon) } }
        },
        destination: {
          location: { latLng: { latitude: Number(end.lat), longitude: Number(end.lon) } }
        },
        travelMode: travelMode,
      };

      if (routingPref) {
        requestBody.routingPreference = routingPref;
      }

      const res = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
          'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline'
        },
        body: JSON.stringify(requestBody)
      });

      const data = await res.json();

      if (data.error) {
        throw new Error(data.error.message || 'Gagal mencari rute Google Routes API');
      }

      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0];

        // Decode polyline string dari Google Routes API
        const coords = decodePolyline(route.polyline.encodedPolyline);

        setRuteOSRM(coords);
        setJarakKm(Number((route.distanceMeters / 1000).toFixed(1)));

        // duration bernilai string e.g., "217s"
        const durationSecs = parseInt(route.duration.replace('s', ''));
        setDurasiMenit(Math.round(durationSecs / 60));

        // Paskan kamera peta ke rute
        setTimeout(() => {
          mapRef.current?.fitToCoordinates(coords, {
            edgePadding: { top: 250, right: 50, bottom: 400, left: 50 },
            animated: true,
          });
        }, 500);
      } else {
        throw new Error('Tidak ada rute yang ditemukan');
      }
    } catch (err) {
      console.error('Google Maps fetch error:', err);
      showToast('Gagal mengambil rute Google Maps', 'warning');
    } finally {
      setIsFetchingRoute(false);
    }
  };

  // 3. Handle Konfirmasi Pemilihan Lokasi (Gojek-style)
  const handleConfirmMapPick = async () => {
    if (!mapCenterRegion || !isPickingMap) return;

    setIsReverseGeocoding(true);
    const { latitude, longitude } = mapCenterRegion;

    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`, {
        headers: {
          'User-Agent': 'EmitrackMobileApp/1.0 (contact@emitrack.com)',
          'Accept': 'application/json'
        }
      });
      const data = await res.json();
      const addressName = data.display_name || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;

      const nominatimData: NominatimResult = {
        lat: latitude.toString(),
        lon: longitude.toString(),
        display_name: addressName
      };

      if (isPickingMap === 'asal') {
        setAsal(nominatimData);
      } else {
        setTujuan(nominatimData);
      }

      showToast(`Titik ${isPickingMap === 'asal' ? 'Asal' : 'Tujuan'} berhasil dipilih`, 'success');
    } catch (error) {
      showToast('Gagal mendapatkan alamat dari titik ini', 'warning');
    } finally {
      setIsReverseGeocoding(false);
      setIsPickingMap(null); // Keluar dari mode pick map
    }
  };

  // 4. Rekomendasi
  const asalLatLng: [number, number] | null = asal ? [Number(asal.lat), Number(asal.lon)] : null;
  const tujuanLatLng: [number, number] | null = tujuan ? [Number(tujuan.lat), Number(tujuan.lon)] : null;
  const emisiMobil = hitungEmisi('mobil', 'ron92', jarakKm);
  const rekomendasi = jarakKm > 0 && asalLatLng && tujuanLatLng
    ? rekomendasiRute(emisiMobil, jarakKm, asalLatLng[0], asalLatLng[1], tujuanLatLng[0], tujuanLatLng[1])
    : [];

  // 4. Mulai Navigasi
  const startNavigation = async (rec: Rekomendasi) => {
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      showToast('Akses lokasi ditolak', 'warning');
      return;
    }

    setSelectedModa(rec.moda);
    setPath([]);
    setNavWaktu(0);
    setIsNavigating(true);

    // Zoom ke pengguna
    if (location) {
      mapRef.current?.animateCamera({ center: location.coords, zoom: 17 });
    }

    // Mulai Timer
    timerRef.current = setInterval(() => {
      setNavWaktu(prev => prev + 1);
    }, 1000);

    // Mulai Watch GPS
    watchSubscription.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 5000,
        distanceInterval: 5,
      },
      (loc) => {
        setLocation(loc);
        
        // Update Camera Navigasi
        mapRef.current?.animateCamera({ 
          center: loc.coords, 
          heading: loc.coords.heading || 0,
          pitch: 45,
          zoom: 18 
        }, { duration: 1000 });

        setPath(prevPath => [...prevPath, { latitude: loc.coords.latitude, longitude: loc.coords.longitude }]);
      }
    );
  };

  // 4.5 Auto-Reroute Effect: Cek jika keluar jalur saat navigasi aktif
  useEffect(() => {
    if (isNavigating && location && ruteOSRM && ruteOSRM.length > 0) {
      const offRoute = isOffRoute(location.coords, ruteOSRM, 0.05); // 50m
      const now = Date.now();
      
      if (offRoute && now - lastRerouteTime.current > 15000) {
        lastRerouteTime.current = now;
        showToast('Keluar jalur, mencari rute baru...', 'info');
        
        setAsal({
          lat: location.coords.latitude.toString(),
          lon: location.coords.longitude.toString(),
          display_name: 'Lokasi Anda Saat Ini'
        });
      }
    }
  }, [location, isNavigating, ruteOSRM]);

  // 5. Batal / Akhiri Navigasi
  const stopNavigation = () => {
    setIsNavigating(false);
    if (watchSubscription.current) {
      watchSubscription.current.remove();
      watchSubscription.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setPath([]);
    setNavWaktu(0);
    setSelectedModa(null);

    // Zoom kembali ke seluruh rute jika ada
    if (ruteOSRM) {
      mapRef.current?.fitToCoordinates(ruteOSRM, {
        edgePadding: { top: 250, right: 50, bottom: 400, left: 50 },
        animated: true,
      });
    }
  };

  // 6. Selesai & Simpan Trip
  const saveTrip = async () => {
    const tujuanLatLng = tujuan ? { lat: Number(tujuan.lat), lon: Number(tujuan.lon) } : null;
    if (!user || !selectedModa || !tujuanLatLng) return;
    setIsSaving(true);

    // Validasi jarak dsb menggunakan logic GPS
    const walkedArray: [number, number][] = path.map(p => [p.latitude, p.longitude]);
    const hasil = validasiPerjalanan(walkedArray, jarakKm, tujuanLatLng);

    if (!hasil.valid) {
      showToast(hasil.pesan, 'warning');
      setIsSaving(false);
      return;
    }

    const rec = rekomendasi.find(r => r.moda === selectedModa);
    if (!rec) {
      setIsSaving(false); return;
    }

    const isPrivate = selectedModa.includes('Pribadi');
    const dbJenis = isPrivate
      ? (selectedModa.toLowerCase().includes('motor') ? 'motor' : 'mobil')
      : 'transportasi_umum';

    const dbBbm = isPrivate
      ? 'ron92'
      : selectedModa.toLowerCase().includes('sepeda') ? 'sepeda'
        : selectedModa.toLowerCase().includes('krl') ? 'krl' : 'transjakarta';

    const emisiDihemat = isPrivate ? 0 : Math.max(0, rec.hemat);

    const { error } = await supabase.from('trips').insert({
      user_id: user.id,
      jenis: dbJenis,
      bbm: dbBbm,
      jarak_km: Number(hasil.jarakAktual.toFixed(2)),
      emisi_kg: rec.emisi,
      emisi_dihemat: Number(emisiDihemat.toFixed(3)),
      poin_didapat: rec.poin,
    });

    if (error) {
      showToast('Gagal menyimpan: ' + error.message, 'warning');
      setIsSaving(false);
      return;
    }

    // Update Profile
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    if (profile) {
      await supabase.from('profiles').update({
        total_poin: (profile.total_poin || 0) + rec.poin,
        total_hemat: Number(((profile.total_hemat || 0) + emisiDihemat).toFixed(2)),
      }).eq('id', user.id);
    }

    showToast(`Perjalanan Hijau Disimpan! +${rec.poin} Poin`, 'success');
    setIsSaving(false);
    stopNavigation();

    // Redirect ke Riwayat/Dashboard
    navigation.navigate('Dashboard');
  };

  const jarakDitempuh = hitungJarakKumulatif(path);
  const persenProgress = jarakKm > 0 ? Math.min(100, Math.round((jarakDitempuh / jarakKm) * 100)) : 0;

  return (
    <View style={styles.container}>
      {/* 1. PETA FULLSCREEN (Background) */}
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        showsUserLocation={true}
        showsMyLocationButton={false}
        showsCompass={false}
        onRegionChangeComplete={(region) => {
          if (isPickingMap) setMapCenterRegion(region);
        }}
        initialRegion={location ? {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        } : undefined}
      >
        {ruteOSRM && ruteOSRM.length > 0 && (
          <Polyline coordinates={ruteOSRM} strokeColor="#3b82f6" strokeWidth={5} />
        )}

        {isNavigating && path.length > 0 && (
          <Polyline coordinates={path} strokeColor="#1D9E75" strokeWidth={6} />
        )}

        {!isNavigating && asalLatLng && (
          <Marker coordinate={{ latitude: asalLatLng[0], longitude: asalLatLng[1] }} pinColor="#1D9E75" title="Asal" />
        )}
        {!isNavigating && tujuanLatLng && (
          <Marker coordinate={{ latitude: tujuanLatLng[0], longitude: tujuanLatLng[1] }} pinColor="#EF4444" title="Tujuan" />
        )}
      </MapView>

      {/* 1.5 TOMBOL RE-CENTER LOCATION */}
      {!isPickingMap && (
        <TouchableOpacity 
          style={[styles.recenterButton, isNavigating ? { bottom: 220 } : { top: 180 }]} 
          onPress={() => {
            if (location) {
              if (isNavigating) {
                mapRef.current?.animateCamera({ 
                  center: location.coords, 
                  heading: location.coords.heading || 0,
                  pitch: 45,
                  zoom: 18 
                }, { duration: 1000 });
              } else {
                mapRef.current?.animateToRegion({
                  latitude: location.coords.latitude,
                  longitude: location.coords.longitude,
                  latitudeDelta: 0.01,
                  longitudeDelta: 0.01,
                }, 1000);
              }
            }
          }}
        >
          <LocateFixed size={24} color="#1D9E75" />
        </TouchableOpacity>
      )}

      {/* 2. PANEL PENCARIAN (Floating di Atas) */}
      {!isNavigating && !isPickingMap && (
        <View style={[styles.topSearchPanel, { top: insets.top + 16 }]}>
          <View style={styles.searchCard}>
            <View style={{ zIndex: 2 }}>
              <LocationInput
                label="Titik Asal"
                placeholder="Cari lokasi asal..."
                value={asal}
                onChange={setAsal}
                onPickMap={() => setIsPickingMap('asal')}
              />
            </View>
            <View style={{ zIndex: 1 }}>
              <LocationInput
                label="Titik Tujuan"
                placeholder="Cari tujuan..."
                value={tujuan}
                onChange={setTujuan}
                onPickMap={() => setIsPickingMap('tujuan')}
              />
            </View>

            {isFetchingRoute && (
              <View style={{ position: 'absolute', right: 24, top: 50, zIndex: 3 }}>
                <ActivityIndicator size="small" color="#1D9E75" />
              </View>
            )}
          </View>
        </View>
      )}

      {/* 3. PANEL REKOMENDASI (Bottom Sheet Swipeable) */}
      {!isNavigating && !isPickingMap && ruteOSRM && (
        <Animated.View style={[styles.bottomSheetPanel, { bottom: insets.bottom + 100, transform: [{ translateY }] }]}>
          <View {...panResponder.panHandlers} style={styles.sheetHeaderArea}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Rekomendasi Rute Hijau</Text>
            <Text style={styles.sheetSubtitle}>Jarak est: {jarakKm} km • {durasiMenit} mnt (mobil)</Text>
          </View>

          <ScrollView style={styles.recommendationList} showsVerticalScrollIndicator={false} scrollEnabled={isSheetExpanded}>
            {rekomendasi.map((rec, i) => (
              <TouchableOpacity 
                key={i} 
                style={[styles.recCard, activeModa === rec.moda && styles.recCardHighlight]}
                onPress={() => setActiveModa(rec.moda)}
                activeOpacity={0.9}
              >
                <View style={styles.recHeader}>
                  <Text style={styles.recModa}>{rec.moda}</Text>
                  {i === 0 && (
                    <View style={styles.badgeTerhijau}>
                      <Leaf size={12} color="#085041" />
                      <Text style={styles.badgeText}>Terhijau</Text>
                    </View>
                  )}
                </View>

                <View style={styles.recStats}>
                  <View style={styles.recStatItem}>
                    <Text style={styles.recStatLabel}>Emisi</Text>
                    <Text style={styles.recStatValue}>{rec.emisi} kg</Text>
                  </View>
                  <View style={styles.recStatItem}>
                    <Text style={styles.recStatLabel}>Hemat</Text>
                    <Text style={styles.recStatValue}>{rec.moda === 'Mobil Pribadi' ? '-' : `${rec.hemat} kg`}</Text>
                  </View>
                  <View style={styles.recStatItem}>
                    <Text style={styles.recStatLabel}>Reward</Text>
                    <Text style={[styles.recStatValue, { color: '#F59E0B' }]}>+{rec.poin} poin</Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.btnNavigasi, rec.isTooFar && { backgroundColor: '#9CA3AF' }]}
                  onPress={() => startNavigation(rec)}
                  disabled={rec.isTooFar}
                >
                  <Play size={16} color={rec.isTooFar ? '#E5E7EB' : 'white'} fill={rec.isTooFar ? '#E5E7EB' : 'white'} />
                  <Text style={styles.btnNavigasiText}>{rec.isTooFar ? 'Rute Terlalu Jauh' : 'Mulai Navigasi'}</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            ))}
            <View style={{ height: 20 }} />
          </ScrollView>
        </Animated.View>
      )}

      {/* OVERLAY PICK MAP (Gojek-style) */}
      {isPickingMap && (
        <>
          {/* Crosshair Tengah */}
          <View pointerEvents="none" style={styles.crosshairContainer}>
            <View style={styles.crosshairTooltip}>
              <Text style={styles.crosshairText}>Geser peta untuk memilih</Text>
            </View>
            <MapPin size={40} color="#1D9E75" fill="white" style={styles.crosshairIcon} />
            <View style={styles.crosshairDot} />
          </View>

          {/* Panel Bawah Konfirmasi */}
          <View style={styles.pickMapBottomPanel}>
            <Text style={styles.pickMapTitle}>
              Pilih Titik {isPickingMap === 'asal' ? 'Asal' : 'Tujuan'}
            </Text>
            <Text style={styles.pickMapSubtitle}>Posisikan jarum tepat di lokasi yang diinginkan</Text>

            <View style={styles.pickMapActionRow}>
              <TouchableOpacity style={styles.btnBatalPick} onPress={() => setIsPickingMap(null)}>
                <Text style={styles.btnBatalPickText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.btnConfirmPick}
                onPress={handleConfirmMapPick}
                disabled={isReverseGeocoding}
              >
                {isReverseGeocoding ? <ActivityIndicator color="white" /> : <MapPin size={16} color="white" />}
                <Text style={styles.btnConfirmPickText}>
                  {isReverseGeocoding ? 'Menyimpan...' : 'Set Lokasi Ini'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </>
      )}

      {/* 4. OVERLAY SAAT NAVIGASI BERJALAN */}
      {isNavigating && (
        <>
          <View style={[styles.navTopOverlay, { top: insets.top + 16 }]}>
            <View style={styles.navTopCard}>
              <View style={styles.navHeader}>
                <View style={styles.navHeaderLeft}>
                  <View style={styles.navIconBg}><Navigation size={16} color="white" /></View>
                  <View>
                    <Text style={styles.navTitle}>Navigasi Aktif</Text>
                    <Text style={styles.navSubtitle}>{selectedModa}</Text>
                  </View>
                </View>
                <View style={styles.navGpsBadge}>
                  <View style={styles.gpsDot} />
                  <Text style={styles.gpsText}>GPS Aktif</Text>
                </View>
              </View>

              <View style={styles.progressContainer}>
                <View style={styles.progressHeader}>
                  <Text style={styles.progressLabel}>Progress</Text>
                  <Text style={styles.progressValue}>{persenProgress}%</Text>
                </View>
                <View style={styles.progressBarBg}>
                  <View style={[styles.progressBarFill, { width: `${persenProgress}%` }]} />
                </View>
              </View>

              <View style={styles.navStatsGrid}>
                <View style={styles.navStatBox}>
                  <Text style={styles.navStatValue}>{jarakDitempuh.toFixed(1)}</Text>
                  <Text style={styles.navStatLabel}>km jalan</Text>
                </View>
                <View style={styles.navStatBox}>
                  <Text style={styles.navStatValue}>{Math.max(0, jarakKm - jarakDitempuh).toFixed(1)}</Text>
                  <Text style={styles.navStatLabel}>km sisa</Text>
                </View>
                <View style={styles.navStatBox}>
                  <Text style={styles.navStatValue}>{Math.floor(navWaktu / 60)}:{navWaktu % 60 < 10 ? '0' : ''}{navWaktu % 60}</Text>
                  <Text style={styles.navStatLabel}>waktu</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Bottom Card Navigasi */}
          <View style={[styles.navBottomOverlay, { bottom: insets.bottom + 100 }]}>
            <View style={styles.navBottomCard}>
              {persenProgress < 50 && (
                <Text style={styles.navHint}>Tempuh minimal 50% rute untuk menyelesaikan</Text>
              )}
              <View style={styles.navActionRow}>
                <TouchableOpacity style={styles.btnBatal} onPress={stopNavigation} disabled={isSaving}>
                  <Square size={16} color="#EF4444" fill="#EF4444" />
                  <Text style={styles.btnBatalText}>Batal</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.btnSelesai} onPress={saveTrip} disabled={isSaving}>
                  {isSaving ? <ActivityIndicator color="white" /> : <Navigation size={16} color="white" />}
                  <Text style={styles.btnSelesaiText}>{isSaving ? 'Menyimpan...' : 'Selesai & Simpan'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  topSearchPanel: {
    position: 'absolute',
    top: 50, // Hindari notch
    left: 16,
    right: 16,
    zIndex: 10,
  },
  searchCard: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 16,
    paddingBottom: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  bottomSheetPanel: {
    position: 'absolute',
    bottom: 80, // Hindari TabBar
    left: 16,
    right: 16,
    height: windowHeight * 0.45,
    backgroundColor: 'white',
    borderRadius: 24,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10,
    zIndex: 5,
  },
  sheetHeaderArea: {
    width: '100%',
    alignItems: 'flex-start',
    paddingTop: 8,
    paddingBottom: 12,
    backgroundColor: 'transparent',
  },
  sheetHandle: {
    width: 40,
    height: 5,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: 12,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  sheetSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 16,
    marginTop: 2,
  },
  recommendationList: {
    flex: 1,
  },
  recCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  recCardHighlight: {
    backgroundColor: '#F0FDF4',
    borderColor: '#1D9E75',
  },
  recHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  recModa: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  badgeTerhijau: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAC775',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#085041',
  },
  recStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  recStatItem: {
    flex: 1,
  },
  recStatLabel: {
    fontSize: 11,
    color: '#6B7280',
    marginBottom: 2,
  },
  recStatValue: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#1D9E75',
  },
  btnNavigasi: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1D9E75',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  btnNavigasiText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },

  // Overlay Navigasi
  navTopOverlay: {
    position: 'absolute',
    top: 50,
    left: 16,
    right: 16,
    zIndex: 20,
  },
  navTopCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  navHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  navHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  navIconBg: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1D9E75',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  navSubtitle: {
    fontSize: 11,
    color: '#6B7280',
  },
  navGpsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#D1FAE5',
    gap: 6,
  },
  gpsDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  gpsText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#047857',
  },
  progressContainer: {
    marginBottom: 16,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressLabel: {
    fontSize: 11,
    color: '#6B7280',
  },
  progressValue: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#1D9E75',
  },
  progressBarBg: {
    height: 6,
    backgroundColor: '#F3F4F6',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#1D9E75',
  },
  navStatsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  navStatBox: {
    alignItems: 'center',
    flex: 1,
    backgroundColor: '#F9FAFB',
    paddingVertical: 8,
    borderRadius: 12,
    marginHorizontal: 4,
  },
  navStatValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  navStatLabel: {
    fontSize: 10,
    color: '#6B7280',
  },

  navBottomOverlay: {
    position: 'absolute',
    bottom: 80,
    left: 16,
    right: 16,
    zIndex: 20,
  },
  navBottomCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10,
  },
  navHint: {
    fontSize: 11,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 12,
  },
  navActionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  btnBatal: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEE2E2',
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
  },
  btnBatalText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: 'bold',
  },
  btnSelesai: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1D9E75',
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
  },
  btnSelesaiText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },

  // Style untuk Pick Map (Gojek-style)
  crosshairContainer: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -20,
    marginTop: -45, // Menyesuaikan agar ujung bawah pin tepat di tengah
    alignItems: 'center',
    zIndex: 30,
  },
  crosshairTooltip: {
    backgroundColor: '#1F2937',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 4,
  },
  crosshairText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  crosshairIcon: {
    // shadow manual lewat drop-shadow di react-native (pakai elevation/shadow di wrapper jika perlu)
  },
  crosshairDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#1D9E75',
    position: 'absolute',
    bottom: -3,
  },
  pickMapBottomPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'white',
    padding: 20,
    paddingBottom: 40,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 20,
    zIndex: 40,
  },
  pickMapTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  pickMapSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 16,
  },
  pickMapActionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  btnBatalPick: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnBatalPickText: {
    color: '#4B5563',
    fontSize: 14,
    fontWeight: 'bold',
  },
  btnConfirmPick: {
    flex: 2,
    flexDirection: 'row',
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#1D9E75',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  btnConfirmPickText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  recenterButton: {
    position: 'absolute',
    right: 16,
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 30,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    zIndex: 10,
  },
});
