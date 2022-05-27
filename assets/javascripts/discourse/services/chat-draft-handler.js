import Service from "@ember/service";
import { ajax } from "discourse/lib/ajax";

const DEFAULT_DRAFT = {
  value: "",
  uploads: [],
  replyToMsg: null,
};

export default class ChatDraftHandler extends Service {
  init() {
    super.init(...arguments);

    this._draftStore = {};
    if (this.currentUser.chat_drafts) {
      this.currentUser.chat_drafts.forEach((draft) => {
        this._draftStore[draft.channel_id] = JSON.parse(draft.data);
      });
    }
  }

  setForChannel(channelId, draft) {
    if (
      draft &&
      (draft.value || draft.uploads.length > 0 || draft.replyToMsg)
    ) {
      this._draftStore[channelId] = draft;
    } else {
      delete this._draftStore[channelId];
      draft = null;
    }

    const data = { channel_id: channelId };

    if (draft) {
      data.data = JSON.stringify(draft);
    }

    ajax("/chat/drafts", { type: "POST", data });
  }

  getForChannel(channelId) {
    return this._draftStore[channelId] || DEFAULT_DRAFT;
  }
}
