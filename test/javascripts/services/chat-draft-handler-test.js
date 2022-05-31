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

  needs.hooks.beforeEach(function () {
    Object.defineProperty(this, "chatDraftHandler", {
      get: () => this.container.lookup("service:chat-draft-handler"),
    });
  });

  test("fetches the drafts correctly from current user", async function (assert) {
    assert.deepEqual(this.chatDraftHandler.getForChannel(10), currentDraft);
  });

  test("stores draft correctly", async function (assert) {
    const draft = { value: "Hello" };
    this.chatDraftHandler.setForChannel(1, draft);
    assert.deepEqual(this.chatDraftHandler.getForChannel(1), draft);
  });

  test("returns default draft if draft is empty", async function (assert) {
    this.chatDraftHandler.setForChannel(1, {
      value: "",
    });
    assert.deepEqual(this.chatDraftHandler.getForChannel(1), DEFAULT_DRAFT);
  });
});
