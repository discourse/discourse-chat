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
    return await this._performRequest(
      `/chat/api/chat_channels/${channelId}.json`,
      {
        method: "PUT",
        data,
      }
    );
  }

  static async unfollowChatChannel(channelId) {
    return await this._performRequest(
      `/chat/chat_channels/${channelId}/unfollow.json`,
      {
        method: "POST",
      }
    );
  }

  static async followChatChannel(channelId) {
    return await this._performRequest(
      `/chat/chat_channels/${channelId}/follow.json`,
      {
        method: "POST",
      }
    );
  }

  static async categoryPermissions(categoryId) {
    return await this._performRequest(
      `/chat/api/category-chatables/${categoryId}/permissions.json`
    );
  }

  static async _performRequest(...args) {
    return await ajax(...args).catch(popupAjaxError);
  }
}
