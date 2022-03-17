import componentTest, {
  setupRenderingTest,
} from "discourse/tests/helpers/component-test";
import { click } from "@ember/test-helpers";
import {
  discourseModule,
  exists,
  query,
} from "discourse/tests/helpers/qunit-helpers";
import hbs from "htmlbars-inline-precompile";
import fabricate from "../helpers/fabricators";
import { CHATABLE_TYPES } from "discourse/plugins/discourse-chat/discourse/models/chat-channel";

discourseModule(
  "Discourse Chat | Component | chat-channel-title",
  function (hooks) {
    setupRenderingTest(hooks);

    componentTest("topic channel", {
      template: hbs`{{chat-channel-title channel=channel}}`,

      beforeEach() {
        this.set("channel", fabricate("chat-channel"));
      },

      async test(assert) {
        assert.equal(query(".topic-chat-name").innerText, this.channel.title);
      },
    });

    componentTest("onClick handler", {
      template: hbs`{{chat-channel-title channel=channel onClick=onClick}}`,

      beforeEach() {
        this.set("foo", 1);
        this.set("channel", fabricate("chat-channel"));
        this.set("onClick", () => this.set("foo", 2));
      },

      async test(assert) {
        assert.equal(this.foo, 1);

        await click(".chat-channel-title");

        assert.equal(this.foo, 2);
      },
    });

    componentTest("category channel", {
      template: hbs`{{chat-channel-title channel=channel}}`,

      beforeEach() {
        this.set(
          "channel",
          fabricate("chat-channel", {
            chatable_type: CHATABLE_TYPES.categoryChannel,
          })
        );
      },

      async test(assert) {
        assert.equal(
          query(".category-chat-badge").getAttribute("style"),
          `color: #${this.channel.chatable.color}`
        );
        assert.equal(
          query(".category-chat-name").innerText,
          this.channel.title
        );
      },
    });

    componentTest("category channel - read restricted", {
      template: hbs`{{chat-channel-title channel=channel}}`,

      beforeEach() {
        this.set(
          "channel",
          fabricate("chat-channel", {
            chatable_type: CHATABLE_TYPES.categoryChannel,
            chatable: { read_restricted: true },
          })
        );
      },

      async test(assert) {
        assert.ok(exists(".d-icon-lock"));
      },
    });

    componentTest("category channel - not read restricted", {
      template: hbs`{{chat-channel-title channel=channel}}`,

      beforeEach() {
        this.set(
          "channel",
          fabricate("chat-channel", {
            chatable_type: CHATABLE_TYPES.categoryChannel,
            chatable: { read_restricted: false },
          })
        );
      },

      async test(assert) {
        assert.notOk(exists(".d-icon-lock"));
      },
    });

    componentTest("tag channel", {
      template: hbs`{{chat-channel-title channel=channel}}`,

      beforeEach() {
        this.set(
          "channel",
          fabricate("chat-channel", {
            chatable_type: CHATABLE_TYPES.tagChannel,
          })
        );
      },

      async test(assert) {
        assert.ok(exists(".d-icon-tag"));

        assert.equal(query(".tag-chat-name").innerText, this.channel.title);
      },
    });

    componentTest("direct message channel - one user", {
      template: hbs`{{chat-channel-title channel=channel}}`,

      beforeEach() {
        this.set(
          "channel",
          fabricate("chat-channel", {
            chatable_type: CHATABLE_TYPES.directMessageChannel,
          })
        );
      },

      async test(assert) {
        const user = this.channel.chatable.users[0];

        assert.ok(
          exists(
            `.chat-user-avatar-container .avatar[title="${user.username}"]`
          )
        );
        assert.equal(
          query(`.dm-usernames .dm-username`).innerText,
          user.username
        );
      },
    });

    componentTest("direct message channel - multiple users", {
      template: hbs`{{chat-channel-title channel=channel}}`,

      beforeEach() {
        const channel = fabricate("chat-channel", {
          chatable_type: CHATABLE_TYPES.directMessageChannel,
        });

        channel.chatable.users.push({
          id: 2,
          username: "joffrey",
          name: null,
          avatar_template:
            "https://avatars.discourse.org/v3/letter/t/31188e/{size}.png",
        });

        this.set("channel", channel);
      },

      async test(assert) {
        const users = this.channel.chatable.users;

        assert.equal(
          parseInt(query(".dm-multi-count").innerText, 10),
          users.length
        );
        assert.equal(
          query(".dm-usernames").innerText,
          users.mapBy("username").join(", ")
        );
      },
    });

    componentTest("unreadIndicator", {
      template: hbs`{{chat-channel-title channel=channel unreadIndicator=unreadIndicator}}`,

      beforeEach() {
        const channel = fabricate("chat-channel", {
          chatable_type: CHATABLE_TYPES.directMessageChannel,
        });

        const state = {};
        state[channel.id] = {
          unread_count: 1,
        };
        this.currentUser.set("chat_channel_tracking_state", state);

        this.set("channel", channel);
      },

      async test(assert) {
        this.set("unreadIndicator", true);

        assert.ok(exists(".chat-channel-unread-indicator"));

        this.set("unreadIndicator", false);

        assert.notOk(exists(".chat-channel-unread-indicator"));
      },
    });
  }
);
