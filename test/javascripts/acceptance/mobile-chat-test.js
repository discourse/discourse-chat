import { acceptance, exists } from "discourse/tests/helpers/qunit-helpers";
import { click, currentURL, visit } from "@ember/test-helpers";
import { chatChannels } from "discourse/plugins/discourse-chat/chat-fixtures";

acceptance("Discourse Chat - Mobile test", function (needs) {
  needs.user({
    admin: false,
    moderator: false,
    username: "eviltrout",
    id: 1,
    can_chat: true,
    has_chat_enabled: true,
  });
  needs.mobileView();
  needs.pretender((server, helper) => {
    server.get("/chat/chat_channels.json", () => helper.response(chatChannels));
  });
  needs.settings({
    chat_enabled: true,
  });

  test("Chat index route shows channel list", async function (assert) {
    await visit("/latest");
    await click(".header-dropdown-toggle.open-chat");
    assert.equal(currentURL(), "/chat");
    assert.ok(exists(".chat-channels"));
  });
});
