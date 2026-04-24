import { useEffect, useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { getSavedHeightResults, SavedHeightRecord } from '../services/storageService';

type HistoryScreenProps = {
  refreshKey: number;
};

export function HistoryScreen({ refreshKey }: HistoryScreenProps) {
  const [history, setHistory] = useState<SavedHeightRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [minConfidence, setMinConfidence] = useState('');
  const [sortBy, setSortBy] = useState<'latest' | 'highest' | 'confidence'>('latest');

  useEffect(() => {
    const loadHistory = async () => {
      const storedHistory = await getSavedHeightResults();
      setHistory(storedHistory);
    };
    void loadHistory();
  }, [refreshKey]);

  const filteredHistory = history
    .filter((item) => {
      const query = searchQuery.trim().toLowerCase();
      if (!query) return true;

      return (
        `${item.estimatedHeightCm}`.includes(query) ||
        item.estimatedHeightFeet.toLowerCase().includes(query) ||
        `${item.personPixelHeight}`.includes(query) ||
        `${item.referencePixelHeight}`.includes(query)
      );
    })
    .filter((item) => {
      if (!minConfidence.trim()) return true;
      const parsed = Number(minConfidence);
      if (!Number.isFinite(parsed)) return true;
      return item.confidencePercent >= parsed;
    })
    .sort((a, b) => {
      if (sortBy === 'highest') return b.estimatedHeightCm - a.estimatedHeightCm;
      if (sortBy === 'confidence') return b.confidencePercent - a.confidencePercent;
      return new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime();
    });

  return (
    <LinearGradient colors={['#F7FAFF', '#EEF4FF']} style={styles.page}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={['#6D63FF', '#20C7F3']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.headerBlock}>
          <Text style={styles.title}>History</Text>
          <Text style={styles.subtitle}>Your saved height measurements are listed here.</Text>
        </LinearGradient>

        <View style={styles.filterCard}>
          <Text style={styles.filterTitle}>Filters</Text>

          <TextInput
            style={styles.filterInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search by cm, ft/in, pixels..."
            placeholderTextColor="#64748B"
          />

          <View style={styles.row}>
            <TextInput
              style={[styles.filterInput, styles.smallInput]}
              value={minConfidence}
              onChangeText={(value) => setMinConfidence(value.replace(/[^\d]/g, ''))}
              keyboardType="numeric"
              placeholder="Min confidence %"
              placeholderTextColor="#64748B"
            />
            <Pressable style={styles.clearBtn} onPress={() => { setSearchQuery(''); setMinConfidence(''); setSortBy('latest'); }}>
              <Text style={styles.clearBtnText}>Reset</Text>
            </Pressable>
          </View>

          <View style={styles.chipRow}>
            <Pressable
              style={[styles.chip, sortBy === 'latest' && styles.chipActive]}
              onPress={() => setSortBy('latest')}
            >
              <Text style={[styles.chipText, sortBy === 'latest' && styles.chipTextActive]}>Latest</Text>
            </Pressable>
            <Pressable
              style={[styles.chip, sortBy === 'highest' && styles.chipActive]}
              onPress={() => setSortBy('highest')}
            >
              <Text style={[styles.chipText, sortBy === 'highest' && styles.chipTextActive]}>Height</Text>
            </Pressable>
            <Pressable
              style={[styles.chip, sortBy === 'confidence' && styles.chipActive]}
              onPress={() => setSortBy('confidence')}
            >
              <Text style={[styles.chipText, sortBy === 'confidence' && styles.chipTextActive]}>Confidence</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.card}>
          {filteredHistory.length === 0 ? (
            <Text style={styles.emptyText}>No saved measurements yet. Save a result to see it here.</Text>
          ) : (
            filteredHistory.map((item) => (
              <Pressable
                key={item.id}
                style={styles.historyItem}
                onPress={() =>
                  Alert.alert(
                    'Saved Result',
                    `Height: ${item.estimatedHeightCm} cm (${item.estimatedHeightFeet})\nPerson pixels: ${item.personPixelHeight}px\nReference pixels: ${item.referencePixelHeight}px\nConfidence: ${item.confidencePercent}%\nSaved: ${new Date(item.savedAt).toLocaleString()}`
                  )
                }
              >
                <Text style={styles.historyMain}>
                  {item.estimatedHeightCm} cm ({item.estimatedHeightFeet})
                </Text>
                <Text style={styles.historySub}>
                  Person {item.personPixelHeight}px | Ref {item.referencePixelHeight}px | Confidence {item.confidencePercent}%
                </Text>
                <Text style={styles.historyDate}>{new Date(item.savedAt).toLocaleString()}</Text>
              </Pressable>
            ))
          )}
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 90,
  },
  headerBlock: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '800',
  },
  subtitle: {
    marginTop: 4,
    marginBottom: 8,
    color: '#EAF1FF',
    fontSize: 14,
  },
  filterCard: {
    marginTop: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(125,145,191,0.25)',
    borderRadius: 14,
    padding: 12,
  },
  filterTitle: {
    color: '#4A5A7A',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 8,
  },
  filterInput: {
    borderWidth: 1,
    borderColor: 'rgba(53,189,244,0.35)',
    backgroundColor: '#F2F5FD',
    borderRadius: 10,
    color: '#1F2A44',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  smallInput: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  clearBtn: {
    width: 90,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF3FF',
    borderWidth: 1,
    borderColor: 'rgba(125,145,191,0.3)',
  },
  clearBtnText: {
    color: '#4A5A7A',
    fontWeight: '700',
    fontSize: 13,
  },
  chipRow: {
    marginTop: 10,
    flexDirection: 'row',
    gap: 8,
  },
  chip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: 'rgba(125,145,191,0.3)',
    backgroundColor: '#EEF3FF',
  },
  chipActive: {
    borderColor: '#35BDF4',
    backgroundColor: 'rgba(53,189,244,0.18)',
  },
  chipText: {
    color: '#6B7896',
    fontSize: 12,
    fontWeight: '700',
  },
  chipTextActive: {
    color: '#2D9FD6',
  },
  card: {
    marginTop: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(125,145,191,0.25)',
    borderRadius: 14,
    padding: 12,
  },
  emptyText: {
    color: '#7C89A6',
    fontSize: 13,
  },
  historyItem: {
    borderWidth: 1,
    borderColor: 'rgba(125,145,191,0.2)',
    borderRadius: 10,
    padding: 10,
    marginTop: 8,
    backgroundColor: '#F8FAFF',
  },
  historyMain: {
    color: '#1F2A44',
    fontSize: 15,
    fontWeight: '800',
  },
  historySub: {
    marginTop: 3,
    color: '#2D9FD6',
    fontSize: 12,
  },
  historyDate: {
    marginTop: 4,
    color: '#95A1BD',
    fontSize: 11,
  },
});
