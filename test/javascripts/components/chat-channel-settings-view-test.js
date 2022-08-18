import componentTest, {
  setupRenderingTest,
} from "discourse/tests/helpers/component-test";
import { exists } from "discourse/tests/helpers/qunit-helpers";
import hbs from "htmlbars-inline-precompile";
import fabricators from "../helpers/fabricators";
import selectKit from "discourse/tests/helpers/select-kit-helper";
import pretender from "discourse/tests/helpers/create-pretender";
import { CHATABLE_TYPES } from "discourse/plugins/discourse-chat/discourse/models/chat-channel";
import { set } from "@ember/object";
import { module } from "qunit";

function membershipFixture(id, options = {}) {
  options = Object.assign({}, options, { muted: false, following: true });

  return {
    following: options.following,
    muted: options.muted,
    desktop_notification_level: "mention",
    mobile_notification_level: "mention",
    chat_channel_id: id,
    chatable_type: "Category",
    user_count: 2,
  };
}

module(
  "Discourse Chat | Component | chat-channel-settings-view | Public channel - regular user",
  function (hooks) {
    setupRenderingTest(hooks);

    componentTest("saving desktop notifications", {
      template: hbs`{{chat-channel-settings-view channel=channel}}`,

      beforeEach() {
        this.set("channel", fabricators.chatChannel());
      },

      async test(assert) {
        pretender.put(
          `/chat/api/chat_channels/${this.channel.id}/notifications_settings.json`,
          () => {
            return [
              200,
              { "Content-Type": "application/json" },
              membershipFixture(this.channel.id),
            ];
          }
        );

        const sk = selectKit(
          ".channel-settings-view__desktop-notification-level-selector"
        );
        await sk.expand();
        await sk.selectRowByValue("mention");

        assert.equal(sk.header().value(), "mention");
      },
    });

    componentTest("saving mobile notifications", {
      template: hbs`{{chat-channel-settings-view channel=channel}}`,

      beforeEach() {
        this.set("channel", fabricators.chatChannel());
      },

      async test(assert) {
        pretender.put(
          `/chat/api/chat_channels/${this.channel.id}/notifications_settings.json`,
          () => {
            return [
              200,
              { "Content-Type": "application/json" },
              membershipFixture(this.channel.id),
            ];
          }
        );

        const sk = selectKit(
          ".channel-settings-view__mobile-notification-level-selector"
        );
        await sk.expand();
        await sk.selectRowByValue("mention");

        assert.equal(sk.header().value(), "mention");
      },
    });

    componentTest("muted", {
      template: hbs`{{chat-channel-settings-view channel=channel}}`,

      beforeEach() {
        this.set("channel", fabricators.chatChannel());
      },

      async test(assert) {
        pretender.put(
          `/chat/api/chat_channels/${this.channel.id}/notifications_settings.json`,
          () => {
            return [
              200,
              { "Content-Type": "application/json" },
              membershipFixture(this.channel.id, { muted: true }),
            ];
          }
        );

        const sk = selectKit(".channel-settings-view__muted-selector");
        await sk.expand();
        await sk.selectRowByName("Off");

        assert.equal(sk.header().value(), "false");
      },
    });
  }
);

module(
  "Discourse Chat | Component | chat-channel-settings-view | Direct Message channel - regular user",
  function (hooks) {
    setupRenderingTest(hooks);

    componentTest("saving desktop notifications", {
      template: hbs`{{chat-channel-settings-view channel=channel}}`,

      beforeEach() {
        this.set(
          "channel",
          fabricators.chatChannel({
            chatable_type: CHATABLE_TYPES.directMessageChannel,
          })
        );
      },

      async test(assert) {
        pretender.put(
          `/chat/api/chat_channels/${this.channel.id}/notifications_settings.json`,
          () => {
            return [
              200,
              { "Content-Type": "application/json" },
              membershipFixture(this.channel.id),
            ];
          }
        );

        const sk = selectKit(
          ".channel-settings-view__desktop-notification-level-selector"
        );
        await sk.expand();
        await sk.selectRowByValue("mention");

        assert.equal(sk.header().value(), "mention");
      },
    });

    componentTest("saving mobile notifications", {
      template: hbs`{{chat-channel-settings-view channel=channel}}`,

      beforeEach() {
        this.set(
          "channel",
          fabricators.chatChannel({
            chatable_type: CHATABLE_TYPES.directMessageChannel,
          })
        );
      },
      async test(assert) {
        pretender.put(
          `/chat/api/chat_channels/${this.channel.id}/notifications_settings.json`,
          () => {
            return [
              200,
              { "Content-Type": "application/json" },
              membershipFixture(this.channel.id),
            ];
          }
        );

        const sk = selectKit(
          ".channel-settings-view__mobile-notification-level-selector"
        );
        await sk.expand();
        await sk.selectRowByValue("mention");

        assert.equal(sk.header().value(), "mention");
      },
    });

    componentTest("muted", {
      template: hbs`{{chat-channel-settings-view channel=channel}}`,

      beforeEach() {
        this.set(
          "channel",
          fabricators.chatChannel({
            chatable_type: CHATABLE_TYPES.directMessageChannel,
          })
        );
      },

      async test(assert) {
        pretender.put(
          `/chat/api/chat_channels/${this.channel.id}/notifications_settings.json`,
          () => {
            return [
              200,
              { "Content-Type": "application/json" },
              membershipFixture(this.channel.id, { muted: true }),
            ];
          }
        );

        const sk = selectKit(".channel-settings-view__muted-selector");
        await sk.expand();
        await sk.selectRowByName("Off");

        assert.equal(sk.header().value(), "false");
      },
    });
  }
);

module(
  "Discourse Chat | Component | chat-channel-settings-view | Public channel - admin user",
  function (hooks) {
    setupRenderingTest(hooks);

    componentTest("admin actions", {
      template: hbs`{{chat-channel-settings-view channel=channel}}`,

      beforeEach() {
        set(this.currentUser, "admin", true);
        set(this.currentUser, "has_chat_enabled", true);
        this.siteSettings.chat_enabled = true;

        this.set("channel", fabricators.chatChannel());
      },

      async test(assert) {
        assert.ok(exists(".close-btn"));
        assert.ok(exists(".delete-btn"));
      },
    });
  }
);

module(
  "Discourse Chat | Component | chat-channel-settings-view | Archived Public channel - admin user",
  function (hooks) {
    setupRenderingTest(hooks);

    componentTest("archive action", {
      template: hbs`{{chat-channel-settings-view channel=channel}}`,

      beforeEach() {
        set(this.currentUser, "admin", true);
        set(this.currentUser, "has_chat_enabled", true);
        this.siteSettings.chat_enabled = true;
        this.siteSettings.chat_allow_archiving_channels = true;
        this.set("channel", fabricators.chatChannel());
      },

      async test(assert) {
        assert.ok(exists(".archive-btn"));
      },
    });
  }
);
