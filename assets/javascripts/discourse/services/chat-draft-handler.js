import Service from "@ember/service";
import discourseDebounce from "discourse-common/lib/debounce";
import { ajax } from "discourse/lib/ajax";

export default class ChatDraftHandler extends Service {
  init() {
    super.init(...arguments);

    this.draftStore = {};
    if (this.currentUser.chat_drafts) {
      this.currentUser.chat_drafts.forEach((draft) => {
        this.draftStore[draft.channel_id] = JSON.parse(draft.data);
      });
    }
  }

  _saveDraft(channelId, draft) {
    const data = { channel_id: channelId };
    if (draft) {
      data.data = JSON.stringify(draft);
    }

    ajax("/chat/drafts", { type: "POST", data });
  }

  setDraftForChannel(channel, draft) {
    if (
      draft &&
      (draft.value || draft.uploads.length > 0 || draft.replyToMsg)
    ) {
      this.draftStore[channel.id] = draft;
    } else {
      delete this.draftStore[channel.id];
      draft = null; // _saveDraft will destroy draft
    }

    discourseDebounce(this, this._saveDraft, channel.id, draft, 2000);
  }

  getDraftForChannel(channelId) {
    return (
      this.draftStore[channelId] || {
        value: "",
        uploads: [],
        replyToMsg: null,
      }
    );
  }
}
