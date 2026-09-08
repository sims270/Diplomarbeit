import { FluidPressable } from '@/components/fluid/FluidPressable';
import { Colors } from '@/constants/theme';
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

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    backgroundColor: 'white',
  },
  value: {
    fontSize: 14,
    color: Colors.ui.charcoal,
  },
  placeholder: {
    fontSize: 14,
    color: '#9a9a9a',
  },
  icon: {
    fontSize: 14,
  },
  iosOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  iosSheet: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  doneButton: {
    backgroundColor: Colors.ui.primary,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  doneButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 15,
  },
});
