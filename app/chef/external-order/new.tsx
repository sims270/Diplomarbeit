import { useAuth } from '@/app/context/AuthContext';
import { addExternalOrder, type ExternalOrderFields } from '@/app/services/externalOrderService';
import { ExternalOrderForm } from '@/components/ExternalOrderForm';
import { FluidPressable } from '@/components/fluid/FluidPressable';
import { Header } from '@/components/header';
import { Spacing } from '@/constants/theme';
import { type AppTheme, useThemedStyles } from '@/hooks/use-app-theme';
import { uiStyles } from '@/constants/ui-styles';
import { useTranslation } from '@/hooks/use-translation';
import { exportTransportauftragPdf } from '@/lib/transportauftragExport';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

export default function NewExternalOrderScreen() {
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const { t } = useTranslation();
  const { user } = useAuth();

  const handleCreate = async (fields: ExternalOrderFields) => {
    const order = await addExternalOrder({ ...fields, createdBy: user?.id || '' });

    // Must run right after the click with no awaits ahead of it — on web
    // this opens a popup window, and browsers silently block window.open
    // once the "recent user gesture" allowance from the click has lapsed.
    // addExternalOrder above is a single fast insert, so it stays within
    // that window.
    await exportTransportauftragPdf(order);
    router.back();
  };

  return (
    <View style={styles.container}>
      <Header title="TRANSLOG PRO" subtitle={t('chefExternalOrder', 'headerSubtitle')} code="CH" />

      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
        <FluidPressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>{`← ${t('common', 'back')}`}</Text>
        </FluidPressable>

        <ExternalOrderForm
          submitLabel={t('chefExternalOrder', 'createButton')}
          onSubmit={handleCreate}
        />
      </ScrollView>
    </View>
  );
}

const createStyles = (theme: AppTheme) => {
  const u = uiStyles(theme);
  return StyleSheet.create({
    container: u.screen,
    content: {
      flex: 1,
    },
    contentInner: {
      ...u.formColumn,
      paddingBottom: Spacing.xxl,
    },
    backButton: u.backButton,
    backButtonText: u.backButtonText,
  });
};
