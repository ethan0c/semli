import { ScrollView, StyleSheet } from 'react-native';

import { Group, Row, ToggleRow } from '@/components/Settings';
import { feedback } from '@/lib/feedback';
import { openSystemSettings } from '@/lib/links';
import { showPhoneCalendar, turnOffPhoneCalendar, turnOnPhoneCalendar, usePhoneCalendar, type PhoneCalendarInfo } from '@/lib/phone-calendar';
import { screen } from '@/theme';

/** The iPhone's calendar beside the plan: on or off, and which of its calendars show. */
export default function PhoneCalendarScreen() {
  const on = usePhoneCalendar((s) => s.on);
  const denied = usePhoneCalendar((s) => s.denied);
  const calendars = usePhoneCalendar((s) => s.calendars);
  const hidden = usePhoneCalendar((s) => s.hidden);
  const showing = on && !denied;
  const accounts = calendars.reduce<Map<string, PhoneCalendarInfo[]>>((map, cal) => map.set(cal.account, [...(map.get(cal.account) ?? []), cal]), new Map());
  const toggle = (value: boolean) => {
    feedback('select');
    if (value) void turnOnPhoneCalendar('settings');
    else turnOffPhoneCalendar();
  };
  return (
    <ScrollView contentContainerStyle={styles.body} contentInsetAdjustmentBehavior="automatic">
      <Group footer="See events from your iPhone's calendars, including Outlook, Google and iCloud, in Today and Plan. Semli shows when they overlap with your plans. These events stay on this iPhone and aren't saved to your Semli account.">
        <ToggleRow label="Show my iPhone calendar" value={showing} onChange={toggle} last />
      </Group>
      {denied ? (
        <Group footer="To show your events, Semli needs calendar access. Open Settings, go to Privacy & Security, then Calendars, and choose Full Access for Semli.">
          <Row label="Open Settings" onPress={() => void openSystemSettings()} last />
        </Group>
      ) : null}
      {showing ? [...accounts].map(([account, list]) => (
        <Group key={account} title={account || 'On this iPhone'}>
          {list.map((cal, i) => (
            <Row key={cal.id} label={cal.title} selected={!hidden.includes(cal.id)} last={i === list.length - 1}
              onPress={() => { feedback('select'); showPhoneCalendar(cal.id, hidden.includes(cal.id)); }} />
          ))}
        </Group>
      )) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({ body: screen.settingsBody });
