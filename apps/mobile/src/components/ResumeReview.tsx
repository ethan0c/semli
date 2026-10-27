import { localParts, relativeDay } from '@dayli/core';
import { router } from 'expo-router';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';

import { ListRow, TextButton } from '@/components/Controls';
import { Icon } from '@/components/Icon';
import { sourceName } from '@/lib/source-name';
import { enter, exit, layout } from '@/lib/motion';
import { useStore } from '@/store';
import { useTheme, space } from '@/theme';

/**
 * A read waiting in review after Semli was closed (iOS ends it in the background while a student
 * is in Photos or Files): one tap back to it, or let it go. It was lost before Oct 27, 2026, with
 * its free import already spent.
 */
export function ResumeReview({ style }: { style?: object }) {
  const { c } = useTheme();
  const pending = useStore((s) => s.pending);
  const setPending = useStore((s) => s.setPending);
  if (!pending) return null;
  const today = localParts(new Date()).date;
  const when = pending.at ? relativeDay(today, localParts(new Date(pending.at)).date).toLowerCase() : null;
  const what = sourceName(pending.source, 'a syllabus');
  const count = pending.extraction.items.length;
  return (
    <Animated.View layout={layout} entering={enter.fade} exiting={exit.fade} style={style}>
      <ListRow leading={<Icon name="file" size={20} color={c.inkPrimary} />} title="Continue your review"
        sub={`${count} ${count === 1 ? 'item' : 'items'} from ${what}${when ? ` · ${when}` : ''}. Not added to your plan yet.`}
        last onPress={() => router.push('/review')} />
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', paddingTop: space.xxs }}>
        <TextButton label="Discard import" tone="muted" onPress={() => setPending(null)} />
      </View>
    </Animated.View>
  );
}
