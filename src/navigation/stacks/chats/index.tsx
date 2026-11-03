import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import CallScreen from '@/screens/chats/call-screen';
import ChatDetailScreen from '@/screens/chats/chatdetails';
import GroupCallScreen from '@/screens/chats/group-call-screen';
import GroupChatDetailScreen from '@/screens/chats/groupchatdetails';
import { GroupAddMembersScreen } from '@/screens/chats/group-add-members';
import { AddMemberScreen } from '@/screens/chats/add-member';
import GroupChatThreadScreen from '@/screens/chats/group-chat-thread';
import GroupDetailsScreen from '@/screens/chats/group-details';
import { GroupAddNewMembersScreen } from '@/screens/chats/group-add-new-members';
import DmDetailsScreen from '@/screens/chats/dm-details';
import UserDetailScreen from '@/screens/chats/user-detail';
import GroupUserDetailScreen from '@/screens/chats/group-user-detail';
import MediaGalleryScreen from '@/screens/chats/media-gallery';
import ChatThreadScreen from '@/screens/chats/chat-thread';
import PinnedMessagesScreen from '@/screens/chats/pinned-messages';
import type { PinScope } from '@/utils/resolve-pinned-messages';

export type ChatStackParamList = {
  ChatDetails: {
    participant_id?: string;
    channel_id: string;
    restore_on_back?: boolean;
    restore_participants?: any[];
    restore_dms_chat?: any[];
    fromNotification?: boolean;
    unread_count?: number;
  };
  CallScreen: undefined;
  GroupChatDetails: {
    participant_id?: string;
    channel_id: string;
    fromNotification?: boolean;
  };
  GroupCallScreen: undefined;
  GroupAddMembersScreen: undefined;
  GroupAddNewMembers: {
    channel_id: string;
  };
  AddMemberScreen: undefined;
  GroupChatThreadScreen: {
    channel_id: string;
    thread_id: string;
    highlight_message_id?: string;
  };
  ChatThreadScreen: {
    channel_id: string;
    thread_id: string;
    chatType?: 'dm' | 'group_dm' | 'channel';
    highlight_message_id?: string;
  };
  GroupDetailsScreen: {
    participant_id?: string;
    channel_id: string;
  };
  DmDetailsScreen: {
    channel_id: string;
  };
  UserDetailScreen: {
    participant: any;
    channel_id: string;
  };
  GroupUserDetailScreen: {
    participant: any;
    channel_id: string;
  };
  MediaGalleryScreen: {
    channel_id?: string;
    preview_media?: any[];
  };
  PinnedMessages: {
    channel_id: string;
    scope?: PinScope;
  };
};

const Stack = createStackNavigator<ChatStackParamList>();

export const ChatStack = () => (
  <Stack.Navigator
    screenOptions={{
      headerShown: false,
      // ...TransitionPresets.SlideFromRightIOS,
    }}
  >
    <Stack.Screen name="ChatDetails" component={ChatDetailScreen} />
    <Stack.Screen name="CallScreen" component={CallScreen} />
    <Stack.Screen name="GroupChatDetails" component={GroupChatDetailScreen} />
    <Stack.Screen name="GroupCallScreen" component={GroupCallScreen} />
    <Stack.Screen
      name="GroupAddMembersScreen"
      component={GroupAddMembersScreen}
    />
    <Stack.Screen
      name="GroupAddNewMembers"
      component={GroupAddNewMembersScreen}
    />
    <Stack.Screen name="AddMemberScreen" component={AddMemberScreen} />
    <Stack.Screen
      name="GroupChatThreadScreen"
      component={GroupChatThreadScreen}
    />
    <Stack.Screen name="ChatThreadScreen" component={ChatThreadScreen} />
    <Stack.Screen name="GroupDetailsScreen" component={GroupDetailsScreen} />
    <Stack.Screen name="DmDetailsScreen" component={DmDetailsScreen} />
    <Stack.Screen name="UserDetailScreen" component={UserDetailScreen} />
    <Stack.Screen
      name="GroupUserDetailScreen"
      component={GroupUserDetailScreen}
    />
    <Stack.Screen name="MediaGalleryScreen" component={MediaGalleryScreen} />
    <Stack.Screen name="PinnedMessages" component={PinnedMessagesScreen} />
  </Stack.Navigator>
);
