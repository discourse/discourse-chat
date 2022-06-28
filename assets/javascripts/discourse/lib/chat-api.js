import { ajax } from "discourse/lib/ajax";
import { popupAjaxError } from "discourse/lib/ajax-error";

export default class ChatApi {
  static async chatChannelMemberships(channelId, data) {
    return await ajax(`/chat/api/chat_channels/${channelId}/memberships.json`, {
      data,
    }).catch(popupAjaxError);
  }

  static async updateChatChannelNotificationsSettings(channelId, data = {}) {
    return await ajax(
      `/chat/api/chat_channels/${channelId}/notifications_settings.json`,
      {
        method: "PUT",
        data,
      }
    ).catch(popupAjaxError);
  }

  static async modifyChatChannel(channelId, data) {
    return await ajax(`/chat/api/chat_channels/${channelId}.json`, {
      method: "PUT",
      data,
    }).catch(popupAjaxError);
  }

  static async unfollowChatChannel(channelId) {
    return await ajax(`/chat/chat_channels/${channelId}/unfollow.json`, {
      method: "POST",
    }).catch(popupAjaxError);
  }

  static async followChatChannel(channelId) {
    return await ajax(`/chat/chat_channels/${channelId}/follow.json`, {
      method: "POST",
    }).catch(popupAjaxError);
  }
}
