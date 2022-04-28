import Service from "@ember/service";
import ChatChannelDraft from "discourse/plugins/discourse-chat/discourse/models/chat-channel-draft";
import ChatApi from "discourse/plugins/discourse-chat/discourse/lib/chat-api";

export default class ChatChannelDraftManager extends Service {
  init() {
    super.init(...arguments);

    this._store = new Map();
    this._loadExistingDrafts();
  }

  draftForChannel(channel) {
    return this.drafts.get(channel.id) || ChatChannelDraft.create();
  }

  get drafts() {
    return this._store;
  }

  async sync(channel, draft) {
    if (draft?.isValid) {
      this._store.set(channel.id, draft);
    } else {
      this._store.delete(channel.id);
    }

    return ChatApi.saveDraft(channel, draft);
  }

  _loadExistingDrafts() {
    if (this.currentUser?.chat_drafts) {
      this.currentUser.chat_drafts.forEach((draft) => {
        this._store.set(
          draft.channel_id,
          ChatChannelDraft.create(JSON.parse(draft.data))
        );
      });
    }
  }
}
