import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, StyleSheet } from 'react-native';
import { useState } from 'react';
import { HomeScreen } from './src/screens/HomeScreen';
import { colors } from './src/constants/theme';
import { LaunchScreen } from './src/screens/LaunchScreen';
import { ResultScreen } from './src/screens/ResultScreen';
import { HeightResultSummary } from './src/types/measurement';

export default function App() {
  const [isLaunchComplete, setIsLaunchComplete] = useState(false);
  const [result, setResult] = useState<HeightResultSummary | null>(null);

  if (!isLaunchComplete) {
    return (
      <SafeAreaView style={styles.launchContainer}>
        <StatusBar style="light" />
        <LaunchScreen onGetStarted={() => setIsLaunchComplete(true)} />
      </SafeAreaView>
    );
  }

  if (result) {
    return (
      <SafeAreaView style={styles.launchContainer}>
        <StatusBar style="light" />
        <ResultScreen result={result} onBack={() => setResult(null)} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <HomeScreen onResultReady={setResult} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  launchContainer: {
    flex: 1,
    backgroundColor: '#021226',
  },
});
