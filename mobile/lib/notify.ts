import { Alert, Platform } from 'react-native';

export type NotifyTone = 'info' | 'success' | 'error' | 'warning';

type Notifier = (title: string, message?: string, tone?: NotifyTone) => void;
let notifier: Notifier | null = null;

export function registerNotifier(fn: Notifier) {
  notifier = fn;
  return () => {
    if (notifier === fn) notifier = null;
  };
}

function guessTone(title: string): NotifyTone {
  const t = title.toLowerCase();
  if (/fail|could not|invalid|wrong|missing|error|required|incorrect/.test(t)) return 'error';
  if (/joined|created|published|copied|saved|success|welcome|done|complete/.test(t)) return 'success';
  return 'info';
}

/**
 * Cross-platform replacement for Alert.alert. On web RN's Alert does nothing,
 * which made every login/signup error invisible; this shows a toast instead.
 */
export function notify(title: string, message?: string, tone?: NotifyTone) {
  const t = tone ?? guessTone(title);
  if (Platform.OS !== 'web') {
    Alert.alert(title, message);
    return;
  }
  if (notifier) notifier(title, message, t);
  else if (typeof window !== 'undefined') window.alert(message ? `${title}\n${message}` : title);
}
