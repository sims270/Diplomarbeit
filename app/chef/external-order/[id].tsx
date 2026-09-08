import {
  type ExternalOrder,
  type ExternalOrderFields,
  getExternalOrderById,
  updateExternalOrder,
} from '@/app/services/externalOrderService';
import { ExternalOrderForm } from '@/components/ExternalOrderForm';
import { FluidPressable } from '@/components/fluid/FluidPressable';
import { Header } from '@/components/header';
import { Colors } from '@/constants/theme';
import { useTranslation } from '@/hooks/use-translation';
import { exportTransportauftragPdf } from '@/lib/transportauftragExport';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

export default function EditExternalOrderScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [order, setOrder] = useState<ExternalOrder | undefined | null>(undefined);

  useEffect(() => {
    if (!id) return;
    getExternalOrderById(id)
      .then((found) => setOrder(found ?? null))
      .catch(() => setOrder(null));
  }, [id]);

  const handleUpdate = async (fields: ExternalOrderFields) => {
    const updated = await updateExternalOrder(id, fields);

    // Same reasoning as the create screen: keep this right after the click
    // with nothing awaited ahead of it, so web's popup permission holds.
    await exportTransportauftragPdf(updated);
    router.back();
  };

  if (order === undefined) {
    return (
      <View style={styles.container}>
        <Header title="TRANSLOG PRO" subtitle={t('chefExternalOrder', 'editHeaderSubtitle')} code="CH" />
        <ActivityIndicator style={styles.loading} color={Colors.ui.primary} />
      </View>
    );
  }

  if (order === null) {
    return (
      <View style={styles.container}>
        <Header title="TRANSLOG PRO" subtitle={t('chefExternalOrder', 'editHeaderSubtitle')} code="CH" />
        <View style={styles.content}>
          <FluidPressable onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backButtonText}>{`← ${t('common', 'back')}`}</Text>
          </FluidPressable>
          <Text style={styles.errorText}>{t('chefExternalOrder', 'notFound')}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="TRANSLOG PRO" subtitle={t('chefExternalOrder', 'editHeaderSubtitle')} code="CH" />

      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
        <FluidPressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>{`← ${t('common', 'back')}`}</Text>
        </FluidPressable>

        <ExternalOrderForm
          initialValues={order}
          submitLabel={t('chefExternalOrder', 'saveButton')}
          onSubmit={handleUpdate}
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
  loading: {
    marginTop: 32,
  },
  errorText: {
    textAlign: 'center',
    marginTop: 32,
    color: Colors.ui.primary,
  },
});
