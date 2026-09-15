import { FluidPressable } from '@/components/fluid/FluidPressable';
import { Spacing } from '@/constants/theme';
import { type AppTheme, useAppTheme, useThemedStyles } from '@/hooks/use-app-theme';
import { uiStyles } from '@/constants/ui-styles';
import { dateToTimeString, timeStringToDate } from '@/lib/dateFormat';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Modal, Platform, StyleSheet, Text, View } from 'react-native';

interface TimeFieldProps {
  value: string;
  onChange: (time: string) => void;
  placeholder: string;
}

// Native (iOS/Android) time picker. display="spinner" is what gives the
// scrolling hour/minute wheel — the same UI iOS uses for its alarm clock —
// and the datetimepicker library supports that spinner style on Android
// too, so both platforms end up looking and behaving the same way. Web
// gets its own implementation in TimeField.web.tsx — this module never
// renders there.
export function TimeField({ value, onChange, placeholder }: TimeFieldProps) {
  const styles = useThemedStyles(createStyles);
  const { c, scheme } = useAppTheme();
  const [showIosPicker, setShowIosPicker] = useState(false);
  const timeValue = value ? timeStringToDate(value) : new Date();

  const openPicker = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: timeValue,
        mode: 'time',
        display: 'spinner',
        is24Hour: true,
        onChange: (event, selected) => {
          if (event.type === 'set' && selected) {
            onChange(dateToTimeString(selected));
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
        <Text style={value ? styles.value : styles.placeholder}>{value || placeholder}</Text>
        <Text style={styles.icon}>🕐</Text>
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
                value={timeValue}
                mode="time"
                display="spinner"
                is24Hour
                themeVariant={scheme}
                accentColor={c.tint}
                onChange={(_event, selected) => {
                  if (selected) onChange(dateToTimeString(selected));
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
