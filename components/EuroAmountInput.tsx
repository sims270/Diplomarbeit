import { Platform, StyleSheet, Text, TextInput, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { Typography } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';
import { formatEuro } from '@/lib/transportauftragPdf';

interface EuroAmountInputProps {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  /** Rahmen und Abstände des Formulars (uiStyles().input). */
  style?: StyleProp<TextStyle>;
  keyboardType?: 'decimal-pad' | 'numeric';
}

/**
 * Betragsfeld mit "€ " davor, wie im PDF ("€ 1.250,00"). Beim Verlassen des
 * Felds wird "1250" zu "1.250,00" — gleiche Regeln wie formatEuro() im
 * Transportauftrag.
 *
 * Das €-Zeichen steht bewusst neben dem Wert und nicht im Wert: So bleibt der
 * gespeicherte Text eine reine Zahl, die parseAmount() und formatEuro() lesen.
 */
export function EuroAmountInput({
  value,
  onChangeText,
  placeholder,
  style,
  keyboardType = 'decimal-pad',
}: EuroAmountInputProps) {
  const { c, scheme } = useAppTheme();

  const handleBlur = () => {
    if (!value.trim()) return;
    // Unlesbare Eingaben bleiben stehen; die Prüfung beim Speichern meldet sie.
    const formatted = formatEuro(value);
    if (formatted !== value) onChangeText(formatted);
  };

  return (
    // Der Feldstil ist ein TextStyle; für den Rahmen-View zählen nur Rahmen,
    // Abstände und Hintergrund, Schriftangaben ignoriert der View.
    <View style={[style as StyleProp<ViewStyle>, styles.row]}>
      {value ? <Text style={[styles.currency, { color: c.text }]}>€ </Text> : null}
      <TextInput
        placeholderTextColor={c.placeholder}
        keyboardAppearance={scheme}
        style={[styles.input, { color: c.text }]}
        placeholder={placeholder}
        value={value}
        onChangeText={onChangeText}
        onBlur={handleBlur}
        keyboardType={keyboardType}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  currency: {
    ...Typography.body,
  },
  input: {
    ...Typography.body,
    flex: 1,
    alignSelf: 'stretch',
    padding: 0,
    // Der Rahmen gehört dem äußeren View; im Browser sonst ein zweiter Fokusrahmen.
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null),
  },
});
