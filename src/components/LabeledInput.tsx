import { Text, TextInput, View, StyleSheet, KeyboardTypeOptions } from 'react-native';
import { colors } from '../constants/theme';

type LabeledInputProps = {
  label: string;
  value: string;
  placeholder: string;
  keyboardType?: KeyboardTypeOptions;
  onChangeText: (value: string) => void;
};

export function LabeledInput({
  label,
  value,
  placeholder,
  keyboardType = 'numeric',
  onChangeText,
}: LabeledInputProps) {
  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        placeholder={placeholder}
        keyboardType={keyboardType}
        onChangeText={onChangeText}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 14,
  },
  label: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 6,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 16,
    color: colors.textPrimary,
  },
});
