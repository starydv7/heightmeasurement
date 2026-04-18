import { useEffect, useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { getUserProfile, saveUserProfile } from '../services/storageService';
import { UserProfile } from '../types/measurement';

type ProfileScreenProps = {
  refreshKey: number;
};

function hasProfileContent(p: UserProfile): boolean {
  return Boolean(p.fullName.trim() || p.age.trim() || p.address.trim());
}

export function ProfileScreen({ refreshKey }: ProfileScreenProps) {
  const [profile, setProfile] = useState<UserProfile>({
    fullName: '',
    age: '',
    address: '',
  });
  const [isSaving, setIsSaving] = useState(false);
  /** When false, form is hidden and saved details are shown with Edit. */
  const [isEditing, setIsEditing] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      const storedProfile = await getUserProfile();
      setProfile(storedProfile);
      setIsEditing(!hasProfileContent(storedProfile));
    };
    void loadData();
  }, [refreshKey]);

  const handleSaveProfile = async () => {
    try {
      setIsSaving(true);
      await saveUserProfile(profile);
      setIsEditing(false);
      Alert.alert('Saved', 'Profile saved locally.');
    } catch {
      Alert.alert('Save failed', 'Could not save profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <LinearGradient colors={['#020817', '#0B1635', '#040A1D']} style={styles.page}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Profile</Text>
        <Text style={styles.subtitle}>Manage your details and personalize your measurement workspace.</Text>

        <View style={styles.heroCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(profile.fullName.trim().charAt(0) || 'U').toUpperCase()}</Text>
          </View>
          <View style={styles.heroTextWrap}>
            <Text style={styles.heroName}>{profile.fullName.trim() || 'Your Name'}</Text>
            <Text style={styles.heroSub}>
              {isEditing ? 'Update your personal details for saved records.' : 'Tap Edit to change your details.'}
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Your Details</Text>
            {!isEditing ? (
              <Pressable style={styles.editBtn} onPress={() => setIsEditing(true)}>
                <Text style={styles.editBtnText}>Edit</Text>
              </Pressable>
            ) : null}
          </View>

          {isEditing ? (
            <>
              <Text style={styles.label}>Full Name</Text>
              <TextInput
                style={styles.input}
                value={profile.fullName}
                onChangeText={(value) => setProfile((prev) => ({ ...prev, fullName: value }))}
                placeholder="Enter your name"
                placeholderTextColor="#64748B"
              />

              <Text style={styles.label}>Age</Text>
              <TextInput
                style={styles.input}
                value={profile.age}
                keyboardType="numeric"
                onChangeText={(value) => setProfile((prev) => ({ ...prev, age: value.replace(/[^\d]/g, '') }))}
                placeholder="Enter your age"
                placeholderTextColor="#64748B"
              />

              <Text style={styles.label}>Address</Text>
              <TextInput
                style={[styles.input, styles.addressInput]}
                value={profile.address}
                multiline
                onChangeText={(value) => setProfile((prev) => ({ ...prev, address: value }))}
                placeholder="Enter your address"
                placeholderTextColor="#64748B"
              />

              <Pressable style={[styles.saveBtn, isSaving && styles.btnDisabled]} onPress={handleSaveProfile} disabled={isSaving}>
                <Text style={styles.saveBtnText}>{isSaving ? 'Saving...' : 'Save Profile'}</Text>
              </Pressable>
            </>
          ) : (
            <View style={styles.summaryBox}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Full Name</Text>
                <Text style={styles.summaryValue}>{profile.fullName.trim() || '—'}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Age</Text>
                <Text style={styles.summaryValue}>{profile.age.trim() || '—'}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Address</Text>
                <Text style={styles.summaryValue}>{profile.address.trim() || '—'}</Text>
              </View>
            </View>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>History</Text>
          <Text style={styles.emptyText}>Open the History tab in the bottom menu to view saved results.</Text>
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
  title: {
    color: '#F8FAFC',
    fontSize: 30,
    fontWeight: '800',
  },
  subtitle: {
    marginTop: 4,
    marginBottom: 12,
    color: '#94A3B8',
    fontSize: 14,
  },
  heroCard: {
    marginTop: 2,
    marginBottom: 2,
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.25)',
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#22D3EE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#042F2E',
    fontSize: 20,
    fontWeight: '900',
  },
  heroTextWrap: {
    flex: 1,
  },
  heroName: {
    color: '#F8FAFC',
    fontSize: 17,
    fontWeight: '800',
  },
  heroSub: {
    marginTop: 2,
    color: '#94A3B8',
    fontSize: 12,
  },
  card: {
    marginTop: 10,
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.25)',
    borderRadius: 14,
    padding: 12,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sectionTitle: {
    color: '#22D3EE',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 0,
  },
  editBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(34,211,238,0.6)',
    backgroundColor: 'rgba(34,211,238,0.15)',
  },
  editBtnText: {
    color: '#67E8F9',
    fontSize: 14,
    fontWeight: '800',
  },
  summaryBox: {
    marginTop: 4,
    gap: 12,
  },
  summaryRow: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148,163,184,0.15)',
    paddingBottom: 10,
  },
  summaryLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  summaryValue: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '600',
  },
  label: {
    color: '#CBD5E1',
    fontSize: 12,
    marginTop: 6,
    marginBottom: 4,
    fontWeight: '700',
  },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(34,211,238,0.35)',
    backgroundColor: 'rgba(2, 6, 23, 0.65)',
    borderRadius: 10,
    color: '#F8FAFC',
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 15,
  },
  addressInput: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  saveBtn: {
    marginTop: 12,
    backgroundColor: '#22D3EE',
    borderRadius: 12,
    alignItems: 'center',
    paddingVertical: 12,
  },
  saveBtnText: {
    color: '#042F2E',
    fontWeight: '800',
    fontSize: 16,
  },
  btnDisabled: {
    opacity: 0.65,
  },
  emptyText: {
    color: '#94A3B8',
    fontSize: 13,
  },
});
