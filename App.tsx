import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { HomeScreen } from './src/screens/HomeScreen';
import { LaunchScreen } from './src/screens/LaunchScreen';
import { ResultScreen } from './src/screens/ResultScreen';
import { HeightResultSummary } from './src/types/measurement';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { HistoryScreen } from './src/screens/HistoryScreen';
import { NoReferenceScreen } from './src/screens/NoReferenceScreen';
import { scale } from './src/theme/ui';

type TabId = 'measure' | 'profile' | 'history';
type MeasureMode = 'reference' | 'noReferenceManual' | 'noReferenceAR';

export default function App() {
  const [isLaunchComplete, setIsLaunchComplete] = useState(false);
  const [result, setResult] = useState<HeightResultSummary | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('measure');
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  const [measureMode, setMeasureMode] = useState<MeasureMode>('reference');

  if (!isLaunchComplete) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.launchContainer} edges={['top', 'bottom']}>
          <StatusBar style="dark" translucent={false} />
          <LaunchScreen onGetStarted={() => setIsLaunchComplete(true)} />
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  if (result) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.launchContainer} edges={['top', 'bottom']}>
          <StatusBar style="dark" translucent={false} />
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
            measureMode === 'reference' ? (
              <HomeScreen
                onResultReady={setResult}
                onOpenNoReferenceAR={() => setMeasureMode('noReferenceAR')}
                onOpenNoReferenceManual={() => setMeasureMode('noReferenceManual')}
              />
            ) : (
              measureMode === 'noReferenceAR' ? (
                (() => {
                  try {
                    // Lazy-load to avoid startup crashes in builds
                    // where the native AR module isn't available.
                    const mod = require('./src/screens/NoReferenceARScreen') as typeof import('./src/screens/NoReferenceARScreen');
                    const Screen = mod.NoReferenceARScreen;
                    return (
                      <Screen
                        onResultReady={setResult}
                        onBack={() => setMeasureMode('reference')}
                        onOpenManualFallback={() => setMeasureMode('noReferenceManual')}
                      />
                    );
                  } catch {
                    return (
                      <NoReferenceScreen onResultReady={setResult} onBack={() => setMeasureMode('reference')} />
                    );
                  }
                })()
              ) : (
                <NoReferenceScreen onResultReady={setResult} onBack={() => setMeasureMode('reference')} />
              )
            )
          ) : activeTab === 'history' ? (
            <HistoryScreen refreshKey={historyRefreshKey} />
          ) : (
            <ProfileScreen refreshKey={historyRefreshKey} />
          )}
        </View>

        <View style={styles.navBar}>
          <Pressable style={styles.navButton} onPress={() => setActiveTab('measure')} accessibilityRole="tab" accessibilityState={{ selected: activeTab === 'measure' }}>
            {activeTab === 'measure' ? (
              <>
                <LinearGradient colors={['#6D63FF', '#20C7F3']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.navActiveGradient} />
                <View style={styles.navInner}>
                  <Ionicons name="home" size={scale(24)} color="#FFFFFF" />
                  <Text style={[styles.navButtonText, styles.navButtonTextActive]}>Measure</Text>
                </View>
              </>
            ) : (
              <View style={styles.navInner}>
                <Ionicons name="home-outline" size={scale(24)} color="#9AA6C2" />
                <Text style={styles.navButtonText}>Measure</Text>
              </View>
            )}
          </Pressable>
          <Pressable style={styles.navButton} onPress={() => setActiveTab('history')} accessibilityRole="tab" accessibilityState={{ selected: activeTab === 'history' }}>
            {activeTab === 'history' ? (
              <>
                <LinearGradient colors={['#6D63FF', '#20C7F3']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.navActiveGradient} />
                <View style={styles.navInner}>
                  <Ionicons name="time" size={scale(24)} color="#FFFFFF" />
                  <Text style={[styles.navButtonText, styles.navButtonTextActive]}>History</Text>
                </View>
              </>
            ) : (
              <View style={styles.navInner}>
                <Ionicons name="time-outline" size={scale(24)} color="#9AA6C2" />
                <Text style={styles.navButtonText}>History</Text>
              </View>
            )}
          </Pressable>
          <Pressable style={styles.navButton} onPress={() => setActiveTab('profile')} accessibilityRole="tab" accessibilityState={{ selected: activeTab === 'profile' }}>
            {activeTab === 'profile' ? (
              <>
                <LinearGradient colors={['#6D63FF', '#20C7F3']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.navActiveGradient} />
                <View style={styles.navInner}>
                  <Ionicons name="person" size={scale(24)} color="#FFFFFF" />
                  <Text style={[styles.navButtonText, styles.navButtonTextActive]}>Profile</Text>
                </View>
              </>
            ) : (
              <View style={styles.navInner}>
                <Ionicons name="person-outline" size={scale(24)} color="#9AA6C2" />
                <Text style={styles.navButtonText}>Profile</Text>
              </View>
            )}
          </Pressable>
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7FAFF',
  },
  screenContainer: {
    flex: 1,
    backgroundColor: '#F7FAFF',
  },
  launchContainer: {
    flex: 1,
    backgroundColor: '#F7FAFF',
  },
  navBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: 'rgba(125,145,191,0.2)',
    paddingHorizontal: scale(12),
    paddingTop: scale(8),
    paddingBottom: scale(12),
    gap: scale(10),
  },
  navButton: {
    flex: 1,
    borderRadius: scale(12),
    paddingVertical: scale(10),
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#EEF3FF',
    borderWidth: 1,
    borderColor: 'rgba(125,145,191,0.25)',
    overflow: 'hidden',
  },
  navInner: {
    zIndex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(4),
    paddingVertical: scale(2),
  },
  navButtonText: {
    color: '#9AA6C2',
    fontSize: scale(12),
    fontWeight: '700',
  },
  navButtonTextActive: {
    color: '#FFFFFF',
  },
  navActiveGradient: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: scale(12),
  },
});
