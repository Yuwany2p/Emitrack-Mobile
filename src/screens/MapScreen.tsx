import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Alert, ScrollView, ActivityIndicator, Dimensions, Animated, PanResponder, Modal, Share, Image } from 'react-native';
import MapView, { Polyline, Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { Play, Square, MapPin, Navigation, Bike, Car, Train, Bus, Leaf, LocateFixed, ArrowUpDown, ChevronUp, Share as ShareIcon, X } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { LinearGradient } from 'expo-linear-gradient';
import { hitungJarakKumulatif, validasiPerjalanan, isOffRoute } from '../lib/gps';
import { hitungEmisi, rekomendasiRute, Rekomendasi, RATA_RATA_NASIONAL } from '../lib/emisi';
import { showToast } from '../components/Toast';
import LocationInput, { NominatimResult } from '../components/LocationInput';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { height: windowHeight } = Dimensions.get('window');

// Helper to simulate time since we only fetch Google Maps API once (for cars)
const getEstimatedDuration = (moda: string, jarak: number, baseDurasi: number) => {
  if (!baseDurasi) return 0;
  if (moda.includes('Mobil')) return baseDurasi;
  if (moda.includes('Motor')) return Math.round(baseDurasi * 0.75);
  if (moda.includes('Sepeda')) return Math.round((jarak / 15) * 60); 
  if (moda.includes('KRL') || moda.includes('MRT')) return Math.round((jarak / 40) * 60);
  if (moda.includes('Bus') || moda.includes('TransJakarta')) return Math.round(baseDurasi * 1.2);
  return baseDurasi;
};

const formatDuration = (totalMinutes: number) => {
  if (totalMinutes < 60) return `${totalMinutes} mnt`;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return m === 0 ? `${h} j` : `${h} j ${m} m`;
};

const getMinIcon = (moda: string) => {
  if (moda.includes('Mobil')) return <Car size={14} color="#4B5563" />;
  if (moda.includes('Motor')) return <Bike size={14} color="#4B5563" />;
  if (moda.includes('Bus') || moda.includes('TransJakarta')) return <Bus size={14} color="#4B5563" />;
  if (moda.includes('Sepeda')) return <Bike size={14} color="#4B5563" />;
  return <Train size={14} color="#4B5563" />;
};

export default function MapScreen({ navigation, route }: any) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  
  // -- State Caching Rute --
  const [routeCache, setRouteCache] = useState<Record<string, { coords: any[], jarakKm: number, durasiMenit: number }>>({});
  const lastCoordsRef = useRef<string>('');

  // -- State Peta & GPS Default --
  const mapRef = useRef<MapView>(null);
  const mapShotRef = useRef<any>(null);
  const [showTripShareModal, setShowTripShareModal] = useState(false);
  const [savedTripData, setSavedTripData] = useState<any>(null);
  const [mapSnapshotUri, setMapSnapshotUri] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const isSharingRef = useRef(false);
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

  // Handle Return From Kalkulator (Share Modal Trigger)
  useEffect(() => {
    if (route.params?.triggerShare && route.params?.savedTripData) {
      setSavedTripData(route.params.savedTripData);
      setShowTripShareModal(true);
      
      // Zoom to fit the actual traveled path (or planned route if testing) for the share image
      if (path.length > 1) {
        mapRef.current?.fitToCoordinates(path, {
          edgePadding: { top: 250, right: 80, bottom: 350, left: 80 },
          animated: true,
        });
      } else if (ruteOSRM && ruteOSRM.length > 0) {
        mapRef.current?.fitToCoordinates(ruteOSRM, {
          edgePadding: { top: 250, right: 80, bottom: 350, left: 80 },
          animated: true,
        });
      }

      // Clear params to avoid loop
      navigation.setParams({ triggerShare: undefined, savedTripData: undefined });
    }
  }, [route.params?.triggerShare, route.params?.savedTripData]);

  useEffect(() => {
    if (asal && tujuan) {
      const currentCoords = `${asal.lat}_${asal.lon}_${tujuan.lat}_${tujuan.lon}`;
      const isNewSearch = currentCoords !== lastCoordsRef.current;
      lastCoordsRef.current = currentCoords;

      fetchGoogleRoute(asal, tujuan, activeModa, isNewSearch);
    } else {
      setRuteOSRM(null);
      setJarakKm(0);
      setDurasiMenit(0);
      setSelectedModa(null);
      lastCoordsRef.current = '';
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

  const fetchGoogleRoute = async (start: NominatimResult, end: NominatimResult, mode: string, isNewSearch: boolean = false) => {
    setIsFetchingRoute(true);
    try {
      let travelMode = 'DRIVE';
      let routingPref: any = 'TRAFFIC_AWARE';

      if (mode.includes('Motor')) {
        travelMode = 'TWO_WHEELER';
      } else if (mode.includes('Sepeda')) {
        travelMode = 'WALK';
        routingPref = undefined;
      } else if (mode.includes('KRL') || mode.includes('TransJakarta') || mode.includes('LRT') || mode.includes('MRT') || mode.includes('Bus')) {
        travelMode = 'TRANSIT';
        routingPref = undefined;
      }

      const cacheKey = `${start.lat}_${start.lon}_${end.lat}_${end.lon}_${travelMode}`;

      // Panggil fungsi rekomendasi (hanya jika pencarian rute baru)
      const generateRecommendations = (distKm: number) => {
        const newEmisiMobil = hitungEmisi('mobil', 'ron92', distKm);
        const newRecs = rekomendasiRute(newEmisiMobil, distKm, Number(start.lat), Number(start.lon), Number(end.lat), Number(end.lon));
        if (newRecs && newRecs.length > 0) {
          const greenest = newRecs.reduce((prev, curr) => (prev.emisi < curr.emisi ? prev : curr));
          setSelectedModa(greenest.moda);
          setActiveModa(greenest.moda);
        }
      };

      if (routeCache[cacheKey]) {
        const cached = routeCache[cacheKey];
        setRuteOSRM(cached.coords);
        setJarakKm(cached.jarakKm);
        setDurasiMenit(cached.durasiMenit);
        setIsFetchingRoute(false);
        if (isNewSearch) {
          generateRecommendations(cached.jarakKm);
        }
        return;
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

        const jarakKmVal = Number((route.distanceMeters / 1000).toFixed(1));
        const durationSecs = parseInt(route.duration.replace('s', ''));
        const durasiMenitVal = Math.round(durationSecs / 60);

        setRouteCache(prev => ({ ...prev, [cacheKey]: { coords, jarakKm: jarakKmVal, durasiMenit: durasiMenitVal } }));
        setRuteOSRM(coords);
        setJarakKm(jarakKmVal);
        setDurasiMenit(durasiMenitVal);

        if (isNewSearch) {
          generateRecommendations(jarakKmVal);
        }

        // Paskan kamera peta ke rute (hanya jika tidak sedang navigasi aktif)
        if (!isNavigating) {
          setTimeout(() => {
            mapRef.current?.fitToCoordinates(coords, {
              edgePadding: { top: 250, right: 50, bottom: 400, left: 50 },
              animated: true,
            });
          }, 500);
        }
      } else {
        throw new Error('Tidak ada rute yang ditemukan');
      }
    } catch (err) {
      console.error('Google Maps fetch error:', err);
      showToast('Gagal mengambil rute Google Maps', 'warning', 3000, 'top');
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
      const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${GOOGLE_MAPS_API_KEY}`);
      const data = await res.json();

      let addressName = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
      if (data.status === 'OK' && data.results && data.results.length > 0) {
        // Menggunakan alamat yang paling relevan (result pertama)
        addressName = data.results[0].formatted_address;
      }

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

      showToast(`Titik ${isPickingMap === 'asal' ? 'Asal' : 'Tujuan'} berhasil dipilih`, 'success', 3000, 'top');
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
          pitch: 0,
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
        showToast('Keluar jalur, mencari rute baru...', 'info', 3000, 'top');

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

  // 6. Selesai & Simpan Trip (Redirect ke Kalkulator)
  const saveTrip = async () => {
    const tujuanLatLng = tujuan ? { lat: Number(tujuan.lat), lon: Number(tujuan.lon) } : null;
    if (!user || !selectedModa || !tujuanLatLng) return;

    // Hitung jarak tempuh aktual dari GPS path
    const walkedArray: [number, number][] = path.map(p => [p.latitude, p.longitude]);
    const hasil = validasiPerjalanan(walkedArray, jarakKm, tujuanLatLng);
    
    // Gunakan murni jarak aktual yang dilalui dari GPS path
    let jarakAktual = jarakDitempuh > 0 ? jarakDitempuh : 0;

    const rec = rekomendasi.find(r => r.moda === selectedModa);
    if (!rec) return;

    // Convert mode name to Calculator format
    const dbJenis = selectedModa.toLowerCase().includes('mobil') ? 'mobil'
      : selectedModa.toLowerCase().includes('motor') ? 'motor'
      : selectedModa.toLowerCase().includes('sepeda') ? 'sepeda'
      : selectedModa.toLowerCase().includes('krl') ? 'krl'
      : 'transjakarta';

    // Berhenti navigasi (tapi jangan reset 'path' supaya bisa dipakai screenshot)
    setIsNavigating(false);
    if (watchSubscription.current) {
      watchSubscription.current.remove();
      watchSubscription.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    // Note: We deliberately don't setPath([]) here so the share screen can show it!

    navigation.navigate('Dashboard', { 
      screen: 'Kalkulator', 
      params: { 
        autoFill: true, 
        autoModa: dbJenis, 
        autoJarak: jarakAktual.toFixed(2),
        // Pass complete data to reconstruct the share poster later
        tripContext: {
          waktuMenit: Math.floor(navWaktu / 60),
          poinBase: rec.poin,
          emisiBase: rec.emisi,
          hematBase: rec.hemat,
          date: new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
        }
      } 
    });
  };

  const jarakDitempuh = hitungJarakKumulatif(path);
  const persenProgress = jarakKm > 0 ? Math.min(100, Math.round((jarakDitempuh / jarakKm) * 100)) : 0;

  const getClosestPointIndex = (loc: Location.LocationObject, route: { latitude: number, longitude: number }[]) => {
    let minDistance = Infinity;
    let minIndex = 0;
    for (let i = 0; i < route.length; i++) {
      const p = route[i];
      const d = Math.pow(p.latitude - loc.coords.latitude, 2) + Math.pow(p.longitude - loc.coords.longitude, 2);
      if (d < minDistance) {
        minDistance = d;
        minIndex = i;
      }
    }
    return minIndex;
  };

  const closestIdx = (isNavigating && location && ruteOSRM) ? getClosestPointIndex(location, ruteOSRM) : 0;
  const rutePassed = (isNavigating && ruteOSRM) ? ruteOSRM.slice(0, closestIdx + 1) : [];
  const ruteRemaining = (isNavigating && ruteOSRM) ? ruteOSRM.slice(closestIdx) : ruteOSRM || [];

  return (
    <View style={styles.container}>
      {/* 1. PETA FULLSCREEN (Background) wrapped in ViewShot */}
      <ViewShot ref={mapShotRef} style={{ flex: 1, ...StyleSheet.absoluteFillObject }} options={{ format: 'png', quality: 1 }}>
        <View collapsable={false} style={{ flex: 1, ...StyleSheet.absoluteFillObject }}>
          {showTripShareModal && mapSnapshotUri ? (
            <Image source={{ uri: mapSnapshotUri }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
          ) : (
            <MapView
              ref={mapRef}
            style={StyleSheet.absoluteFillObject}
            showsUserLocation={!showTripShareModal}
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
            {/* Draw original route only when NOT sharing. When sharing, show path instead */}
            {!isNavigating && !showTripShareModal && ruteOSRM && ruteOSRM.length > 0 && (
              <Polyline coordinates={ruteOSRM} strokeColor="#3b82f6" strokeWidth={5} />
            )}



            {isNavigating && rutePassed.length > 0 && (
              <Polyline coordinates={rutePassed} strokeColor="#9CA3AF" strokeWidth={5} />
            )}

            {isNavigating && ruteRemaining.length > 0 && (
              <Polyline coordinates={ruteRemaining} strokeColor="#3b82f6" strokeWidth={5} />
            )}

            {(isNavigating || showTripShareModal) && path.length > 0 && (
              <Polyline coordinates={path} strokeColor="#1D9E75" strokeWidth={5} />
            )}

            {!isNavigating && asalLatLng && !showTripShareModal && (
              <Marker coordinate={{ latitude: asalLatLng[0], longitude: asalLatLng[1] }} pinColor="#1D9E75" title="Asal" />
            )}
            {!isNavigating && tujuanLatLng && !showTripShareModal && (
              <Marker coordinate={{ latitude: tujuanLatLng[0], longitude: tujuanLatLng[1] }} pinColor="#EF4444" title="Tujuan" />
            )}
          </MapView>
          )}

        {/* STRATA-LIKE OVERLAY (Hanya tampil saat mau di-share agar ikut terfoto) */}
        {showTripShareModal && savedTripData && (
          <View collapsable={false} style={{ position: 'absolute', top: insets.top + 20, left: 20, right: 20, backgroundColor: 'transparent' }}>
            <LinearGradient colors={['rgba(6, 78, 59, 0.95)', 'rgba(2, 44, 34, 0.95)']} style={{ padding: 20, borderRadius: 24, borderWidth: 1, borderColor: '#1D9E75' }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View>
                  <Text style={{ color: '#FAC775', fontWeight: '900', fontSize: 24, letterSpacing: 1 }}>EmiTrack</Text>
                  <Text style={{ color: 'white', opacity: 0.7, fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase' }}>Earth Hero 2026</Text>
                </View>
                <View style={{ backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
                  <Text style={{ color: 'white', fontSize: 10, fontWeight: 'bold' }}>{savedTripData.date}</Text>
                </View>
              </View>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 24 }}>
                <View>
                  <Text style={{ color: 'white', opacity: 0.6, fontSize: 11, fontWeight: 'bold' }}>Jarak Ditempuh</Text>
                  <Text style={{ color: 'white', fontWeight: '900', fontSize: 28 }}>{savedTripData.jarak.toFixed(2)} <Text style={{ fontSize: 16 }}>km</Text></Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ color: 'white', opacity: 0.6, fontSize: 11, fontWeight: 'bold' }}>Emisi Dihemat</Text>
                  <Text style={{ color: '#10B981', fontWeight: '900', fontSize: 28 }}>{savedTripData.emisiHemat} <Text style={{ fontSize: 16 }}>kg CO₂</Text></Text>
                </View>
              </View>

              <View style={{ marginTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', paddingTop: 16, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ backgroundColor: 'rgba(255,255,255,0.1)', width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' }}>
                  {savedTripData.jenis === 'motor' ? <Bike color="white" size={14} /> : savedTripData.jenis === 'mobil' ? <Car color="white" size={14} /> : savedTripData.jenis === 'sepeda' ? <Bike color="white" size={14} /> : <Train color="white" size={14} />}
                </View>
                <View>
                  <Text style={{ color: 'white', opacity: 0.6, fontSize: 10, fontWeight: 'bold' }}>Moda Transportasi</Text>
                  <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 13 }}>{savedTripData.modaLengkap}</Text>
                </View>
              </View>
            </LinearGradient>
          </View>
        )}
        </View>
      </ViewShot>

      {/* Floating UI Elements (Hidden when sharing) */}
      {!showTripShareModal && (
        <>
          {/* 1.5 TOMBOL RE-CENTER LOCATION */}
          <TouchableOpacity
            style={[styles.recenterButton, isNavigating ? { bottom: 220, top: 'auto', right: 16 } : isPickingMap ? { top: insets.top + 20, right: 16 } : { top: 260, right: 16 }]}
            onPress={() => {
              if (location) {
                if (isNavigating) {
                  mapRef.current?.animateCamera({
                    center: location.coords,
                    heading: location.coords.heading || 0,
                    pitch: 0,
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

          {/* 2. PANEL PENCARIAN (Floating di Atas) */}
          {!isNavigating && !isPickingMap && (
            <View style={[styles.topSearchPanel, { top: insets.top + 16 }]}>
              <View style={[styles.searchCard, { flexDirection: 'row', alignItems: 'center' }]}>
                <View style={{ flex: 1 }}>
                  <View style={{ zIndex: 2 }}>
                    <LocationInput
                      label="Titik Asal"
                      placeholder="Cari lokasi asal..."
                      value={asal}
                      onChange={setAsal}
                      onPickMap={() => setIsPickingMap('asal')}
                      onCurrentLocation={() => {
                        if (location) {
                          setAsal({
                            lat: location.coords.latitude.toString(),
                            lon: location.coords.longitude.toString(),
                            display_name: 'Lokasi Anda Saat Ini'
                          });
                        } else {
                          showToast('Lokasi belum tersedia', 'warning');
                        }
                      }}
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
                </View>

                <TouchableOpacity
                  style={{ padding: 8, backgroundColor: '#F9FAFB', borderRadius: 20, marginLeft: 8, borderWidth: 1, borderColor: '#E5E7EB' }}
                  onPress={() => {
                    const temp = asal;
                    setAsal(tujuan);
                    setTujuan(temp);
                  }}
                >
                  <ArrowUpDown size={20} color="#6B7280" />
                </TouchableOpacity>

                {isFetchingRoute && (
                  <View style={{ position: 'absolute', right: 24, top: 50, zIndex: 3 }}>
                    <ActivityIndicator size="small" color="#1D9E75" />
                  </View>
                )}
              </View>
            </View>
          )}

          {/* 3. PANEL REKOMENDASI */}
          {!isNavigating && !isPickingMap && ruteOSRM && (
            <View style={[styles.bottomSheetPanel, { bottom: insets.bottom + 100 }]}>
              <TouchableOpacity activeOpacity={0.8} onPress={() => setIsSheetExpanded(!isSheetExpanded)} style={styles.sheetHeaderArea}>
                <View style={styles.sheetHandle} />
                <Text style={styles.sheetTitle}>Rekomendasi Rute Hijau</Text>
                {isSheetExpanded && (
                  <Text style={styles.sheetSubtitle}>
                    Jarak est: {jarakKm} km • {formatDuration(getEstimatedDuration(activeModa, jarakKm, durasiMenit))} ({activeModa})
                  </Text>
                )}
              </TouchableOpacity>

              {isSheetExpanded ? (
                <ScrollView style={styles.recommendationList} showsVerticalScrollIndicator={false}>
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
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingHorizontal: 16 }} style={{ marginTop: 8 }}>
                  {rekomendasi.map((rec, i) => (
                    <TouchableOpacity
                      key={i}
                      style={{ backgroundColor: '#F3F4F6', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: activeModa === rec.moda ? '#1D9E75' : '#E5E7EB' }}
                      onPress={() => { setActiveModa(rec.moda); setIsSheetExpanded(true); }}
                    >
                      {getMinIcon(rec.moda)}
                      <Text style={{ fontSize: 12, fontWeight: '600', color: '#4B5563' }}>{formatDuration(getEstimatedDuration(rec.moda, jarakKm, durasiMenit))}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </View>
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
              <View style={[styles.pickMapBottomPanel, { bottom: insets.bottom + 16, left: 16, right: 16 }]}>
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
              <View style={[styles.navBottomOverlay, { bottom: insets.bottom + 16 }]}>
                <View style={styles.navBottomCard}>
                  {persenProgress < 50 && (
                    <Text style={styles.navHint}>Tempuh minimal 50% rute untuk menyelesaikan</Text>
                  )}
                  <View style={styles.navActionRow}>
                    <TouchableOpacity style={styles.btnBatal} onPress={stopNavigation}>
                      <Square size={16} color="#EF4444" fill="#EF4444" />
                      <Text style={styles.btnBatalText}>Batal</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.btnSelesai, persenProgress < 50 && { backgroundColor: '#9CA3AF' }]} 
                      onPress={saveTrip} 
                      disabled={persenProgress < 50}
                    >
                      <Navigation size={16} color="white" />
                      <Text style={styles.btnSelesaiText}>Selesai & Simpan</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </>
          )}

        </>
      )}

      {/* SHARE ACTIONS OVERLAY (Bottom Sheet khusus Share) */}
      {showTripShareModal && savedTripData && (
        <View style={{ position: 'absolute', bottom: insets.bottom + 96, left: 16, right: 16, padding: 24, backgroundColor: 'white', borderRadius: 32, elevation: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20 }}>
          <Text style={{ fontSize: 20, fontWeight: '900', textAlign: 'center', marginBottom: 8, color: '#1F2937' }}>Perjalanan Selesai!</Text>
          <Text style={{ fontSize: 13, color: '#6B7280', textAlign: 'center', marginBottom: 24 }}>Pamerkan rute hijaumu ke teman-teman dan jadilah inspirasi bagi mereka.</Text>

          <TouchableOpacity
            style={[styles.btnSelesai, { marginBottom: 12, height: 56, borderRadius: 28, elevation: 4, shadowColor: '#10B981', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 }, isSharing && { opacity: 0.7 }]}
            disabled={isSharing}
            onPress={async () => {
              if (isSharingRef.current) return;
              isSharingRef.current = true;
              setIsSharing(true);
              
              if (mapRef.current && mapShotRef.current) {
                try {
                  // 1. Snapshot the MapView alone (resolves Android GL Surface capture issue)
                  const mapUri = await mapRef.current.takeSnapshot({
                    format: 'png',
                    quality: 1,
                    result: 'file'
                  });
                  
                  // 2. Temporarily replace MapView with a flat Image
                  setMapSnapshotUri(mapUri);
                  
                  // 3. Wait for the Image to render on screen
                  await new Promise(resolve => setTimeout(resolve, 500));
                  
                  // 4. Capture the entire ViewShot (Image + Poster)
                  const finalUri = await mapShotRef.current.capture();
                  
                  // 5. Restore the interactive MapView immediately
                  setMapSnapshotUri(null);
                  
                  // 6. Share the final composite image
                  await Sharing.shareAsync(finalUri);
                } catch (e) {
                  console.log(e);
                  setMapSnapshotUri(null);
                } finally {
                  isSharingRef.current = false;
                  setIsSharing(false);
                }
              } else {
                isSharingRef.current = false;
                setIsSharing(false);
              }
            }}
          >
            {isSharing ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <ShareIcon color="white" size={20} />
            )}
            <Text style={[styles.btnSelesaiText, { fontSize: 16 }]}>
              {isSharing ? 'Memproses...' : 'Bagikan Gambar Rute'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btnBatal, { backgroundColor: '#F3F4F6', height: 56, borderRadius: 28 }]}
            onPress={() => {
              setShowTripShareModal(false);
              stopNavigation();
              navigation.navigate('Dashboard', { screen: 'DashboardHome' });
            }}
          >
            <Text style={[styles.btnBatalText, { color: '#4B5563', fontSize: 15 }]}>Tutup & Kembali ke Beranda</Text>
          </TouchableOpacity>
        </View>
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
    maxHeight: windowHeight * 0.4,
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
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
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
