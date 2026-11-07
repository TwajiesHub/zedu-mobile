import { useCallback, useEffect, useRef, useState } from 'react';
import * as api from '@/services/channel-webhooks';
import { ChannelWebhook, WebhookStatus } from '@/types/webhook';

type State = {
  scope: string;
  webhook: ChannelWebhook | null;
  loading: boolean;
  busy: boolean;
  error: string | null;
};
const message = (error: unknown) =>
  error instanceof Error
    ? error.message
    : 'Could not load webhook. Please try again.';

export function useChannelWebhook(
  channelId: string,
  orgScope: string,
  enabled: boolean,
) {
  const scope = JSON.stringify([orgScope, channelId, enabled]);
  const current = useRef(scope);
  const mounted = useRef(true);
  const request = useRef(0);
  const running = useRef<{ scope: string; id: number } | null>(null);
  if (current.current !== scope) {
    current.current = scope;
    request.current += 1;
    running.current = null;
  }
  const [state, setState] = useState<State>({
    scope,
    webhook: null,
    loading: enabled,
    busy: false,
    error: null,
  });
  const visible =
    state.scope === scope
      ? state
      : { scope, webhook: null, loading: enabled, busy: false, error: null };
  const webhook = useRef<ChannelWebhook | null>(null);
  webhook.current = visible.webhook;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = useCallback(
    async (action: () => Promise<ChannelWebhook | null>, loading = false) => {
      if (
        !enabled ||
        !channelId ||
        current.current !== scope ||
        running.current?.scope === scope
      )
        return false;
      const id = ++request.current;
      running.current = { scope, id };
      setState(previous => ({
        scope,
        webhook: previous.scope === scope ? previous.webhook : null,
        loading,
        busy: !loading,
        error: null,
      }));
      try {
        const value = await action();
        if (
          !mounted.current ||
          current.current !== scope ||
          request.current !== id
        )
          return false;
        webhook.current = value;
        setState({
          scope,
          webhook: value,
          loading: false,
          busy: false,
          error: null,
        });
        return true;
      } catch (error) {
        if (
          mounted.current &&
          current.current === scope &&
          request.current === id
        ) {
          setState(previous => ({
            ...previous,
            scope,
            loading: false,
            busy: false,
            error: message(error),
          }));
        }
        return false;
      } finally {
        if (running.current?.id === id) running.current = null;
      }
    },
    [channelId, enabled, scope],
  );

  const refresh = useCallback(
    () => run(() => api.getChannelWebhook(channelId), true),
    [channelId, run],
  );
  useEffect(() => {
    if (enabled && channelId) refresh();
  }, [enabled, channelId, refresh]);

  return {
    ...visible,
    refresh,
    create: () => run(() => api.createChannelWebhook(channelId)),
    changeStatus: (status: WebhookStatus) => {
      const id = webhook.current?.id;
      return id
        ? run(() => api.changeChannelWebhookStatus(channelId, id, status))
        : Promise.resolve(false);
    },
    rename: (name: string, event: string) => {
      const id = webhook.current?.id;
      return id
        ? run(() => api.renameChannelWebhook(channelId, id, name, event))
        : Promise.resolve(false);
    },
    remove: () => {
      const id = webhook.current?.id;
      return id
        ? run(async () => {
            await api.deleteChannelWebhook(channelId, id);
            return null;
          })
        : Promise.resolve(false);
    },
  };
}
