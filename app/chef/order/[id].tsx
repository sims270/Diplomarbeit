import { useAuth } from '@/app/context/AuthContext';
import { Driver, getDrivers } from '@/app/services/driverService';
import { convertOwnToExternalOrder } from '@/app/services/orderConversionService';
import { getOrderPrice, saveOrderPrice } from '@/app/services/orderPriceService';
import {
  assignOrderToDriver,
  deleteOrder,
  getOrderById,
  updateOrder,
  type Order,
  type OrderFields,
} from '@/app/services/orderService';
import { billingCompanyOf } from '@/app/services/invoiceService';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { DeleteOrderModal } from '@/components/DeleteOrderModal';
import { InvoiceForm } from '@/components/InvoiceForm';
import { OrderDocuments } from '@/components/OrderDocuments';
import { OwnOrderForm } from '@/components/OwnOrderForm';
import { FluidPressable } from '@/components/fluid/FluidPressable';
import { Header } from '@/components/header';
import { Colors, Layout, Spacing, Typography } from '@/constants/theme';
import { type AppTheme, useAppTheme, useThemedStyles } from '@/hooks/use-app-theme';
import { uiStyles } from '@/constants/ui-styles';
import { useTranslation } from '@/hooks/use-translation';
import { timestampToGerman } from '@/lib/dateFormat';
import { showAlert, showConfirm } from '@/lib/alert';
import { describeSavedPdf } from '@/lib/orderPdfFile';
import { exportOwnOrderPdf } from '@/lib/ownOrderExport';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, ScrollView, StyleSheet, Text, View } from 'react-native';

export default function ChefOrderDetailScreen() {
  const styles = useThemedStyles(createStyles);
  const { c } = useAppTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const { isOfflineMode } = useAuth();

  const [order, setOrder] = useState<Order | undefined | null>(undefined);
  const [price, setPrice] = useState('');
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [isAssigning, setIsAssigning] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [isConverting, setIsConverting] = useState(false);

  useEffect(() => {
    loadOrder();
    loadDrivers();
  }, [id]);

  const loadOrder = () => {
    if (!id) return;
    // Gemeinsam laden: Das Formular übernimmt den Preis nur beim ersten
    // Anzeigen, und ein leeres Feld würde ihn beim Speichern löschen.
    Promise.all([getOrderById(id), getOrderPrice(id)])
      .then(([found, foundPrice]) => {
        setPrice(foundPrice);
        setOrder(found ?? null);
      })
      .catch(() => setOrder(null));
  };

  // Real drivers a boss created via Fahrerverwaltung — not the old demo
  // roster, which never matched what actually exists.
  const loadDrivers = async () => {
    if (isOfflineMode) {
      setDrivers([]);
      return;
    }
    try {
      setDrivers(await getDrivers());
    } catch {
      setDrivers([]);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return Colors.ui.orange;
      case 'assigned':
      case 'in_progress':
        return Colors.ui.blue;
      case 'completed':
        return Colors.ui.green;
      default:
        return Colors.ui.darkGray;
    }
  };

  const getStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      pending: t('chefDashboard', 'statusPending'),
      assigned: t('chefDashboard', 'statusAssigned'),
      in_progress: t('chefDashboard', 'statusInProgress'),
      completed: t('chefDashboard', 'statusCompleted'),
      cancelled: t('chefDashboard', 'statusCancelled'),
    };
    return statusMap[status] || status;
  };

  const handleUpdate = async (fields: OrderFields, newPrice: string) => {
    if (!id) return;
    const updated = await updateOrder(id, fields);
    const assignedDriver = drivers.find((d) => d.id === updated.assignedTo);

    // Wie beim Anlegen: direkt nach dem Klick, damit der Browser beim ersten
    // Mal den Ordner-Dialog noch zeigen darf.
    const [, saved] = await Promise.all([
      saveOrderPrice(id, newPrice),
      exportOwnOrderPdf(updated, assignedDriver?.username),
    ]);
    if (saved) {
      showAlert(
        t('common', 'success'),
        describeSavedPdf(saved, t('orderPdf', 'savedToFolder'), t('orderPdf', 'downloaded'))
      );
    }
    router.back();
  };

  const handleAssign = async (driverId: string) => {
    if (!order) return;
    setIsAssigning(true);
    try {
      await assignOrderToDriver(order.id, driverId);
      loadOrder();
      showAlert(
        t('common', 'success'),
        `Nr. ${order.orderNr} ${t('chefOrderDetail', 'alertAssignedSuccess')}`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : undefined;
      showAlert(t('common', 'error'), message);
    } finally {
      setIsAssigning(false);
    }
  };

  // Danach direkt ins Formular des Fremdauftrags: Dort fehlen noch
  // Frachtführer und Frachtrate.
  const handleConvert = () => {
    if (!order) return;
    showConfirm(
      t('chefOrderDetail', 'convertConfirmTitle'),
      `Nr. ${order.orderNr} ${t('chefOrderDetail', 'convertConfirmMessage')}`,
      async () => {
        setIsConverting(true);
        try {
          await convertOwnToExternalOrder(order.id);
          router.replace({ pathname: '/chef/external-order/[id]', params: { id: order.id } });
        } catch (error) {
          showAlert(
            t('common', 'error'),
            error instanceof Error ? error.message : t('chefOrderDetail', 'convertFailed')
          );
          setIsConverting(false);
        }
      },
      {
        confirmText: t('chefOrderDetail', 'convertConfirmButton'),
        cancelText: t('common', 'cancel'),
      }
    );
  };

  const handleDelete = async () => {
    if (!order) return;
    await deleteOrder(order.id);
    setShowDelete(false);
    showAlert(t('common', 'success'), t('deleteOrder', 'deleted'));
    router.back();
  };

  if (order === undefined) {
    return (
      <View style={styles.container}>
        <Header title="TRANSLOG PRO" subtitle={t('chefOwnOrder', 'editHeaderSubtitle')} code="CH" />
        <ActivityIndicator style={styles.loading} color={c.tint} />
      </View>
    );
  }

  if (order === null) {
    return (
      <View style={styles.container}>
        <Header title="TRANSLOG PRO" subtitle={t('chefOwnOrder', 'editHeaderSubtitle')} code="CH" />
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>{t('chefOrderDetail', 'notFound')}</Text>
        </View>
      </View>
    );
  }

  const assignedDriver = drivers.find((d) => d.id === order.assignedTo);

  return (
    <View style={styles.container}>
      <Header title="TRANSLOG PRO" subtitle={t('chefOwnOrder', 'editHeaderSubtitle')} code="CH" />

      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
        <View style={styles.topRow}>
          <FluidPressable style={styles.backLink} onPress={() => router.back()}>
            <Text style={styles.backLinkText}>← {t('chefOrderDetail', 'back')}</Text>
          </FluidPressable>
          <View style={styles.topActions}>
            <FluidPressable
              style={styles.deleteLink}
              onPress={() =>
                router.push({ pathname: '/chef/order/new', params: { copyFrom: order.id } })
              }
            >
              <MaterialIcons name="content-copy" size={18} color={c.textSecondary} />
              <Text style={styles.deleteLinkText}>{t('orderCopy', 'button')}</Text>
            </FluidPressable>
            <FluidPressable style={styles.deleteLink} onPress={() => setShowDelete(true)}>
              <MaterialIcons name="delete-outline" size={18} color={c.textSecondary} />
              <Text style={styles.deleteLinkText}>{t('deleteOrder', 'button')}</Text>
            </FluidPressable>
          </View>
        </View>

        <View style={styles.orderHeaderCard}>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(order.status) }]}>
            <Text style={styles.statusBadgeText}>{getStatusText(order.status)}</Text>
          </View>
          {order.status !== 'completed' ? (
            <FluidPressable
              style={[styles.convertButton, isConverting && styles.buttonDisabled]}
              onPress={handleConvert}
              disabled={isConverting}
            >
              {isConverting ? (
                <ActivityIndicator color={c.tint} />
              ) : (
                <Text style={styles.convertButtonText}>{t('chefOrderDetail', 'convertButton')}</Text>
              )}
            </FluidPressable>
          ) : null}
        </View>

        {order.completedAt ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {t('chefOrderDetail', 'completedSection')}
            </Text>
            <View style={styles.row}>
              <Text style={styles.label}>
                {t('chefOrderDetail', 'completedAtLabel')}
              </Text>
              <Text style={[styles.value, styles.completedValue]}>
                ✓ {timestampToGerman(order.completedAt)}
              </Text>
            </View>

            {/* Was der Fahrer beim Abschließen eingetragen hat. Beim
                Beilader gibt es die Angaben nicht — dort lässt sich der
                einzelnen Ladung keine Fahrtstrecke zuordnen. */}
            <View style={styles.row}>
              <Text style={styles.label}>{t('chefOrderDetail', 'cargoTypeLabel')}</Text>
              <Text style={styles.value}>
                {t(
                  'chefOrderDetail',
                  order.cargoType === 'beilader' ? 'cargoTypeBeilader' : 'cargoTypeKomplett'
                )}
              </Text>
            </View>

            {order.cargoType === 'komplett' ? (
              <>
                {(
                  [
                    ['startOdometerLabel', order.startOdometer],
                    ['loadingOdometerLabel', order.loadingOdometer],
                    ['unloadingOdometerLabel', order.unloadingOdometer],
                  ] as const
                ).map(([labelKey, reading]) => (
                  <View key={labelKey} style={styles.row}>
                    <Text style={styles.label}>{t('chefOrderDetail', labelKey)}</Text>
                    <Text style={styles.value}>
                      {reading === null ? '—' : `${reading.toLocaleString('de-DE')} km`}
                    </Text>
                  </View>
                ))}
                <View style={styles.row}>
                  <Text style={styles.label}>{t('chefOrderDetail', 'emptyKmLabel')}</Text>
                  <Text style={styles.value}>
                    {order.emptyKm === null
                      ? '—'
                      : `${order.emptyKm.toLocaleString('de-DE')} km`}
                  </Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.label}>{t('chefOrderDetail', 'freightKmLabel')}</Text>
                  <Text style={styles.value}>
                    {order.freightKm === null
                      ? '—'
                      : `${order.freightKm.toLocaleString('de-DE')} km`}
                  </Text>
                </View>
              </>
            ) : null}
          </View>
        ) : null}

        {/* Erst ab hier sinnvoll: abgerechnet wird, was gefahren wurde. */}
        {order.status === 'completed' ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('chefInvoice', 'title')}</Text>
            <InvoiceForm
              orderId={order.id}
              orderNr={order.orderNr}
              billingCompany={billingCompanyOf(order)}
            />
          </View>
        ) : null}

        {/* Laptop/Desktop: zwei Spalten nebeneinander */}
        <View style={styles.pair}>
          <View style={styles.pairItem}>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('chefOrderDetail', 'driverSection')}</Text>
              {assignedDriver ? (
                <View style={styles.row}>
                  <Text style={styles.label}>{t('chefOrderDetail', 'assignedDriverLabel')}</Text>
                  <Text style={styles.value}>{assignedDriver.username}</Text>
                </View>
              ) : order.status === 'completed' && !order.assignedTo ? (
                // Der Fahrer wurde gelöscht. Eine gefahrene Tour wird nicht neu zugewiesen.
                <Text style={styles.notAssignedText}>{t('chefOrderDetail', 'driverRemoved')}</Text>
              ) : (
                <>
                  <Text style={styles.notAssignedText}>{t('chefOrderDetail', 'notAssigned')}</Text>
                  <Text style={styles.selectDriverTitle}>{t('chefOrderDetail', 'selectDriver')}</Text>
                  {drivers.length === 0 ? (
                    <Text style={styles.notAssignedText}>{t('chefOrderDetail', 'noDriversYet')}</Text>
                  ) : (
                    <FlatList
                      scrollEnabled={false}
                      data={drivers}
                      keyExtractor={(item) => item.id}
                      renderItem={({ item }) => (
                        <FluidPressable
                          style={styles.driverOption}
                          onPress={() => handleAssign(item.id)}
                          disabled={isAssigning}
                        >
                          <Text style={styles.driverName}>{item.username}</Text>
                        </FluidPressable>
                      )}
                    />
                  )}
                </>
              )}
            </View>

          </View>
          <View style={styles.pairItem}>
            {order.status === 'completed' ? (
              <OrderDocuments orderId={order.id} />
            ) : (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>{t('orderDocuments', 'title')}</Text>
                <Text style={styles.documentsHint}>
                  {t('orderDocuments', 'hiddenUntilCompleted')}
                </Text>
              </View>
            )}

          </View>
        </View>
        
        <OwnOrderForm
          initialValues={order}
          initialPrice={price}
          submitLabel={t('chefOwnOrder', 'saveButton')}
          onSubmit={handleUpdate}
        />
      </ScrollView>

      <DeleteOrderModal
        visible={showDelete}
        orderNr={order.orderNr}
        onClose={() => setShowDelete(false)}
        onDelete={handleDelete}
      />
    </View>
  );
}

const createStyles = (theme: AppTheme) => {
  const { c } = theme;
  const u = uiStyles(theme);
  return StyleSheet.create({
    pair: u.pair,
    pairItem: u.pairItem,
    container: u.screen,
    content: {
      flex: 1,
    },
    contentInner: u.formColumn,
    backLink: u.backButton,
    backLinkText: u.backButtonText,
    // Duplizieren und Löschen rechts oben, gleich unauffällig.
    topActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    topRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    // Bewusst unauffällig: grau, ohne Fläche — Löschen ist die Ausnahme.
    deleteLink: {
      minHeight: Layout.minTouch,
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xxs,
      paddingLeft: Spacing.sm,
      marginBottom: Spacing.xs,
    },
    deleteLinkText: {
      ...Typography.subhead,
      color: c.textSecondary,
    },
    loading: {
      marginTop: Spacing.xl,
    },
    emptyState: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: Spacing.lg,
    },
    emptyStateText: u.emptyStateText,
    orderHeaderCard: {
      ...u.card,
      marginBottom: Spacing.md,
      alignItems: 'flex-start',
    },
    statusBadge: {
      ...u.badge,
      paddingHorizontal: Spacing.sm,
      paddingVertical: Spacing.xxs + 1,
    },
    statusBadgeText: u.badgeText,
    convertButton: {
      ...u.tintedButton,
      alignSelf: 'stretch',
      marginTop: Spacing.sm,
    },
    convertButtonText: u.tintedButtonText,
    buttonDisabled: u.disabled,
    section: {
      ...u.card,
      marginBottom: Spacing.md,
    },
    sectionTitle: {
      ...Typography.title3,
      color: c.text,
      marginBottom: Spacing.xs,
    },
    row: {
      minHeight: Layout.minTouch,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: Spacing.md,
      paddingVertical: Spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.separator,
    },
    label: {
      ...Typography.subhead,
      color: c.textSecondary,
    },
    value: {
      ...Typography.subhead,
      fontWeight: '600',
      color: c.text,
      flexShrink: 1,
      textAlign: 'right',
    },
    completedValue: {
      color: c.success,
    },
    documentsHint: {
      ...Typography.subhead,
      color: c.textSecondary,
    },
    notAssignedText: {
      ...Typography.subhead,
      color: c.textSecondary,
      marginBottom: Spacing.sm,
    },
    selectDriverTitle: {
      ...u.sectionTitle,
      marginTop: Spacing.xs,
    },
    driverOption: {
      ...u.option,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    driverName: u.optionText,
  });
};
