import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { HomeScreen } from './src/screens/HomeScreen';
import { colors } from './src/constants/theme';
import { LaunchScreen } from './src/screens/LaunchScreen';
import { ResultScreen } from './src/screens/ResultScreen';
import { HeightResultSummary } from './src/types/measurement';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { HistoryScreen } from './src/screens/HistoryScreen';

type TabId = 'measure' | 'profile' | 'history';

export default function App() {
  const [isLaunchComplete, setIsLaunchComplete] = useState(false);
  const [result, setResult] = useState<HeightResultSummary | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('measure');
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);

  if (!isLaunchComplete) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.launchContainer} edges={['top', 'bottom']}>
          <StatusBar style="light" translucent={false} />
          <LaunchScreen onGetStarted={() => setIsLaunchComplete(true)} />
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  if (result) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.launchContainer} edges={['top', 'bottom']}>
          <StatusBar style="light" translucent={false} />
          <ResultScreen
            result={result}
            onBack={() => setResult(null)}
            onSaved={() => setHistoryRefreshKey((prev) => prev + 1)}
          />
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <StatusBar style="dark" translucent={false} />
        <View style={styles.screenContainer}>
          {activeTab === 'measure' ? (
            <HomeScreen onResultReady={setResult} />
          ) : activeTab === 'history' ? (
            <HistoryScreen refreshKey={historyRefreshKey} />
          ) : (
            <ProfileScreen refreshKey={historyRefreshKey} />
          )}
        </View>

        <View style={styles.navBar}>
          <Pressable
            style={[styles.navButton, activeTab === 'measure' && styles.navButtonActive]}
            onPress={() => setActiveTab('measure')}
          >
            <Text style={[styles.navButtonText, activeTab === 'measure' && styles.navButtonTextActive]}>Measure</Text>
          </Pressable>
          <Pressable
            style={[styles.navButton, activeTab === 'profile' && styles.navButtonActive]}
            onPress={() => setActiveTab('profile')}
          >
            <Text style={[styles.navButtonText, activeTab === 'profile' && styles.navButtonTextActive]}>Profile</Text>
          </Pressable>
          <Pressable
            style={[styles.navButton, activeTab === 'history' && styles.navButtonActive]}
            onPress={() => setActiveTab('history')}
          >
            <Text style={[styles.navButtonText, activeTab === 'history' && styles.navButtonTextActive]}>History</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  screenContainer: {
    flex: 1,
  },
  launchContainer: {
    flex: 1,
    backgroundColor: '#021226',
  },
  navBar: {
    flexDirection: 'row',
    backgroundColor: '#020617',
    borderTopWidth: 1,
    borderTopColor: 'rgba(148,163,184,0.2)',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 10,
  },
  navButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: 'rgba(30,41,59,0.8)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.2)',
  },
  navButtonActive: {
    backgroundColor: '#22D3EE',
    borderColor: 'rgba(34,211,238,0.9)',
  },
  navButtonText: {
    color: '#CBD5E1',
    fontSize: 15,
    fontWeight: '700',
  },
  navButtonTextActive: {
    color: '#042F2E',
  },
});
