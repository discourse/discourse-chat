import {
  acceptance,
  updateCurrentUser,
} from "discourse/tests/helpers/qunit-helpers";
import { test } from "qunit";
import ChatChannelDraft from "discourse/plugins/discourse-chat/discourse/models/chat-channel-draft";

acceptance(
  "DiscourseChat | Service | chat-channel-draft-manager",
  function (needs) {
    needs.user();

    needs.pretender((server, helper) => {
      server.post("/chat/drafts.json", (request) => {
        const data = helper.parsePostData(request.requestBody);
        return helper.response(200, data);
      });
    });

    test(".drafts - currentUser has existing drafts", async function (assert) {
      const channelId = 1;

      updateCurrentUser({
        chat_drafts: [
          { channel_id: channelId, data: JSON.stringify({ value: "foo" }) },
        ],
      });

      const manager = this.container.lookup(
        "service:chat-channel-draft-manager"
      );
      assert.equal(manager.drafts.size, 1);
      assert.equal(manager.drafts.get(channelId).value, "foo");
    });

    test(".drafts - currentUser has no existing drafts", async function (assert) {
      const manager = this.container.lookup(
        "service:chat-channel-draft-manager"
      );
      assert.equal(manager.drafts.size, 0);
    });

    test(".sync - valid draft", async function (assert) {
      const channel = { id: 1 };
      const manager = this.container.lookup(
        "service:chat-channel-draft-manager"
      );
      const draft = ChatChannelDraft.create({ value: "foo" });
      await manager.sync(channel, draft);

      assert.equal(manager.drafts.size, 1);
      assert.equal(manager.drafts.get(channel.id).value, "foo");
    });

    test(".sync - invalid draft", async function (assert) {
      const channel = { id: 1 };
      const manager = this.container.lookup(
        "service:chat-channel-draft-manager"
      );
      const draft = ChatChannelDraft.create({ bar: "foo" });
      await manager.sync(channel, draft);

      assert.equal(manager.drafts.size, 0);
    });

    test(".sync - null draft", async function (assert) {
      const channel = { id: 1 };
      const manager = this.container.lookup(
        "service:chat-channel-draft-manager"
      );
      await manager.sync(channel, null);

      assert.equal(manager.drafts.size, 0);
    });

    test(".sync - nullify existing draft", async function (assert) {
      const channel = { id: 1 };
      const manager = this.container.lookup(
        "service:chat-channel-draft-manager"
      );
      const draft = ChatChannelDraft.create({ value: "foo" });
      await manager.sync(channel, draft);

      assert.equal(manager.drafts.size, 1);

      await manager.sync(channel, null);

      assert.equal(manager.drafts.size, 0);
    });
  }
);
