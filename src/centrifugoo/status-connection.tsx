import { useEffect, useRef } from 'react';
import { Centrifuge } from 'centrifuge';
import axios from 'axios';
import { ACTIONS } from '@/store/types';
import { useDataContext } from '@/store/useDataContext';
import { BASE_URL, CONNECT_URL } from '@env';

const StatusConnection = () => {
  const { state, dispatch } = useDataContext();
  const { orgId, user } = state;
  const userRef = useRef(user);
  const statusCallbackRef = useRef(state?.statusCallback);

  useEffect(() => {
    userRef.current = user;
    statusCallbackRef.current = state?.statusCallback;
  }, [user, state?.statusCallback]);

  const getConnectionToken = async () => {
    try {
      const response = await axios.get(`${BASE_URL}/token/connection`, {
        headers: {
          Authorization: `Bearer ${state?.token}`,
          'Content-Type': 'application/json',
        },
      });
      return response.data.data.token;
    } catch (error) {
      console.error('Centrifugo Conn Token Error:', error);
    }
  };

  const getSubscriptionToken = async (channel: string) => {
    try {
      const response = await axios.post(
        `${BASE_URL}/token/subscription`,
        { channel },
        {
          headers: {
            Authorization: `Bearer ${state?.token}`,
            'Content-Type': 'application/json',
          },
        },
      );
      return response.data.data.token;
    } catch (error) {
      console.error('Centrifugo Sub Token Error:', error);
    }
  };

  // Latest token getters for the long-lived subscription below.
  const tokenGetters = useRef({ getConnectionToken, getSubscriptionToken });
  useEffect(() => {
    tokenGetters.current = { getConnectionToken, getSubscriptionToken };
  });

  useEffect(() => {
    if (!orgId || !state?.token) return;

    const centrifugeClient: any = new Centrifuge(CONNECT_URL, {
      getToken: () => tokenGetters.current.getConnectionToken(),
      debug: true,
    });

    const sub = centrifugeClient.newSubscription(orgId, {
      getToken: () => tokenGetters.current.getSubscriptionToken(orgId),
    });

    sub.on('publication', (ctx: any) => {
      const { data } = ctx;

      // console.log(data, 'status centrifugo');

      if (data?.notification_type === 'profile_status_updated') {
        const targetUserId =
          data?.modification_ids?.user_id || data?.data?.user_id;
        const updatedData = data?.data?.status;

        if (!targetUserId || !updatedData) return;

        const currentUser = userRef.current;
        const currentUserId = currentUser?.user_id ?? currentUser?.id;

        if (currentUser && String(targetUserId) === String(currentUserId)) {
          // Merge the new status fields into the user object
          dispatch({
            type: ACTIONS.USER,
            payload: {
              ...currentUser,
              text: updatedData?.text,
              icon: updatedData?.emoji,
              status_timeout: updatedData?.expiry,
              online: updatedData?.online,
            },
          });
          dispatch({
            type: ACTIONS.STATUS_CALLBACK,
            payload: !statusCallbackRef.current,
          });
          return;
        }

        if (typeof updatedData?.online === 'boolean') {
          dispatch({
            type: ACTIONS.UPDATE_USER_PRESENCE,
            payload: {
              user_id: String(targetUserId),
              online: updatedData.online,
            },
          });
        }
      }
    });

    sub.on('error', (ctx: any) =>
      console.error(`Mention subscription error: ${ctx.message}`),
    );

    centrifugeClient.connect();
    sub.subscribe();

    return () => {
      sub.unsubscribe();
      centrifugeClient.disconnect();
    };
  }, [dispatch, orgId, state?.token]);

  return null;
};

export default StatusConnection;
