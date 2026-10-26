import { localParts } from '@dayli/core';
import { Button as SwiftButton, DatePicker, Host, Toggle } from '@expo/ui/swift-ui';
import type { ComponentProps } from 'react';
import { accessibilityLabel, buttonBorderShape, buttonStyle, controlSize, datePickerStyle, labelsHidden, tint } from '@expo/ui/swift-ui/modifiers';

import type { DateFieldProps, InlinePickerProps, NativeButtonProps, ToggleProps } from '@/components/Native';
import { useTheme, size } from '@/theme';

function toDate(date: string | null, time: string | null): Date {
  const [y, m, d] = (date ?? localParts(new Date()).date).split('-').map(Number);
  const [hh, mm] = (time ?? '09:00').split(':').map(Number);
  return new Date(y!, m! - 1, d!, hh!, mm!);
}

/** SwiftUI compact date picker; the system sheet handles the calendar. */
export function DateField({ date, time, onChange, disabled }: DateFieldProps) {
  return (
    <Host style={{ height: 34, width: 124 }} matchContents>
      <DatePicker
        selection={toDate(date, time)}
        displayedComponents={['date']}
        onDateChange={(d) => onChange(localParts(d).date)}
        modifiers={[datePickerStyle('compact')]}
      />
    </Host>
  );
}

export function TimeField({ date, time, onChange }: DateFieldProps) {
  return (
    <Host style={{ height: 34, width: 92 }} matchContents>
      <DatePicker
        selection={toDate(date, time)}
        displayedComponents={['hourAndMinute']}
        onDateChange={(d) => onChange(localParts(d).time)}
        modifiers={[datePickerStyle('compact')]}
      />
    </Host>
  );
}

/**
 * The picker a pill opens in place, under its row, the way Calendar does: a wheel for a time, the
 * month for a date. It is showing as soon as the pill is tapped; a compact picker behind a pill
 * needed a second tap for its popover.
 */
export function InlinePicker({ mode, date, time, onChange }: InlinePickerProps) {
  return (
    <Host style={{ width: '100%' }} matchContents={{ vertical: true }}>
      <DatePicker
        selection={toDate(date, time)}
        displayedComponents={[mode === 'date' ? 'date' : 'hourAndMinute']}
        onDateChange={(d) => onChange(mode === 'date' ? localParts(d).date : localParts(d).time)}
        modifiers={[datePickerStyle(mode === 'date' ? 'graphical' : 'wheel'), labelsHidden()]}
      />
    </Host>
  );
}

export function NativeToggle({ value, onChange, label, activeColor }: ToggleProps) {
  const { c } = useTheme();
  return (
    // The React Native row owns sizing and safe-area placement. Letting each
    // tiny host adapt to the screen edge moves its switch as the row scrolls.
    <Host style={{ width: 52, height: 32, flexShrink: 0 }} alignment="center" ignoreSafeArea="all">
      <Toggle isOn={value} onIsOnChange={onChange} modifiers={[tint(activeColor ?? c.added), ...(label ? [accessibilityLabel(label)] : [])]} />
    </Host>
  );
}

/** A real SwiftUI button for secondary actions (delete, done). Primary CTAs stay brand-styled. */
export function NativeButton({ label, onPress, role, color, systemImage }: NativeButtonProps) {
  return (
    <Host style={{ height: size.control, alignSelf: 'center' }} matchContents>
      <SwiftButton
        label={label}
        onPress={onPress}
        role={role}
        systemImage={systemImage as ComponentProps<typeof SwiftButton>['systemImage']}
        modifiers={[buttonStyle('bordered'), controlSize('large'), buttonBorderShape('capsule'), ...(color ? [tint(color)] : [])]}
      />
    </Host>
  );
}
