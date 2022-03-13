import selectKit from "discourse/tests/helpers/select-kit-helper";
import {
  acceptance,
  exists,
  publishToMessageBus,
  query,
} from "discourse/tests/helpers/qunit-helpers";
import {
  chatChannels,
  chatView,
} from "discourse/plugins/discourse-chat/chat-fixtures";
import { test } from "qunit";
import { click, settled, visit } from "@ember/test-helpers";
import { cloneJSON } from "discourse-common/lib/object";

acceptance("Discourse Chat - Flagging test", function (needs) {
  needs.user({
    admin: false,
    moderator: false,
    username: "eviltrout",
    id: 100,
    can_chat: true,
    has_chat_enabled: true,
  });
  needs.pretender((server, helper) => {
    server.get("/chat/chat_channels.json", () => helper.response(chatChannels));
    server.get("/chat/9/messages.json", () => {
      let copy = cloneJSON(chatView);
      copy.meta.can_flag = false;
      copy.user_silenced = false;
      return helper.response(copy);
    });
    server.get("/chat/75/messages.json", () => {
      return helper.response(chatView);
    });
    server.post("/uploads/lookup-urls", () => {
      return helper.response([]);
    });
    server.put("/chat/flag", () => {
      return helper.response({ success: true });
    });
  });
  needs.settings({
    chat_enabled: true,
  });

  test("Flagging in public channel works", async function (assert) {
    await visit("/chat/channel/75/site");
    assert.notOk(exists(".chat-live-pane .chat-message .chat-message-flagged"));
    let moreBtns = selectKit(".chat-live-pane .chat-message .more-buttons");
    await moreBtns.expand();
    const content = moreBtns.displayedContent();
    assert.ok(content.find((row) => row.id === "flag"));
    await moreBtns.selectRowByValue("flag");
    assert.ok(exists(".bootbox.in"));
    await click(".bootbox.in .btn-primary");
    await publishToMessageBus("/chat/75", {
      typ: "self_flagged",
      chat_message_id: chatView.chat_messages[0].id,
      user_flag_status: 0,
    });
    await publishToMessageBus("/chat/75", {
      typ: "flag",
      chat_message_id: chatView.chat_messages[0].id,
      reviewable_id: 1,
    });
    await settled();
    const reviewableLink = query(
      `.chat-message-container[data-id='${chatView.chat_messages[0].id}'] .chat-message-flagged`
    );
    assert.ok(reviewableLink.href.endsWith("/review/1"));
  });

  test("Flag button isn't present for DM channel", async function (assert) {
    await visit("/chat/channel/9/@hawk");
    let moreBtns = selectKit(".chat-live-pane .chat-message .more-buttons");
    await moreBtns.expand();
    const content = moreBtns.displayedContent();
    assert.notOk(content.find((row) => row.id === "flag"));
  });
});
