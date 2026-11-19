import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { FluidPressable } from '@/components/fluid/FluidPressable';
import { Layout, Spacing } from '@/constants/theme';
import { uiStyles } from '@/constants/ui-styles';
import { type AppTheme, useAppTheme, useThemedStyles } from '@/hooks/use-app-theme';
import { useTranslation } from '@/hooks/use-translation';
import { StyleSheet, Text, TextInput, View } from 'react-native';

/**
 * Suchfeld über den Auftragslisten. Was gesucht wird, entscheidet die Liste
 * (lib/orderSearch.ts); hier nur Eingabe, Lupe und das X zum Leeren. Solange
 * etwas drinsteht, sucht die Liste über alle Zeiträume — darauf weist der
 * Hinweis darunter hin.
 */
export function OrderSearchField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const styles = useThemedStyles(createStyles);
  const { c, scheme } = useAppTheme();
  const { t } = useTranslation();

  return (
    <View style={styles.wrapper}>
      <View style={styles.field}>
        <MaterialIcons name="search" size={20} color={c.textSecondary} />
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChange}
          placeholder={t('orderSearch', 'placeholder')}
          placeholderTextColor={c.placeholder}
          keyboardAppearance={scheme}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          clearButtonMode="never"
        />
        {value ? (
          <FluidPressable
            style={styles.clear}
            onPress={() => onChange('')}
            accessibilityLabel={t('orderSearch', 'clear')}
          >
            <MaterialIcons name="close" size={18} color={c.textSecondary} />
          </FluidPressable>
        ) : null}
      </View>
      {value.trim() ? <Text style={styles.hint}>{t('orderSearch', 'allPeriodsHint')}</Text> : null}
    </View>
  );
}

const createStyles = (theme: AppTheme) => {
  const { c } = theme;
  const u = uiStyles(theme);
  return StyleSheet.create({
    wrapper: {
      marginBottom: Spacing.sm,
    },
    field: {
      ...u.field,
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
      paddingVertical: 0,
      backgroundColor: c.surfaceSecondary,
      borderColor: 'transparent',
    },
    input: {
      flex: 1,
      minHeight: Layout.minTouch,
      color: c.text,
      fontSize: 16,
      paddingVertical: 0,
    },
    clear: {
      minHeight: Layout.minTouch,
      minWidth: Layout.minTouch,
      alignItems: 'center',
      justifyContent: 'center',
    },
    hint: {
      ...u.hint,
      marginTop: Spacing.xxs,
    },
  });
};
