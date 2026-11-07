import { useCallback, useEffect, useRef, useState } from 'react';
import { getChannelWebhookHistory } from '@/services/channel-webhooks';
import { WebhookHistoryItem } from '@/types/webhook';

type State = {
  scope: string;
  items: WebhookHistoryItem[];
  page: number;
  hasMore: boolean;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
};

export function useWebhookHistory(
  channelId: string,
  webhookId: string,
  orgScope: string,
  enabled: boolean,
) {
  const scope = JSON.stringify([orgScope, channelId, webhookId, enabled]);
  const current = useRef(scope);
  const alive = useRef(true);
  const request = useRef(0);
  const running = useRef<{ scope: string; id: number } | null>(null);
  if (current.current !== scope) {
    current.current = scope;
    request.current += 1;
    running.current = null;
  }
  const [state, setState] = useState<State>({
    scope,
    items: [],
    page: 0,
    hasMore: true,
    loading: enabled,
    refreshing: false,
    error: null,
  });
  const visible =
    state.scope === scope
      ? state
      : {
          scope,
          items: [],
          page: 0,
          hasMore: true,
          loading: enabled,
          refreshing: false,
          error: null,
        };
  const latest = useRef(visible);
  latest.current = visible;
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const load = useCallback(
    async (refresh = false) => {
      if (
        !enabled ||
        !channelId ||
        !webhookId ||
        running.current?.scope === scope ||
        (!refresh && !latest.current.hasMore)
      )
        return;
      const page = refresh ? 1 : latest.current.page + 1;
      const id = ++request.current;
      running.current = { scope, id };
      setState(previous => ({
        ...previous,
        scope,
        ...(previous.scope !== scope
          ? { items: [], page: 0, hasMore: true }
          : {}),
        loading: true,
        refreshing: refresh && previous.items.length > 0,
        error: null,
      }));
      try {
        const result = await getChannelWebhookHistory(
          channelId,
          webhookId,
          page,
        );
        if (
          !alive.current ||
          current.current !== scope ||
          request.current !== id
        )
          return;
        setState(previous => {
          const items = refresh ? [] : previous.items;
          const merged = new Map(
            [...items, ...result.items].map(item => [item.id, item]),
          );
          const added = refresh || merged.size > items.length;
          return {
            scope,
            items: [...merged.values()],
            page,
            hasMore: result.hasMore && added,
            loading: false,
            refreshing: false,
            error: null,
          };
        });
      } catch (error) {
        if (
          alive.current &&
          current.current === scope &&
          request.current === id
        )
          setState(previous => ({
            ...previous,
            loading: false,
            refreshing: false,
            error:
              error instanceof Error
                ? error.message
                : 'Could not load delivery history',
          }));
      } finally {
        if (running.current?.id === id) running.current = null;
      }
    },
    [channelId, webhookId, enabled, scope],
  );
  useEffect(() => {
    if (enabled) load(true);
  }, [enabled, load]);
  return { ...visible, load };
}
