import { initialSavedMessages } from './saved-messages';
import type { AppState } from './Reducers';

/** The app state before anyone signs in. Signing out resets to this. */
export const initialAppState: AppState = {
  savedMessages: initialSavedMessages(),
  // auth
  token: null,
  user: null,
  success: null,
  error: null,
  callback: false,
  authFlow: null,
  userTyping: [],
  chatSubscription: null,
  channelSubscription: null,
  replySubscription: null,

  // organisation
  orgId: null,
  orgData: null,
  org: [],
  orgMembers: [],
  orgCallback: false,

  // dms
  dms: [],
  dmsChat: [],
  singleDmsChat: [],
  dmLoading: true,
  participant: [],
  singleParticipant: [],
  receiver: null,
  media: [],
  uploading: false,
  groupDetails: null,
  groupCallback: false,
  selectedMsg: null,

  // channels
  userChannels: [],
  allChannels: [],
  channelLoading: true,
  channelsChat: [],
  replyChat: [],
  channelDetails: null,
  channel: null,
  channelCallback: false,
  replyCallback: false,

  // agents
  agents: [],
  agent: null,
  agentsChat: [],
  agentCallback: false,

  // buzz
  hasJoined: false,
  buzzData: null,
  buzzParticipants: [],
  buzzChats: [],
  floatingEmojis: [],
  buzzIsMuted: true,
  buzzShowVideo: false,
  buzzIsScreenSharing: false,
  buzzJoinLoading: false,
  isCallMinimized: false,
  minimizedFrom: null,

  // settings
  statusCallback: false,
  billings: [],

  // mentions
  mentionsList: [],
  unseenThreadCount: 0,
  loadThreadCallback: false,
  mentionUser: false,
};
