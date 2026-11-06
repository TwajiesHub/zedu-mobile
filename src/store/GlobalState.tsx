import {
  createContext,
  useReducer,
  useRef,
  useMemo,
  useEffect,
  useCallback,
  ReactNode,
  Dispatch,
} from 'react';
import { SavedMessagesController } from '@/services/saved-messages-controller';
import reducers, { AppState } from './Reducers';
import { Action, ACTIONS } from './types';
import { initialAppState } from './initial-state';

// Define the context shape
interface ContextProps {
  state: AppState;
  dispatch: Dispatch<Action>;
  savedMessagesController?: SavedMessagesController;
}

export const DataContext = createContext<ContextProps | undefined>(undefined);

export const DataProvider = ({ children }: { children: ReactNode }) => {
  const [state, reactDispatch] = useReducer(reducers, initialAppState);

  const stateRef = useRef(state);
  stateRef.current = state;
  const dispatch = useCallback((action: Action) => {
    // Keep request coordination current even while React batches async updates.
    if (
      action.type === ACTIONS.SAVED_MESSAGES ||
      action.type === ACTIONS.ORG_ID ||
      action.type === ACTIONS.TOKEN ||
      action.type === ACTIONS.RESET_STATE
    )
      stateRef.current = reducers(stateRef.current, action);
    reactDispatch(action);
  }, []);
  const savedMessagesController = useMemo(
    () =>
      new SavedMessagesController(
        () => stateRef.current,
        payload => dispatch({ type: ACTIONS.SAVED_MESSAGES, payload }),
      ),
    [dispatch],
  );
  useEffect(() => {
    if (state.orgId && state.token) {
      savedMessagesController.loadLookup().catch(() => {});
    }
  }, [state.orgId, state.token, savedMessagesController]);

  return (
    <DataContext.Provider value={{ state, dispatch, savedMessagesController }}>
      {children}
    </DataContext.Provider>
  );
};
