import { ajax } from "discourse/lib/ajax";
import { popupAjaxError } from "discourse/lib/ajax-error";

export default class ChatApi {
  static saveDraft(channel, draft) {
    const data = { channel_id: channel.id };

    if (draft?.isValid) {
      data.data = JSON.stringify(draft);
    }

    return ajax("/chat/drafts.json", { type: "POST", data }).catch(
      popupAjaxError
    );
  }
}
