import { useLocalSearchParams } from 'expo-router';

import { RepeatDetail } from '@/components/RepeatDetail';

export default function RepeatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <RepeatDetail id={id} />;
}
