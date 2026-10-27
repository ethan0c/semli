import type { ExtractRequest, ExtractResponse } from '@dayli/schema';
import Purchases from 'react-native-purchases';

import { requestExtraction, type StreamHooks } from './api';
import { reportError } from './errors';
import { initializePurchases } from './revenuecat';
import { supabase } from './supabase';

/**
 * Who is asking, for the server's import limit: the Supabase session (a guest gets a silent
 * anonymous one, never shown as an account) and the RevenueCat id, so Plus is unlimited.
 */
async function importHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {};
  if (supabase) {
    try {
      let session = (await supabase.auth.getSession()).data.session;
      if (!session) {
        const { data, error } = await supabase.auth.signInAnonymously();
        if (error) throw error;
        session = data.session;
      }
      if (session) headers.authorization = `Bearer ${session.access_token}`;
    } catch (error) {
      reportError('auth.anonymous_session', error);
    }
  }
  try {
    await initializePurchases();
    headers['x-revenuecat-app-user-id'] = await Purchases.getAppUserID();
  } catch {
    // No store in this build (web, or unconfigured keys): the server counts free imports.
  }
  return headers;
}

/** Sends an import with who is asking; with `hooks`, rows arrive as they're read. */
export async function requestImport(apiUrl: string, req: ExtractRequest, hooks?: StreamHooks): Promise<ExtractResponse> {
  return requestExtraction(apiUrl, req, await importHeaders(), hooks);
}
