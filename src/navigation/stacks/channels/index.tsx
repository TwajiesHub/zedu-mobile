import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import ChannelHome from '@/screens/channels';
import ChannelDetailScreen from '@/screens/channels/channel-details';
import ChannelChatScreen from '@/screens/channels/channel-chat';
import ChannelCallScreen from '@/screens/channels/channel-call-screen';
import ChannelThreadScreen from '@/screens/channels/channel-thread';
import CreateChannelScreen from '@/screens/channels/create-channel';
import { AddMembersScreen } from '@/screens/channels/add-members';
import BrowseChannel from '@/screens/channels/browse-channels';
import { AddNewMembersScreen } from '@/screens/channels/add-new-members';
import MediaGalleryScreen from '@/screens/chats/media-gallery';
import ChannelUserDetailScreen from '@/screens/channels/channel-user-detail';
import PinnedMessagesScreen from '@/screens/chats/pinned-messages';
import type { PinScope } from '@/utils/resolve-pinned-messages';

export type ChannelStackParamList = {
  ChannelList: undefined;
  ChannelChat:
    | {
        channel_id?: string;
        fromNotification?: boolean;
        highlight_thread_id?: string;
      }
    | undefined;
  ChannelDetails: {
    channel_id: string;
  };
  ChannelCall: undefined;
  ChannelThread: {
    channel_id: string;
    thread_id: string;
    highlight_message_id?: string;
  };
  CreateChannel: undefined;
  BrowseChannel: undefined;
  UserDetails: {
    participant: any;
    channel_id: string;
  };
  AddMembers: undefined;
  AddNewMembers: {
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
  NotificationPreference: {
    channel_id: string;
    channelName?: string;
  };
};

const Stack = createStackNavigator<ChannelStackParamList>();

export const ChannelStack = () => (
  <Stack.Navigator
    screenOptions={{
      headerShown: false,
      // ...TransitionPresets.SlideFromRightIOS,
    }}
  >
    <Stack.Screen name="ChannelList" component={ChannelHome} />
    <Stack.Screen name="ChannelChat" component={ChannelChatScreen} />
    <Stack.Screen name="ChannelDetails" component={ChannelDetailScreen} />
    <Stack.Screen name="ChannelCall" component={ChannelCallScreen} />
    <Stack.Screen name="ChannelThread" component={ChannelThreadScreen} />
    <Stack.Screen name="CreateChannel" component={CreateChannelScreen} />
    <Stack.Screen name="BrowseChannel" component={BrowseChannel} />
    <Stack.Screen name="AddMembers" component={AddMembersScreen} />
    <Stack.Screen name="AddNewMembers" component={AddNewMembersScreen} />
    <Stack.Screen name="MediaGalleryScreen" component={MediaGalleryScreen} />
    <Stack.Screen name="PinnedMessages" component={PinnedMessagesScreen} />
    <Stack.Screen name="UserDetails" component={ChannelUserDetailScreen} />
    <Stack.Screen
      name="NotificationPreference"
      component={require('@/screens/channels/notification-preference').default}
    />
  </Stack.Navigator>
);
