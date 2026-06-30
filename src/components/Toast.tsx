import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type ToastType = 'success' | 'info' | 'warning';

export interface ToastItem {
  id: string;
  msg: string;
  type: ToastType;
  position?: 'top' | 'bottom' | number;
}

type ToastListener = (toasts: ToastItem[]) => void;
let _toasts: ToastItem[] = [];
const _listeners: Set<ToastListener> = new Set();

function notify() {
  _listeners.forEach(l => l([..._toasts]));
}

export function showToast(msg: string, type: ToastType = 'success', duration = 3000, position?: 'top' | 'bottom' | number) {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  _toasts = [..._toasts, { id, msg, type, position }];
  notify();
  setTimeout(() => {
    _toasts = _toasts.filter(t => t.id !== id);
    notify();
  }, duration);
}

const BG: Record<ToastType, string> = {
  success: '#1D9E75',
  info: '#3B82F6',
  warning: '#F59E0B',
};

const BORDER: Record<ToastType, string> = {
  success: '#0F6E56',
  info: '#2563EB',
  warning: '#D97706',
};

const ToastMessage = ({ toast, onDismiss }: { toast: ToastItem, onDismiss: (id: string) => void }) => {
  const isTop = toast.position === 'top';
  const [slide] = useState(new Animated.Value(isTop ? -100 : 100));

  useEffect(() => {
    Animated.spring(slide, {
      toValue: 0,
      useNativeDriver: true,
      friction: 8,
    }).start();
  }, []);

  return (
    <Animated.View
      style={[
        styles.toastBox,
        { 
          backgroundColor: BG[toast.type], 
          borderColor: BORDER[toast.type],
          transform: [{ translateY: slide }]
        }
      ]}
    >
      <Text style={styles.toastText}>{toast.msg}</Text>
      <TouchableOpacity onPress={() => onDismiss(toast.id)}>
        <X color="rgba(255,255,255,0.7)" size={14} />
      </TouchableOpacity>
    </Animated.View>
  );
};

export default function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const listener: ToastListener = (t) => setToasts(t);
    _listeners.add(listener);
    return () => { _listeners.delete(listener); };
  }, []);

  const dismiss = useCallback((id: string) => {
    _toasts = _toasts.filter(t => t.id !== id);
    notify();
  }, []);

  if (toasts.length === 0) return null;

  // Group toasts by position
  const topToasts = toasts.filter(t => t.position === 'top');
  const bottomToasts = toasts.filter(t => t.position === 'bottom' || t.position === undefined || typeof t.position === 'number');

  return (
    <>
      <View style={[styles.container, { top: insets.top + 16, bottom: undefined }]} pointerEvents="box-none">
        {topToasts.map(t => (
          <ToastMessage key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </View>
      <View style={styles.container} pointerEvents="box-none">
        {bottomToasts.map(t => {
           // Custom bottom offset if position is a number
           const customBottom = typeof t.position === 'number' ? t.position : undefined;
           return (
             <View key={t.id} style={customBottom !== undefined ? { position: 'absolute', bottom: customBottom, width: '100%', alignItems: 'center' } : { width: '100%', alignItems: 'center' }}>
               <ToastMessage toast={t} onDismiss={dismiss} />
             </View>
           );
        })}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 40,
    left: 16,
    right: 16,
    zIndex: 9999,
    alignItems: 'center',
    gap: 8,
  },
  toastBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
    maxWidth: '85%',
  },
  toastText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
    flexShrink: 1,
  },
});
