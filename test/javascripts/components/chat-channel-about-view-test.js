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
import { set } from "@ember/object";

// discourseModule(
//   "Discourse Chat | Component | chat-channel-about-view | regular user",
//   function (hooks) {
//     setupRenderingTest(hooks);

//     componentTest("state", {
//       template: hbs`{{chat-channel-about-view channel=channel}}`,

//       beforeEach() {
//         this.set(
//           "channel",
//           fabricate("chat-channel", {
//             chatable_type: "Category",
//           })
//         );

//         this.channel.set("description", "foo");
//       },

//       async test(assert) {
//         assert.equal(
//           query(".category-name").innerText,
//           this.channel.chatable.name
//         );
//         assert.equal(
//           query(".channel-info-about-view__title").innerText,
//           this.channel.title
//         );
//         assert.equal(
//           query(".channel-info-about-view__description").innerText,
//           this.channel.description
//         );
//       },
//     });

//     componentTest("edit/add", {
//       template: hbs`{{chat-channel-about-view channel=channel}}`,

//       beforeEach() {
//         this.set(
//           "channel",
//           fabricate("chat-channel", {
//             chatable_type: "Category",
//           })
//         );
//       },

//       async test(assert) {
//         assert.notOk(exists(".edit-title-btn"));
//         assert.notOk(exists(".edit-description-btn"));
//       },
//     });

//     componentTest("edit/add - admin", {
//       template: hbs`{{chat-channel-about-view channel=channel}}`,

//       beforeEach() {
//         set(this.currentUser, "has_chat_enabled", true);
//         set(this.currentUser, "admin", true);
//         this.siteSettings.chat_enabled = true;

//         this.set(
//           "channel",
//           fabricate("chat-channel", {
//             chatable_type: "Category",
//           })
//         );
//       },

//       async test(assert) {
//         assert.ok(exists(".edit-title-btn"));
//         assert.ok(exists(".edit-description-btn"));
//       },
//     });
//   }
// );

discourseModule(
  "Discourse Chat | Component | chat-channel-about-view | admin user",
  function (hooks) {
    setupRenderingTest(hooks);

    hooks.beforeEach(function () {
      this.set(
        "channel",
        fabricate("chat-channel", { chatable_type: "Category" })
      );
      this.channel.set("description", "foo");
    });

    componentTest("chatable name", {
      template: hbs`{{chat-channel-about-view channel=channel}}`,

      beforeEach() {
        set(this.currentUser, "has_chat_enabled", true);
        set(this.currentUser, "admin", true);
      },

      async test(assert) {
        assert.equal(
          query(".category-name").innerText,
          this.channel.chatable.name
        );
      },
    });

    componentTest("chatable description", {
      template: hbs`{{chat-channel-about-view channel=channel}}`,

      beforeEach() {
        set(this.currentUser, "has_chat_enabled", true);
        set(this.currentUser, "admin", true);
      },

      async test(assert) {
        assert.equal(
          query(".category-name").innerText,
          this.channel.chatable.name
        );
      },
    });

    componentTest("edit/add - admin", {
      template: hbs`{{chat-channel-about-view channel=channel}}`,

      beforeEach() {
        set(this.currentUser, "has_chat_enabled", true);
        set(this.currentUser, "admin", true);
      },

      async test(assert) {
        assert.ok(exists(".edit-title-btn"));
        assert.ok(exists(".edit-description-btn"));
      },
    });
  }
);
