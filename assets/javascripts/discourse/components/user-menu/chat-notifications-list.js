import UserMenuNotificationsList from "discourse/components/user-menu/notifications-list";

export default class UserMenuChatNotificationsList extends UserMenuNotificationsList {
  get filterByTypes() {
    return ["chat_mention", "chat_message", "chat_invitation", "chat_quoted"];
  }
}
