import { FluidPressable } from '@/components/fluid/FluidPressable';
import { Spacing } from '@/constants/theme';
import { type AppTheme, useAppTheme, useThemedStyles } from '@/hooks/use-app-theme';
import { uiStyles } from '@/constants/ui-styles';
import { dateToIso, isoToDate, isoToGerman } from '@/lib/dateFormat';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Modal, Platform, StyleSheet, Text, View } from 'react-native';

interface DateFieldProps {
  value: string;
  onChange: (isoDate: string) => void;
  placeholder: string;
}

// Native (iOS/Android) date picker. Android's picker is a one-shot native
// dialog (DateTimePickerAndroid.open), while iOS needs the picker mounted
// in a sheet with an explicit "Fertig" to close it. Web gets its own
// implementation in DateField.web.tsx — this module never renders there.
export function DateField({ value, onChange, placeholder }: DateFieldProps) {
  const styles = useThemedStyles(createStyles);
  const { c, scheme } = useAppTheme();
  const [showIosPicker, setShowIosPicker] = useState(false);
  const dateValue = value ? isoToDate(value) : new Date();

  const openPicker = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: dateValue,
        mode: 'date',
        onChange: (event, selected) => {
          if (event.type === 'set' && selected) {
            onChange(dateToIso(selected));
          }
        },
      });
      return;
    }
    setShowIosPicker(true);
  };

  return (
    <>
      <FluidPressable style={styles.field} onPress={openPicker}>
        <Text style={value ? styles.value : styles.placeholder}>
          {value ? isoToGerman(value) : placeholder}
        </Text>
        <Text style={styles.icon}>📅</Text>
      </FluidPressable>

      {Platform.OS === 'ios' && (
        <Modal
          visible={showIosPicker}
          transparent
          animationType="slide"
          onRequestClose={() => setShowIosPicker(false)}
        >
          <View style={styles.iosOverlay}>
            <View style={styles.iosSheet}>
              <DateTimePicker
                value={dateValue}
                mode="date"
                display="inline"
                themeVariant={scheme}
                accentColor={c.tint}
                onChange={(_event, selected) => {
                  if (selected) onChange(dateToIso(selected));
                }}
              />
              <FluidPressable style={styles.doneButton} onPress={() => setShowIosPicker(false)}>
                <Text style={styles.doneButtonText}>Fertig</Text>
              </FluidPressable>
            </View>
          </View>
        </Modal>
      )}
    </>
  );
}

const createStyles = (theme: AppTheme) => {
  const u = uiStyles(theme);
  return StyleSheet.create({
    field: u.field,
    value: u.fieldValue,
    placeholder: u.fieldPlaceholder,
    icon: {
      fontSize: 16,
    },
    iosOverlay: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: theme.c.overlay,
    },
    iosSheet: {
      ...u.modalSheet,
      maxHeight: undefined,
    },
    doneButton: {
      ...u.primaryButton,
      marginTop: Spacing.md,
    },
    doneButtonText: u.primaryButtonText,
  });
};
