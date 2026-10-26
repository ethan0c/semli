import { isLocalDate, isLocalTime } from '@dayli/core';
import { colors, fontFamily } from '@dayli/tokens';
import { createElement } from 'react';
import { Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Icon, type IconKey } from '@/components/Icon';
import { T } from '@/components/Text';
import { Press } from '@/components/Press';
import { corner, radius, textStyle, useTheme, size, fade, space } from '@/theme';

// Fallbacks for web (and any non-iOS platform). The .ios.tsx file uses SwiftUI; the web's date and
// time fields are the browser's own pickers.

export interface DateFieldProps {
  date: string | null;
  time: string | null;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export interface InlinePickerProps extends DateFieldProps {
  mode: 'date' | 'time';
}

export interface ToggleProps {
  value: boolean;
  onChange: (value: boolean) => void;
  label?: string;
  activeColor?: string;
}

export interface NativeButtonProps {
  label: string;
  onPress: () => void;
  role?: 'default' | 'cancel' | 'destructive' | 'close';
  color?: string;
  systemImage?: string;
  icon?: IconKey;
}

function Field({ value, placeholder, onChange, valid, width, disabled }: { value: string | null; placeholder: string; onChange: (v: string) => void; valid: boolean; width: number; disabled?: boolean }) {
  const { c } = useTheme();
  return (
    <TextInput
      value={value ?? ''}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor={c.inkTertiary}
      autoCapitalize="none"
      autoCorrect={false}
      editable={!disabled}
      style={[styles.field, textStyle('subhead', valid ? c.inkPrimary : c.conflict), { backgroundColor: c.canvas, borderWidth: valid ? 0 : 1, borderColor: c.conflict, width }]}
    />
  );
}

/** The browser's own date or time picker; it only ever reports a complete value. */
function WebField({ type, value, onChange, disabled, label }: { type: 'date' | 'time'; value: string | null; onChange: (v: string) => void; disabled?: boolean; label: string }) {
  const { c, dark } = useTheme();
  return createElement('input', {
    type,
    value: value ?? '',
    disabled,
    'aria-label': label,
    onChange: (e: { target: { value: string } }) => {
      const next = e.target.value;
      if (type === 'date' ? isLocalDate(next) : isLocalTime(next)) onChange(next);
    },
    style: {
      height: 32, border: 'none', borderRadius: radius.small, padding: '0 10px', backgroundColor: c.row, color: c.inkPrimary,
      fontFamily: fontFamily.regular, fontSize: 15, fontVariantNumeric: 'tabular-nums', colorScheme: dark ? 'dark' : 'light',
      opacity: disabled ? fade.disabled : 1,
    },
  });
}

export function DateField({ date, onChange, disabled }: DateFieldProps) {
  if (Platform.OS === 'web') return <WebField type="date" value={date} onChange={onChange} disabled={disabled} label="Date" />;
  return <Field value={date} placeholder="YYYY-MM-DD" onChange={onChange} valid={!!disabled || isLocalDate(date)} width={112} disabled={disabled} />;
}

export function TimeField({ time, onChange, disabled }: DateFieldProps) {
  if (Platform.OS === 'web') return <WebField type="time" value={time} onChange={onChange} disabled={disabled} label="Time" />;
  return <Field value={time} placeholder="HH:MM" onChange={onChange} valid={!!disabled || time === null || isLocalTime(time)} width={68} disabled={disabled} />;
}

/** Off iOS the opened pill shows the same field a row would. */
export function InlinePicker({ mode, ...field }: InlinePickerProps) {
  return mode === 'date' ? <DateField {...field} /> : <TimeField {...field} />;
}

export function NativeToggle({ value, onChange, label, activeColor }: ToggleProps) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={() => onChange(!value)}
      hitSlop={10}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value }}
      style={[styles.toggle, { backgroundColor: value ? activeColor ?? c.added : c.line }]}>
      <View style={[styles.knob, { backgroundColor: colors.white, alignSelf: value ? 'flex-end' : 'flex-start' }]} />
    </Pressable>
  );
}

export function NativeButton({ label, onPress, role, icon }: NativeButtonProps) {
  const { c } = useTheme();
  const ink = role === 'destructive' ? c.conflict : c.inkPrimary;
  return (
    <Press onPress={onPress} accessibilityRole="button" style={[styles.btn, { backgroundColor: c.row }]}>
      {icon ? <Icon name={icon} size={16} color={ink} /> : null}
      <T token="headline" color={ink}>
        {label}
      </T>
    </Press>
  );
}

const styles = StyleSheet.create({
  field: { height: 32, ...corner(radius.small), borderWidth: 1, paddingHorizontal: space.xs },
  toggle: { width: 40, height: 24, borderRadius: 12, padding: space.hair, justifyContent: 'center' },
  knob: { width: 20, height: 20, borderRadius: 10 },
  btn: { minHeight: size.control, paddingVertical: space.sm, borderRadius: radius.pill, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.xs },
});
