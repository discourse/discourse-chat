import { module, test } from "qunit";
import { setupRenderingTest } from "discourse/tests/helpers/component-test";
import { query } from "discourse/tests/helpers/qunit-helpers";
import { render } from "@ember/test-helpers";
import { deepMerge } from "discourse-common/lib/object";
import { NOTIFICATION_TYPES } from "discourse/tests/fixtures/concerns/notification-types";
import Notification from "discourse/models/notification";
import hbs from "htmlbars-inline-precompile";
import slugifyChannel from "discourse/plugins/discourse-chat/discourse/lib/slugify-channel";

function getNotification(overrides = {}) {
  return Notification.create(
    deepMerge(
      {
        id: 11,
        notification_type: NOTIFICATION_TYPES.chat_invitation,
        read: false,
        data: {
          message: "chat.invitation_notification",
          invited_by_username: "eviltrout",
          chat_channel_id: 9,
          chat_message_id: 2,
          chat_channel_title: "Site",
        },
      },
      overrides
    )
  );
}

module(
  "Discourse Chat | Widget | chat-mention-notification-item",
  function (hooks) {
    setupRenderingTest(hooks);

    test("notification url", async function (assert) {
      this.set("args", getNotification());

      const data = this.args.data;

      await render(
        hbs`<MountWidget @widget="chat-mention-notification-item" @args={{this.args}} />`
      );

      assert.strictEqual(
        query(".chat-invitation a").getAttribute("href"),
        `/chat/channel/${data.chat_channel_id}/${slugifyChannel(
          data.chat_channel_title
        )}?messageId=${data.chat_message_id}`
      );

      await render(
        hbs`<MountWidget @widget="chat-group-mention-notification-item" @args={{this.args}} />`
      );

      assert.strictEqual(
        query(".chat-invitation a").getAttribute("href"),
        `/chat/channel/${data.chat_channel_id}/${slugifyChannel(
          data.chat_channel_title
        )}?messageId=${data.chat_message_id}`
      );
    });
  }
);
