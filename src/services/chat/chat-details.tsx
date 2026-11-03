// import { useState, useCallback, useEffect, useRef } from "react";
// import { ACTIONS } from "@/store/types";
// import { useDataContext } from "@/store/useDataContext";
// import { GetRequest } from "@/utils/requests";
// import { useFocusEffect } from "@react-navigation/native";

// interface Props {
//     channel_id: string;
// }

// const UseChatDetails = ({ channel_id }: Props) => {
//     const { state, dispatch } = useDataContext();
//     const [page, setPage] = useState(1);
//     const [isFetchingMore, setIsFetchingMore] = useState(false);
//     const [hasMore, setHasMore] = useState(true);

//     useFocusEffect(
//         useCallback(() => {
//             const getChat = async () => {
//                 const { data, error } = await GetRequest(`/dms/channels/${channel_id}/threads?page=1&limit=50`);
//                 if (!error && data?.data) {
//                     dispatch({
//                         type: ACTIONS.DMS_CHAT, payload: {
//                             data: data.data,
//                             page: 1
//                         }
//                     });
//                     setPage(1);
//                 }
//             }

//             getChat();
//         }, [channel_id, dispatch, state?.callback])
//     );

//     const loadMore = useCallback(async () => {
//         if (isFetchingMore || !hasMore || state?.dmsChat?.length < 50) return;

//         setIsFetchingMore(true);
//         const nextPage = page + 1;

//         try {
//             const { data, error } = await GetRequest(
//                 `/dms/channels/${channel_id}/threads?page=${nextPage}&limit=50`
//             );

//             if (!error && data?.data) {
//                 const freshMessages = data.data;
//                 const paginationDetails = data.pagination[0];

//                 dispatch({
//                     type: ACTIONS.DMS_CHAT,
//                     payload: {
//                         data: freshMessages,
//                         page: nextPage
//                     }
//                 });

//                 setPage(nextPage);

//                 if (nextPage >= (paginationDetails?.total_pages_count || 0)) {
//                     setHasMore(false);
//                 }
//             } else {
//                 setHasMore(false);
//             }
//         } catch (err) {
//             console.error(err);
//         } finally {
//             setIsFetchingMore(false);
//         }
//     }, [channel_id, page, isFetchingMore, hasMore, dispatch]);

//     return { loadMore, isFetchingMore };
// };

// export default UseChatDetails;

import { useState, useCallback, useEffect, useRef } from 'react';
import { ACTIONS } from '@/store/types';
import { useDataContext } from '@/store/useDataContext';
import { GetRequest } from '@/utils/requests';
import { useFocusEffect } from '@react-navigation/native';

interface Props {
  channel_id: string;
}

const UseChatDetails = ({ channel_id }: Props) => {
  const { state, dispatch } = useDataContext();
  const [page, setPage] = useState(1);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const isFocusedRef = useRef(false);
  // The conversation whose first page has loaded, so screens can tell when
  // dmsChat belongs to this channel rather than the previous one.
  const [loadedChannelId, setLoadedChannelId] = useState<string | null>(null);

  const fetchPage1 = useCallback(async () => {
    const { data, error } = await GetRequest(
      `/dms/channels/${channel_id}/threads?page=1&limit=50`,
    );
    if (!error && data?.data) {
      dispatch({
        type: ACTIONS.DMS_CHAT,
        payload: {
          data: data.data,
          page: 1,
        },
      });
      setPage(1);
      const paginationDetails = data.pagination?.[0];
      if (paginationDetails?.total_pages_count) {
        setHasMore(paginationDetails.total_pages_count > 1);
      } else {
        setHasMore(data.data.length >= 50);
      }
    }
    setLoadedChannelId(channel_id);
  }, [channel_id, dispatch]);

  // Fires on focus (covers normal navigation and back-navigation)
  useFocusEffect(
    useCallback(() => {
      isFocusedRef.current = true;
      fetchPage1();
      return () => {
        isFocusedRef.current = false;
      };
    }, [fetchPage1, state?.callback]),
  );

  // Fires when channel_id changes while screen is already focused

  useEffect(() => {
    if (isFocusedRef.current) {
      fetchPage1();
    }
  }, [channel_id]);

  const loadMore = useCallback(async () => {
    if (isFetchingMore || !hasMore || state?.dmsChat?.length < 50) return;

    setIsFetchingMore(true);
    const nextPage = page + 1;

    try {
      const { data, error } = await GetRequest(
        `/dms/channels/${channel_id}/threads?page=${nextPage}&limit=50`,
      );

      if (!error && data?.data) {
        const freshMessages = data.data;
        const paginationDetails = data.pagination[0];

        dispatch({
          type: ACTIONS.DMS_CHAT,
          payload: {
            data: freshMessages,
            page: nextPage,
          },
        });

        setPage(nextPage);

        if (nextPage >= (paginationDetails?.total_pages_count || 0)) {
          setHasMore(false);
        }
      } else {
        setHasMore(false);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsFetchingMore(false);
    }
  }, [channel_id, page, isFetchingMore, hasMore, dispatch, state?.dmsChat]);

  return {
    loadMore,
    isFetchingMore,
    isInitialLoading: loadedChannelId !== channel_id,
  };
};

export default UseChatDetails;
