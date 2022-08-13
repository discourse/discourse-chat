import componentTest, {
  setupRenderingTest,
} from "discourse/tests/helpers/component-test";
import { exists } from "discourse/tests/helpers/qunit-helpers";
import hbs from "htmlbars-inline-precompile";
import { click, triggerKeyEvent } from "@ember/test-helpers";
import fabricators from "../helpers/fabricators";
import { module } from "qunit";

module("Discourse Chat | Component | chat-channel-row", function (hooks) {
  setupRenderingTest(hooks);

  componentTest("with leaveButton", {
    template: hbs`{{chat-channel-row channel=channel options=(hash leaveButton=true)}}`,

    beforeEach() {
      this.set(
        "channel",
        fabricators.chatChannel({
          current_user_membership: { following: true },
        })
      );
    },

    async test(assert) {
      assert.ok(exists(".toggle-channel-membership-button.-leave"));
    },
  });

  componentTest("without leaveButton", {
    template: hbs`{{chat-channel-row channel=channel}}`,

    beforeEach() {
      this.set("channel", fabricators.chatChannel());
    },

    async test(assert) {
      assert.notOk(exists(".chat-channel-leave-btn"));
    },
  });

  componentTest("receives click", {
    template: hbs`{{chat-channel-row switchChannel=switchChannel channel=channel}}`,

    beforeEach() {
      this.set("switchedChannel", null);
      this.set("channel", fabricators.chatChannel());
      this.set("switchChannel", (channel) =>
        this.set("switchedChannel", channel.id)
      );
    },

    async test(assert) {
      await click(".chat-channel-row");

      assert.strictEqual(this.switchedChannel, this.channel.id);
    },
  });

  componentTest("receives Enter keyup", {
    template: hbs`{{chat-channel-row switchChannel=switchChannel channel=channel}}`,

    beforeEach() {
      this.set("switchedChannel", null);
      this.set("channel", fabricators.chatChannel());
      this.set("switchChannel", (channel) =>
        this.set("switchedChannel", channel.id)
      );
    },

    async test(assert) {
      await triggerKeyEvent(".chat-channel-row", "keyup", "Enter");

      assert.strictEqual(this.switchedChannel, this.channel.id);
    },
  });

  componentTest(
    "a row is active when the associated channel is active and visible",
    {
      template: hbs`{{chat-channel-row switchChannel=switchChannel channel=channel chat=chat router=router}}`,

      beforeEach() {
        this.set("channel", fabricators.chatChannel());
        this.set("chat", { activeChannel: this.channel });
        this.set("router", { currentRouteName: "chat.channel" });
      },

      async test(assert) {
        assert.ok(exists(".chat-channel-row.active"));

        this.set("router.currentRouteName", "chat.browse");

        assert.notOk(exists(".chat-channel-row.active"));

        this.set("router.currentRouteName", "chat.channel");
        this.set("chat.activeChannel", null);

        assert.notOk(exists(".chat-channel-row.active"));
      },
    }
  );

  componentTest("can receive a tab event", {
    template: hbs`{{chat-channel-row channel=channel}}`,

    beforeEach() {
      this.set("channel", fabricators.chatChannel());
    },

    async test(assert) {
      assert.ok(exists(".chat-channel-row[tabindex=0]"));
    },
  });

  componentTest("shows user status on the direct message channel", {
    template: hbs`{{chat-channel-row channel=channel}}`,

    beforeEach() {
      const status = { description: "Off to dentist", emoji: "tooth" };
      const channel = fabricators.directMessageChatChannel();
      channel.chatable.users[0].status = status;
      this.set("channel", channel);
    },

    async test(assert) {
      assert.ok(exists(".emoji[title='Off to dentist']"));
    },
  });

  componentTest(
    "doesn't show user status on a direct message channel with multiple users",
    {
      template: hbs`{{chat-channel-row channel=channel}}`,

      beforeEach() {
        const status = { description: "Off to dentist", emoji: "tooth" };
        const channel = fabricators.directMessageChatChannel();
        channel.chatable.users[0].status = status;
        channel.chatable.users.push({
          id: 2,
          username: "bill",
          name: null,
          avatar_template: "/letter_avatar_proxy/v3/letter/t/31188e/{size}.png",
        });
        this.set("channel", channel);
      },

      async test(assert) {
        assert.notOk(exists(".emoji[title='Off to dentist']"));
      },
    }
  );
});
