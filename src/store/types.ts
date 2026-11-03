import { Agent } from '@/types/agents';
import { AuthFlow } from '@/types/auth';
import { Channel } from '@/types/channel';
import { Chat, Group, Participant } from '@/types/chats';
import { ThreadListItem } from '@/types/thread';

/**
 * 1. ACTION ENUMS
 * Grouped by feature domain
 */
export enum ACTIONS {
  // Returns the whole state to its initial values (used on sign-out).
  RESET_STATE = 'RESET_STATE',
  // === AUTH & GLOBAL ===
  TOKEN = 'TOKEN',
  USER = 'USER',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR',
  CALLBACK = 'CALLBACK',
  UPLOADING = 'UPLOADING',
  AUTH_FLOW = 'AUTH_FLOW',
  USER_TYPING = 'USER_TYPING',
  CLEAR_TYPING = 'CLEAR_TYPING',
  CHAT_SUBSCRIPTION = 'CHAT_SUBSCRIPTION',
  CHANNEL_SUBSCRIPTION = 'CHANNEL_SUBSCRIPTION',
  REPLY_SUBSCRIPTION = 'REPLY_SUBSCRIPTION',

  // === ORGANISATION ===
  ORG = 'ORG',
  ORG_ID = 'ORG_ID',
  ORG_DATA = 'ORG_DATA',
  ORG_MEMBERS = 'ORG_MEMBERS',
  ORG_CALLBACK = 'ORG_CALLBACK',

  // === CHATS (DM) ===
  DMS = 'DMS',
  DMS_CHAT = 'DMS_CHAT',
  SINGLE_DMS_CHAT = 'SINGLE_DMS_CHAT',
  EDIT_DM_CHAT = 'EDIT_DM_CHAT',
  EDIT_SINGLE_DM_CHAT = 'EDIT_SINGLE_DM_CHAT',
  DM_LOADING = 'DM_LOADING',
  PARTICIPANT = 'PARTICIPANT',
  SINGLE_PARTICIPANT = 'SINGLE_PARTICIPANT',
  RECEIVER = 'RECEIVER',
  UPDATE_DM_REACTIONS = 'UPDATE_DM_REACTIONS',
  UPDATE_DM_COUNT = 'UPDATE_DM_COUNT',
  UPDATE_DM_AND_MOVE_TO_TOP = 'UPDATE_DM_AND_MOVE_TO_TOP',
  UPDATE_MESSAGE_THREAD = 'UPDATE_MESSAGE_THREAD',
  RESET_DM_THREAD_COUNT = 'RESET_DM_THREAD_COUNT',
  UPDATE_USER_PRESENCE = 'UPDATE_USER_PRESENCE',
  DELETE_DM_MESSAGE = 'DELETE_DM_MESSAGE',
  MEDIA = 'MEDIA',
  GROUP_DETAILS = 'GROUP_DETAILS',
  GROUP_CALLBACK = 'GROUP_CALLBACK',
  SELECTED_MSG = 'SELECTED_MSG',

  // === CHANNELS ===
  USER_CHANNELS = 'USER_CHANNELS',
  ALL_CHANNELS = 'ALL_CHANNELS',
  CHANNEL_LOADING = 'CHANNEL_LOADING',
  EDIT_CHANNELS_CHAT = 'EDIT_CHANNELS_CHAT',
  CHANNELS_CHAT = 'CHANNELS_CHAT',
  REPLY_CHAT = 'REPLY_CHAT',
  CHANNEL_DETAILS = 'CHANNEL_DETAILS',
  CHANNEL = 'CHANNEL',
  UPDATE_CHANNEL_COUNT = 'UPDATE_CHANNEL_COUNT',
  UPDATE_CHANNEL_MESSAGE_THREAD = 'UPDATE_CHANNEL_MESSAGE_THREAD',
  UPDATE_CHANNEL_REACTIONS = 'UPDATE_CHANNEL_REACTIONS',
  UPDATE_CHANNEL_PIN = 'UPDATE_CHANNEL_PIN',
  UPDATE_DM_PIN = 'UPDATE_DM_PIN',
  UPDATE_REPLY_PIN = 'UPDATE_REPLY_PIN',
  RESET_CHANNEL_THREAD_COUNT = 'RESET_CHANNEL_THREAD_COUNT',
  DELETE_CHANNEL_MESSAGE = 'DELETE_CHANNEL_MESSAGE',
  CHANNEL_CALLBACK = 'CHANNEL_CALLBACK',
  REPLY_CALLBACK = 'REPLY_CALLBACK',
  UPDATE_REPLY_REACTIONS = 'UPDATE_REPLY_REACTIONS',

  // === AGENTS ===
  AGENTS = 'AGENTS',
  AGENT = 'AGENT',
  AGENTS_CHAT = 'AGENTS_CHAT',
  AGENT_CALLBACK = 'AGENT_CALLBACK',

  // =====BUZZ ========
  BUZZ_SIGNAL_UPDATE = 'BUZZ_SIGNAL_UPDATE',
  BUZZ_PARTICIPANTS = 'BUZZ_PARTICIPANTS',
  BUZZ_PARTICIPANT_MEDIA_PATCH = 'BUZZ_PARTICIPANT_MEDIA_PATCH',
  BUZZ_PARTICIPANT_REMOVE = 'BUZZ_PARTICIPANT_REMOVE',
  BUZZ_CHATS = 'BUZZ_CHATS',
  BUZZ_DATA = 'BUZZ_DATA',
  FLOATING_EMOJIS = 'FLOATING_EMOJIS',
  ADD_FLOATING_EMOJI = 'ADD_FLOATING_EMOJI',
  REMOVE_FLOATING_EMOJI = 'REMOVE_FLOATING_EMOJI',
  HAS_JOINED = 'HAS_JOINED',
  BUZZ_IS_MUTED = 'BUZZ_IS_MUTED',
  BUZZ_SHOW_VIDEO = 'BUZZ_SHOW_VIDEO',
  BUZZ_IS_SCREEN_SHARING = 'BUZZ_IS_SCREEN_SHARING',
  BUZZ_JOIN_LOADING = 'BUZZ_JOIN_LOADING',
  CALL_MINIMIZED = 'CALL_MINIMIZED',
  CALL_MINIMIZED_FROM = 'CALL_MINIMIZED_FROM',
  RESET_DIRECT_CALL_SESSION = 'RESET_DIRECT_CALL_SESSION',

  // === SETTINGS ===
  STATUS_CALLBACK = 'STATUS_CALLBACK',
  BILLINGS = 'BILLINGS',

  // === MENTIONS ===
  MENTIONS_LIST = 'MENTIONS_LIST',
  UNSEEN_THREAD_COUNT = 'UNSEEN_THREAD_COUNT',
  LOAD_THREAD = 'LOAD_THREAD',
  MENTION_USER = 'MENTION_USER',
}

/**
 * 2. ACTION INTERFACES
 */

// -------------------- Auth & Global -----------------------------
interface TokenAction {
  type: ACTIONS.TOKEN;
  payload: string | null;
}
interface UserAction {
  type: ACTIONS.USER;
  payload: any | null;
}
interface SuccessAction {
  type: ACTIONS.SUCCESS;
  payload: string | null;
}
interface ErrorAction {
  type: ACTIONS.ERROR;
  payload: string | null;
}
interface CallbackAction {
  type: ACTIONS.CALLBACK;
  payload: boolean;
}
interface UploadingAction {
  type: ACTIONS.UPLOADING;
  payload: boolean;
}
interface AuthFlowAction {
  type: ACTIONS.AUTH_FLOW;
  payload: AuthFlow;
}
interface UserTypingAction {
  type: ACTIONS.USER_TYPING;
  payload: {
    userId: string | number;
    username?: string;
    typing: boolean;
  };
}
interface ClearTypingAction {
  type: ACTIONS.CLEAR_TYPING;
}
interface ChatSubscriptionAction {
  type: ACTIONS.CHAT_SUBSCRIPTION;
  payload: any | null;
}
interface ChannelSubscriptionAction {
  type: ACTIONS.CHANNEL_SUBSCRIPTION;
  payload: any | null;
}
interface ReplySubscriptionAction {
  type: ACTIONS.REPLY_SUBSCRIPTION;
  payload: any | null;
}

// -------------------- Organisation ------------------------------
interface OrgAction {
  type: ACTIONS.ORG;
  payload: any[];
}
interface OrgIdAction {
  type: ACTIONS.ORG_ID;
  payload: string | null;
}
interface OrgDataAction {
  type: ACTIONS.ORG_DATA;
  payload: any | null;
}
interface OrgCallbackAction {
  type: ACTIONS.ORG_CALLBACK;
  payload: boolean;
}
interface OrgMembersAction {
  type: ACTIONS.ORG_MEMBERS;
  payload: { data: any[]; page: number };
}

// ------------------ Chats (DMs) ----------------------------------
interface DmsAction {
  type: ACTIONS.DMS;
  payload: Chat[];
}
interface DmLoadingAction {
  type: ACTIONS.DM_LOADING;
  payload: boolean;
}
interface ParticipantAction {
  type: ACTIONS.PARTICIPANT;
  payload: Participant[];
}
interface SingleParticipantAction {
  type: ACTIONS.SINGLE_PARTICIPANT;
  payload: Participant[];
}
interface ReceiverAction {
  type: ACTIONS.RECEIVER;
  payload: object | null;
}
interface GroupDetailsAction {
  type: ACTIONS.GROUP_DETAILS;
  payload: Group | null;
}
interface MediaAction {
  type: ACTIONS.MEDIA;
  payload: any[];
}
interface GroupCallbackAction {
  type: ACTIONS.GROUP_CALLBACK;
  payload: boolean;
}
interface SelectedMsgAction {
  type: ACTIONS.SELECTED_MSG;
  payload: any | null;
}

interface DmsChatAction {
  type: ACTIONS.DMS_CHAT;
  payload: {
    newMessage?: any;
    data?: any[];
    page?: number;
  };
}

interface SingleDmsChatAction {
  type: ACTIONS.SINGLE_DMS_CHAT;
  payload: {
    newMessage?: any;
    data?: any[];
    page?: number;
  };
}

interface EditSingleDmChatAction {
  type: ACTIONS.EDIT_SINGLE_DM_CHAT;
  payload: {
    threadId: string;
    updatedMessage: any;
  };
}

interface UpdateDmReactionsAction {
  type: ACTIONS.UPDATE_DM_REACTIONS;
  payload: {
    threadId: string;
    reactions: any[];
  };
}

interface UpdateDmCountAction {
  type: ACTIONS.UPDATE_DM_COUNT;
  payload: {
    channel_id: string;
    thread_count: number;
  };
}

interface UpdateDmAndMoveToTopAction {
  type: ACTIONS.UPDATE_DM_AND_MOVE_TO_TOP;
  payload: Chat;
}

interface UpdateMessageThreadAction {
  type: ACTIONS.UPDATE_MESSAGE_THREAD;
  payload: {
    threadId: string;
    reply: any;
    updates: any;
  };
}

interface ResetDmCountAction {
  type: ACTIONS.RESET_DM_THREAD_COUNT;
  payload: string;
}

interface UpdateUserPresenceAction {
  type: ACTIONS.UPDATE_USER_PRESENCE;
  payload: {
    user_id: string;
    online: boolean;
  };
}

interface DeleteDmMessageAction {
  type: ACTIONS.DELETE_DM_MESSAGE;
  payload: {
    threadId: string;
  };
}

interface EditDmMessageAction {
  type: ACTIONS.EDIT_DM_CHAT;
  payload: {
    threadId: string;
    updatedMessage: any;
  };
}

// -------------------- Channels ----------------------------
interface UserChannelsAction {
  type: ACTIONS.USER_CHANNELS;
  payload: [];
}
interface AllChannelsAction {
  type: ACTIONS.ALL_CHANNELS;
  payload: [];
}
interface ChannelLoadingAction {
  type: ACTIONS.CHANNEL_LOADING;
  payload: boolean;
}
interface ChannelDetailsAction {
  type: ACTIONS.CHANNEL_DETAILS;
  payload: Channel | null;
}
interface ChannelAction {
  type: ACTIONS.CHANNEL;
  payload: Channel | null;
}
interface ChannelCallbackAction {
  type: ACTIONS.CHANNEL_CALLBACK;
  payload: boolean;
}
interface ChannelsChatAction {
  type: ACTIONS.CHANNELS_CHAT;
  payload: {
    newMessage?: any;
    data?: any[];
    page?: number;
  };
}
interface UpdateUserChannelCountAction {
  type: ACTIONS.UPDATE_CHANNEL_COUNT;
  payload: {
    channels_id: string;
    thread_count: number;
    channel?: Partial<Channel>;
  };
}

interface UpdateChannelMessageThreadAction {
  type: ACTIONS.UPDATE_CHANNEL_MESSAGE_THREAD;
  payload: {
    threadId: string;
    reply: any;
    updates: any;
  };
}

interface UpdateChannelReactionsAction {
  type: ACTIONS.UPDATE_CHANNEL_REACTIONS;
  payload: {
    threadId: string;
    reactions: any[];
  };
}

interface UpdateChannelPinAction {
  type: ACTIONS.UPDATE_CHANNEL_PIN;
  payload: {
    threadId: string;
    is_pin: boolean;
    details?: any;
  };
}

interface UpdateDmPinAction {
  type: ACTIONS.UPDATE_DM_PIN;
  payload: {
    threadId: string;
    is_pin: boolean;
    details?: any;
  };
}

interface UpdateReplyPinAction {
  type: ACTIONS.UPDATE_REPLY_PIN;
  payload: {
    threadId: string;
    is_pin: boolean;
    details?: any;
  };
}

interface ResetChannelCountAction {
  type: ACTIONS.RESET_CHANNEL_THREAD_COUNT;
  payload: string;
}

interface DeleteChannelMessageAction {
  type: ACTIONS.DELETE_CHANNEL_MESSAGE;
  payload: {
    threadId: string;
  };
}

interface EditChannelMessageAction {
  type: ACTIONS.EDIT_CHANNELS_CHAT;
  payload: {
    threadId: string;
    updatedMessage: any;
  };
}

// ----------------REPLY SECTION--------------------

interface ReplyChatAction {
  type: ACTIONS.REPLY_CHAT;
  payload: {
    newMessage?: any;
    data?: any[];
    page?: number;
    removedMessageId?: string;
  };
}

interface ReplyCallbackAction {
  type: ACTIONS.REPLY_CALLBACK;
  payload: boolean;
}

interface UpdateReplyReactionsAction {
  type: ACTIONS.UPDATE_REPLY_REACTIONS;
  payload: {
    messageId: string;
    reactions: any[];
  };
}

// -- Agents --

interface AgentsAction {
  type: ACTIONS.AGENTS;
  payload: Agent[];
}
interface AgentAction {
  type: ACTIONS.AGENT;
  payload: Agent | null;
}
interface AgentCallbackAction {
  type: ACTIONS.AGENT_CALLBACK;
  payload: boolean;
}

interface AgentsChatAction {
  type: ACTIONS.AGENTS_CHAT;
  payload: {
    newMessage?: any;
    data?: any[];
    page?: number;
  };
}

// -----Buzz ------------
interface BuzzDataAction {
  type: ACTIONS.BUZZ_DATA;
  payload: any;
}
interface BuzzParticipantsAction {
  type: ACTIONS.BUZZ_PARTICIPANTS;
  payload: any[];
}
interface BuzzParticipantMediaPatchAction {
  type: ACTIONS.BUZZ_PARTICIPANT_MEDIA_PATCH;
  payload: {
    user_id?: string;
    agoraNumericUid?: number;
    screenAgoraNumericUid?: number;
    audioTrack?: boolean;
    videoTrack?: boolean;
    screenTrack?: boolean;
  };
}
interface BuzzSignalUpdateAction {
  type: ACTIONS.BUZZ_SIGNAL_UPDATE;
  payload: {
    notification_type: string;
    buzzEventData: any;
  };
}
interface BuzzParticipantRemoveAction {
  type: ACTIONS.BUZZ_PARTICIPANT_REMOVE;
  payload: {
    user_id?: string;
    agoraNumericUid?: number;
  };
}
interface BuzzChatsAction {
  type: ACTIONS.BUZZ_CHATS;
  payload: any[];
}
interface FloatingEmojisAction {
  type: ACTIONS.FLOATING_EMOJIS;
  payload: any[];
}
interface AddFloatingEmojiAction {
  type: ACTIONS.ADD_FLOATING_EMOJI;
  payload: any;
}
interface RemoveFloatingEmojiAction {
  type: ACTIONS.REMOVE_FLOATING_EMOJI;
  payload: string | number;
}
interface HasJoinedAction {
  type: ACTIONS.HAS_JOINED;
  payload: boolean;
}
interface BuzzIsMutedAction {
  type: ACTIONS.BUZZ_IS_MUTED;
  payload: boolean;
}
interface BuzzShowVideoAction {
  type: ACTIONS.BUZZ_SHOW_VIDEO;
  payload: boolean;
}
interface BuzzIsScreenSharingAction {
  type: ACTIONS.BUZZ_IS_SCREEN_SHARING;
  payload: boolean;
}
interface BuzzJoinLoadingAction {
  type: ACTIONS.BUZZ_JOIN_LOADING;
  payload: boolean;
}
interface CallMinimizedAction {
  type: ACTIONS.CALL_MINIMIZED;
  payload: boolean;
}
interface CallMinimizedFromAction {
  type: ACTIONS.CALL_MINIMIZED_FROM;
  payload: 'OngoingDirectCall' | 'CallScreen' | 'ChannelCall' | null;
}
interface ResetDirectCallSessionAction {
  type: ACTIONS.RESET_DIRECT_CALL_SESSION;
}

// --- Settings ---
interface StatusCallbackAction {
  type: ACTIONS.STATUS_CALLBACK;
  payload: boolean;
}
interface BillingsAction {
  type: ACTIONS.BILLINGS;
  payload: any[];
}

// --- Mentions ---
interface MentionsListAction {
  type: ACTIONS.MENTIONS_LIST;
  payload: ThreadListItem[];
}
interface UnseenThreadCountAction {
  type: ACTIONS.UNSEEN_THREAD_COUNT;
  payload: number;
}
interface LoadThreadCallbackAction {
  type: ACTIONS.LOAD_THREAD;
  payload: boolean;
}
interface MentionUserAction {
  type: ACTIONS.MENTION_USER;
  payload: boolean;
}

/**
 * 3. EXPORTED ACTION UNION
 */
export type ResetStateAction = { type: ACTIONS.RESET_STATE };

export type Action =
  // Global
  | ResetStateAction
  | TokenAction
  | UserAction
  | SuccessAction
  | ErrorAction
  | CallbackAction
  | UploadingAction
  | AuthFlowAction
  | UserTypingAction
  | ClearTypingAction
  | ChatSubscriptionAction
  | ChannelSubscriptionAction
  | ReplySubscriptionAction

  // Org
  | OrgAction
  | OrgIdAction
  | OrgDataAction
  | OrgMembersAction
  | OrgCallbackAction

  // DMs
  | DmsAction
  | DmLoadingAction
  | DmsChatAction
  | SingleDmsChatAction
  | ParticipantAction
  | SingleParticipantAction
  | ReceiverAction
  | MediaAction
  | UpdateDmReactionsAction
  | UpdateDmCountAction
  | UpdateDmAndMoveToTopAction
  | UpdateMessageThreadAction
  | ResetDmCountAction
  | UpdateUserPresenceAction
  | DeleteDmMessageAction
  | GroupDetailsAction
  | GroupCallbackAction
  | SelectedMsgAction
  | EditDmMessageAction
  | EditSingleDmChatAction

  // Channels
  | UserChannelsAction
  | AllChannelsAction
  | ChannelLoadingAction
  | ChannelsChatAction
  | ChannelDetailsAction
  | ChannelAction
  | UpdateUserChannelCountAction
  | UpdateChannelMessageThreadAction
  | UpdateChannelReactionsAction
  | UpdateChannelPinAction
  | UpdateDmPinAction
  | ResetChannelCountAction
  | DeleteChannelMessageAction
  | ChannelCallbackAction
  | EditChannelMessageAction

  // Reply
  | ReplyChatAction
  | ReplyCallbackAction
  | UpdateReplyReactionsAction
  | UpdateReplyPinAction

  // Agents
  | AgentsAction
  | AgentAction
  | AgentsChatAction
  | AgentCallbackAction

  // Buzz
  | BuzzDataAction
  | BuzzParticipantsAction
  | BuzzParticipantMediaPatchAction
  | BuzzParticipantRemoveAction
  | BuzzChatsAction
  | FloatingEmojisAction
  | AddFloatingEmojiAction
  | RemoveFloatingEmojiAction
  | HasJoinedAction
  | BuzzIsMutedAction
  | BuzzShowVideoAction
  | BuzzIsScreenSharingAction
  | BuzzJoinLoadingAction
  | CallMinimizedAction
  | CallMinimizedFromAction
  | ResetDirectCallSessionAction
  | BuzzSignalUpdateAction

  // Settings
  | StatusCallbackAction
  | BillingsAction

  // Mentions
  | MentionsListAction
  | UnseenThreadCountAction
  | LoadThreadCallbackAction
  | MentionUserAction;
