import { useAuth } from '@/app/context/AuthContext';
import { saveOrderPrice } from '@/app/services/orderPriceService';
import { addOrder, type OrderFields } from '@/app/services/orderService';
import { OwnOrderForm } from '@/components/OwnOrderForm';
import { FluidPressable } from '@/components/fluid/FluidPressable';
import { Header } from '@/components/header';
import { Spacing } from '@/constants/theme';
import { type AppTheme, useThemedStyles } from '@/hooks/use-app-theme';
import { uiStyles } from '@/constants/ui-styles';
import { useTranslation } from '@/hooks/use-translation';
import { showAlert } from '@/lib/alert';
import { describeSavedPdf } from '@/lib/orderPdfFile';
import { exportOwnOrderPdf } from '@/lib/ownOrderExport';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

export default function NewOrderScreen() {
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const { t } = useTranslation();
  const { user } = useAuth();

  const handleCreate = async (fields: OrderFields, price: string) => {
    const order = await addOrder({ ...fields, createdBy: user?.id || '' });

    // Direkt nach dem Klick: Beim ersten Mal zeigt der Browser den
    // Ordner-Dialog, und das nur kurz nach einer Nutzeraktion. Der Preis
    // läuft deshalb parallel statt davor.
    const [, saved] = await Promise.all([
      saveOrderPrice(order.id, price),
      exportOwnOrderPdf(order),
    ]);
    if (saved) {
      showAlert(
        t('common', 'success'),
        describeSavedPdf(saved, t('orderPdf', 'savedToFolder'), t('orderPdf', 'downloaded'))
      );
    }
    router.back();
  };

  return (
    <View style={styles.container}>
      <Header title="TRANSLOG PRO" subtitle={t('chefOwnOrder', 'headerSubtitle')} code="CH" />

      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
        <FluidPressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>{`← ${t('common', 'back')}`}</Text>
        </FluidPressable>

        <OwnOrderForm
          submitLabel={t('chefOwnOrder', 'createButton')}
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
