import { acceptance } from "discourse/tests/helpers/qunit-helpers";
import { test } from "qunit";

acceptance("Discourse Chat | Unit | Service | chat", function (needs) {
  needs.hooks.beforeEach(function () {
    Object.defineProperty(this, "chatService", {
      get: () => this.container.lookup("service:chat"),
    });
    Object.defineProperty(this, "currentUser", {
      get: () => this.container.lookup("current-user:main"),
    });
  });

  needs.user();

  needs.pretender((server, helper) => {
    server.get("/chat/chat_channels.json", () => {
      return helper.response({
        public_channels: [{ id: 1, title: "something", unread_count: 2 }],
        direct_message_channels: [],
      });
    });
  });

  test("#refreshTrackingState", async function (assert) {
    this.currentUser.set("chat_channel_tracking_state", {});

    await this.chatService.refreshTrackingState();

    assert.equal(
      this.currentUser.chat_channel_tracking_state[1].unread_count,
      2
    );
  });
});
