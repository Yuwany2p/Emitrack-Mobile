import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { Search, MapPin, X } from 'lucide-react-native';

export type NominatimResult = {
  lat: string;
  lon: string;
  display_name: string;
};

type LocationInputProps = {
  label: string;
  placeholder: string;
  value: NominatimResult | null;
  onChange: (val: NominatimResult | null) => void;
  onPickMap?: () => void;
};

export default function LocationInput({ label, placeholder, value, onChange, onPickMap }: LocationInputProps) {
  const [query, setQuery] = useState(value?.display_name || '');
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (value) {
      setQuery(value.display_name);
      setShowDropdown(false);
    } else {
      setQuery('');
    }
  }, [value]);

  const searchLocation = async (text: string) => {
    if (!text.trim()) {
      setResults([]);
      setShowDropdown(false);
      return;
    }
    
    setIsLoading(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(text)}&limit=5&countrycodes=id`,
        {
          headers: {
            'User-Agent': 'EmitrackMobileApp/1.0 (contact@emitrack.com)',
            'Accept': 'application/json'
          }
        }
      );
      
      if (!res.ok) {
        throw new Error(`Server returned status: ${res.status}`);
      }

      const data = await res.json();
      setResults(data);
      setShowDropdown(true);
    } catch (err) {
      console.error('Nominatim search error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTextChange = (text: string) => {
    setQuery(text);
    if (value && text !== value.display_name) {
      onChange(null);
    }

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      searchLocation(text);
    }, 600);
  };

  const handleSelect = (item: NominatimResult) => {
    setQuery(item.display_name);
    setShowDropdown(false);
    onChange(item);
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setShowDropdown(false);
    onChange(null);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputContainer}>
        <Search color="#9CA3AF" size={18} style={styles.icon} />
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor="#9CA3AF"
          value={query}
          onChangeText={handleTextChange}
          onFocus={() => {
            if (results.length > 0 || onPickMap) setShowDropdown(true);
          }}
        />
        {isLoading ? (
          <ActivityIndicator size="small" color="#1D9E75" style={styles.rightIcon} />
        ) : query ? (
          <TouchableOpacity onPress={handleClear} style={styles.rightIcon}>
            <X color="#9CA3AF" size={18} />
          </TouchableOpacity>
        ) : null}
      </View>

      {showDropdown && (results.length > 0 || onPickMap) && (
        <View style={styles.dropdown}>
          {onPickMap && (
            <TouchableOpacity 
              style={[styles.dropdownItem, { borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }]} 
              onPress={() => { setShowDropdown(false); onPickMap(); }}
            >
              <MapPin color="#1D9E75" size={16} style={{ marginTop: 2 }} />
              <Text style={[styles.dropdownText, { color: '#1D9E75', fontWeight: 'bold' }]}>
                Pilih lokasi lewat Peta
              </Text>
            </TouchableOpacity>
          )}
          {results.length > 0 && (
            <FlatList
              data={results}
              keyExtractor={(item) => item.lat + item.lon}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.dropdownItem} onPress={() => handleSelect(item)}>
                  <MapPin color="#6B7280" size={16} style={{ marginTop: 2 }} />
                  <Text style={styles.dropdownText} numberOfLines={2}>
                    {item.display_name}
                  </Text>
                </TouchableOpacity>
              )}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
            />
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    marginBottom: 12,
    zIndex: 1, // Agar dropdown berada di atas
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4B5563',
    marginBottom: 4,
    marginLeft: 2,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
  },
  icon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 14,
    color: '#1F2937',
  },
  rightIcon: {
    padding: 4,
  },
  dropdown: {
    position: 'absolute',
    top: 66,
    left: 0,
    right: 0,
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
    maxHeight: 200,
    zIndex: 100, // Harus paling atas
  },
  dropdownItem: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
  },
  dropdownText: {
    flex: 1,
    fontSize: 13,
    color: '#374151',
    lineHeight: 18,
  },
  separator: {
    height: 1,
    backgroundColor: '#F3F4F6',
  },
});
