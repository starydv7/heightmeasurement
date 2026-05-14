import { useEffect, useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { getUserProfile, saveUserProfile } from '../services/storageService';
import { UserProfile } from '../types/measurement';
import { scale, ui } from '../theme/ui';

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
    <LinearGradient colors={['#F7FAFF', '#EEF4FF']} style={styles.page}>
      <View style={styles.headerArea}>
        <LinearGradient colors={['#6D63FF', '#20C7F3']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.headerBlock}>
          <Text style={styles.title}>Profile</Text>
          <Text style={styles.subtitle}>Manage your details and personalize your measurement workspace.</Text>
        </LinearGradient>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
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
          {!isEditing ? (
            <Pressable style={styles.editBtn} onPress={() => setIsEditing(true)}>
              <Text style={styles.editBtnText}>Edit</Text>
            </Pressable>
          ) : null}
        </View>

        {isEditing ? (
          <View style={styles.card}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Your Details</Text>
            </View>
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
          </View>
        ) : null}

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
    padding: scale(16),
    paddingBottom: scale(90),
  },
  headerArea: {
    minHeight: ui.header.minHeight,
    paddingHorizontal: 0,
    paddingTop: ui.header.paddingTop,
    paddingBottom: ui.header.paddingBottom,
    justifyContent: 'center',
  },
  headerBlock: {
    borderRadius: 0,
    paddingHorizontal: ui.header.paddingHorizontal,
    paddingVertical: ui.header.paddingBottom,
  },
  title: {
    color: '#FFFFFF',
    fontSize: ui.header.titleFontSize,
    lineHeight: ui.header.titleLineHeight,
    fontWeight: '800',
  },
  subtitle: {
    marginTop: scale(4),
    marginBottom: scale(8),
    color: '#EAF1FF',
    fontSize: ui.header.subtitleFontSize,
    fontWeight: '600',
  },
  heroCard: {
    marginTop: scale(2),
    marginBottom: scale(2),
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(125,145,191,0.25)',
    borderRadius: scale(14),
    padding: scale(12),
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(10),
  },
  avatar: {
    width: scale(46),
    height: scale(46),
    borderRadius: scale(23),
    backgroundColor: '#22D3EE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: scale(20),
    fontWeight: '900',
  },
  heroTextWrap: {
    flex: 1,
  },
  heroName: {
    color: '#1F2A44',
    fontSize: scale(17),
    fontWeight: '800',
  },
  heroSub: {
    marginTop: scale(2),
    color: '#7C89A6',
    fontSize: scale(12),
  },
  card: {
    marginTop: scale(10),
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(125,145,191,0.25)',
    borderRadius: scale(14),
    padding: scale(12),
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: scale(8),
  },
  sectionTitle: {
    color: '#4A5A7A',
    fontSize: scale(15),
    fontWeight: '800',
    marginBottom: 0,
  },
  editBtn: {
    paddingHorizontal: scale(14),
    paddingVertical: scale(8),
    borderRadius: scale(10),
    borderWidth: 1,
    borderColor: 'rgba(53,189,244,0.6)',
    backgroundColor: 'rgba(53,189,244,0.12)',
  },
  editBtnText: {
    color: '#2D9FD6',
    fontSize: scale(14),
    fontWeight: '800',
  },
  label: {
    color: '#4A5A7A',
    fontSize: scale(12),
    marginTop: scale(6),
    marginBottom: scale(4),
    fontWeight: '700',
  },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(53,189,244,0.35)',
    backgroundColor: '#F2F5FD',
    borderRadius: scale(10),
    color: '#1F2A44',
    paddingHorizontal: scale(12),
    paddingVertical: scale(11),
    fontSize: scale(15),
  },
  addressInput: {
    minHeight: scale(70),
    textAlignVertical: 'top',
  },
  saveBtn: {
    marginTop: scale(12),
    backgroundColor: '#22D3EE',
    borderRadius: scale(12),
    alignItems: 'center',
    paddingVertical: scale(12),
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: scale(16),
  },
  btnDisabled: {
    opacity: 0.65,
  },
  emptyText: {
    color: '#7C89A6',
    fontSize: scale(13),
  },
});
