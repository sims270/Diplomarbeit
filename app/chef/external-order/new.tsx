import { useAuth } from '@/app/context/AuthContext';
import { addExternalOrder, type ExternalOrderFields } from '@/app/services/externalOrderService';
import { ExternalOrderForm } from '@/components/ExternalOrderForm';
import { FluidPressable } from '@/components/fluid/FluidPressable';
import { Header } from '@/components/header';
import { Colors } from '@/constants/theme';
import { useTranslation } from '@/hooks/use-translation';
import { exportTransportauftragPdf } from '@/lib/transportauftragExport';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

export default function NewExternalOrderScreen() {
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.ui.lightGray,
  },
  content: {
    flex: 1,
  },
  contentInner: {
    padding: 16,
    paddingBottom: 40,
  },
  backButton: {
    marginBottom: 12,
    alignSelf: 'flex-start',
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.ui.primary,
  },
});
