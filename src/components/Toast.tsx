import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { X } from 'lucide-react-native';

export type ToastType = 'success' | 'info' | 'warning';

export interface ToastItem {
  id: string;
  msg: string;
  type: ToastType;
}

type ToastListener = (toasts: ToastItem[]) => void;
let _toasts: ToastItem[] = [];
const _listeners: Set<ToastListener> = new Set();

function notify() {
  _listeners.forEach(l => l([..._toasts]));
}

export function showToast(msg: string, type: ToastType = 'success', duration = 3000) {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  _toasts = [..._toasts, { id, msg, type }];
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
  const [slide] = useState(new Animated.Value(100)); // Start below screen

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
        <X color="rgba(255,255,255,0.7)" size={16} />
      </TouchableOpacity>
    </Animated.View>
  );
};

export default function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

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

  return (
    <View style={styles.container} pointerEvents="box-none">
      {toasts.map(t => (
        <ToastMessage key={t.id} toast={t} onDismiss={dismiss} />
      ))}
    </View>
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
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
    maxWidth: '90%',
  },
  toastText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
});
