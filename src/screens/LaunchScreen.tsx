import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type LaunchScreenProps = {
  onGetStarted: () => void;
};

export function LaunchScreen({ onGetStarted }: LaunchScreenProps) {
  return (
    <LinearGradient colors={['#021226', '#07183A', '#090F2E']} style={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.badge}>AI POWERED</Text>

        <View style={styles.ringOuter}>
          <View style={styles.ringMid}>
            <View style={styles.ringInner}>
              <View style={styles.figureHead} />
              <View style={styles.figureBody} />
            </View>
          </View>
        </View>

        <Text style={styles.titleTop}>Measure</Text>
        <Text style={styles.titleMid}>Heights</Text>
        <Text style={styles.titleBottom}>Instantly</Text>
        <Text style={styles.subtitle}>
          Capture one photo, tap 4 points,{"\n"}get precise height measurements.
        </Text>
      </View>

      <Pressable style={styles.cta} onPress={onGetStarted}>
        <Text style={styles.ctaText}>Get Started</Text>
      </Pressable>

      <Text style={styles.footnote}>Already measured someone? View history</Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  hero: {
    alignItems: 'center',
    marginTop: 40,
  },
  badge: {
    color: '#67E8F9',
    fontSize: 12,
    letterSpacing: 2,
    borderWidth: 1,
    borderColor: 'rgba(103,232,249,0.55)',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginBottom: 16,
    fontWeight: '700',
  },
  ringOuter: {
    width: 210,
    height: 210,
    borderRadius: 105,
    borderWidth: 1,
    borderColor: 'rgba(34,211,238,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringMid: {
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 1,
    borderColor: 'rgba(34,211,238,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringInner: {
    width: 90,
    height: 120,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  figureHead: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#22D3EE',
  },
  figureBody: {
    marginTop: 8,
    width: 34,
    height: 72,
    borderWidth: 2,
    borderColor: '#22D3EE',
    borderRadius: 10,
  },
  titleTop: {
    marginTop: 20,
    color: '#F8FAFC',
    fontSize: 46,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  titleMid: {
    marginTop: -4,
    color: '#38BDF8',
    fontSize: 46,
    fontWeight: '900',
  },
  titleBottom: {
    marginTop: -4,
    color: '#F8FAFC',
    fontSize: 46,
    fontWeight: '900',
  },
  subtitle: {
    marginTop: 12,
    textAlign: 'center',
    color: '#94A3B8',
    fontSize: 15,
    lineHeight: 22,
  },
  cta: {
    marginTop: 40,
    backgroundColor: '#22D3EE',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    shadowColor: '#06B6D4',
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  ctaText: {
    color: '#042C3A',
    fontSize: 18,
    fontWeight: '800',
  },
  footnote: {
    marginTop: 14,
    textAlign: 'center',
    color: '#64748B',
    fontSize: 13,
  },
});
