import { acceptance } from "discourse/tests/helpers/qunit-helpers";
import { test } from "qunit";
import { DEFAULT_DRAFT } from "discourse/plugins/discourse-chat/discourse/services/chat-draft-handler";

acceptance("Chat Draft Handler", function (needs) {
  const currentDraft = {
    value: "draft 1",
  };

  needs.user({
    username: "fzngagan",
    id: 1,
    chat_drafts: [
      {
        channel_id: 10,
        data: JSON.stringify(currentDraft),
      },
    ],
  });

  needs.pretender((server, helper) => {
    server.post("/chat/drafts", () => {
      return helper.response({ success: "OK" });
    });
  });

  test("fetches the drafts correctly from current user", async function (assert) {
    const chatDraftHandler = this.container.lookup(
      "service:chat-draft-handler"
    );
    assert.deepEqual(chatDraftHandler.getForChannel(10), currentDraft);
  });

  test("stores draft correctly", async function (assert) {
    const chatDraftHandler = this.container.lookup(
      "service:chat-draft-handler"
    );
    const draft = { value: "Hello" };
    chatDraftHandler.setForChannel(1, draft);
    assert.deepEqual(chatDraftHandler.getForChannel(1), draft);
  });

  test("returns default draft if draft is empty", async function (assert) {
    const chatDraftHandler = this.container.lookup(
      "service:chat-draft-handler"
    );
    chatDraftHandler.setForChannel(1, {
      value: "",
    });

    assert.deepEqual(chatDraftHandler.getForChannel(1), DEFAULT_DRAFT);
  });
});
