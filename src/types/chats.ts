export interface Chat {
  avatar_url: string;
  default_avatar_url: string;
  channel_id: string;
  channel_type: string;
  participant_email: string;
  participant_id: string;
  thread_count: number;
  username: string;
  last_read_at: string;
  created_at: string;
  preview_message: string;
  participants: Participant[];
  preview_thread: any;
  is_favourite: boolean;
  is_suggested: boolean;
  online?: boolean;
}

export interface Participant {
  avatar_url: string;
  default_avatar_url: string;
  email: string;
  user_id: string;
  id?: string;
  username: string;
  is_admin?: boolean;
  online?: boolean;
  full_name?: string;
  title?: string;
  icon?: string;
  text?: string;
  phone?: string;
  timezone?: string;
  name_pronounciation?: string;
}

export interface ChatItem {
  avatar_url: string;
  channel_name: string;
  channel_type: string;
  channels_id: string;
  created_at: string;
  current_status: string;
  edited: boolean;
  email: string;
  full_name: string;
  is_pinned: boolean;
  last_reply: string;
  media: [];
  message: string;
  messages: any;
  org_id: string;
  pinned_details: any;
  reactions: any;
  status: string;
  thread_id: string;
  type: string;
  user_id: string;
  user_type: string;
  username: string;
}

export interface Group {
  created_at: string;
  participants: Participant[];
  preview_media: any;
  type: string;
  group_description: string;
  is_favourite: boolean;
  groups_in_common: {
    avatar_url: string;
    id: string;
    channel_id: string;
    participants: string[];
  }[];
}
