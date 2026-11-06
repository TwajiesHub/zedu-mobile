import { useDataContext } from '@/store/useDataContext';
import { initialSavedMessages } from '@/store/saved-messages';

export function useSavedMessages() {
  const { state, savedMessagesController } = useDataContext();
  return {
    saved: state.savedMessages || initialSavedMessages(),
    controller: savedMessagesController,
    orgId: state.orgId,
  };
}
