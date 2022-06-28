import componentTest, {
  setupRenderingTest,
} from "discourse/tests/helpers/component-test";
import {
  discourseModule,
  exists,
  query,
} from "discourse/tests/helpers/qunit-helpers";
import hbs from "htmlbars-inline-precompile";
import fabricate from "../helpers/fabricators";
import I18n from "I18n";
import { Promise } from "rsvp";

discourseModule(
  "Discourse Chat | Component | chat-channel-members-view",
  function (hooks) {
    setupRenderingTest(hooks);

    componentTest("state", {
      template: hbs`{{chat-channel-members-view channel=channel fetchMembersHandler=fetchMembersHandler}}`,

      beforeEach() {
        this.set("fetchMembersHandler", () => {
          return Promise.resolve([{ user: { id: 1, username: "jojo" } }]);
        });
        this.set("channel", fabricate("chat-channel"));
        this.channel.set("memberships_count", 1);
      },

      async test(assert) {
        assert.equal(
          query(".channel-members-view__member-count").innerText,
          I18n.t("chat.channel.memberships_count", { count: 1 })
        );

        assert.ok(
          exists(".channel-members-view__list-item[data-user-card='jojo']")
        );
      },
    });
  }
);
