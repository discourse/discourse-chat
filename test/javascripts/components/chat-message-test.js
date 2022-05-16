import componentTest, {
  setupRenderingTest,
} from "discourse/tests/helpers/component-test";
import {
  discourseModule,
  exists,
  query,
} from "discourse/tests/helpers/qunit-helpers";
import hbs from "htmlbars-inline-precompile";
import ChatChannel from "discourse/plugins/discourse-chat/discourse/models/chat-channel";
import EmberObject from "@ember/object";
import I18n from "I18n";

discourseModule("Discourse Chat | Component | chat-message", function (hooks) {
  setupRenderingTest(hooks);

  const template = hbs`{{chat-message
      message=message
      canInteractWithChat=canInteractWithChat
      details=this.details
      chatChannel=chatChannel
      setReplyTo=setReplyTo
      replyMessageClicked=replyMessageClicked
      editButtonClicked=editButtonClicked
      afterExpand=decorateMessages
      selectingMessages=selectingMessages
      onStartSelectingMessages=onStartSelectingMessages
      onSelectMessage=onSelectMessage
      bulkSelectMessages=bulkSelectMessages
      fullPage=fullPage
      afterReactionAdded=reStickScrollIfNeeded
    }}`;

  componentTest("Message with deleted user", {
    template,

    async beforeEach() {
      const chatChannel = ChatChannel.create({
        chatable: { id: 1 },
        chatable_type: "Category",
        id: 9,
        title: "Site",
        unread_count: 0,
        muted: false,
      });

      this.setProperties({
        message: EmberObject.create({
          id: 178,
          message: "from deleted user",
          cooked: "<p>from deleted user</p>",
          excerpt: "<p>from deleted user</p>",
          created_at: "2021-07-22T08:14:16.950Z",
          flag_count: 0,
          user: null,
        }),
        canInteractWithChat: true,
        details: {
          can_delete_self: true,
          can_delete_others: true,
          can_flag: true,
          user_silenced: false,
          can_moderate: true,
        },
        chatChannel,
        setReplyTo: () => {},
        replyMessageClicked: () => {},
        editButtonClicked: () => {},
        afterExpand: () => {},
        selectingMessages: false,
        onStartSelectingMessages: () => {},
        onSelectMessage: () => {},
        bulkSelectMessages: () => {},
        fullPage: false,
        afterReactionAdded: () => {},
      });
    },

    async test(assert) {
      assert.equal(
        query(
          ".chat-message-info__username__name"
        ).innerText.trim(),
        I18n.t("chat.user_deleted")
      );
      assert.ok(
        exists(".chat-message .chat-emoji-avatar .emoji[title='wastebasket']")
      );
    },
  });

  componentTest("Message with edits", {
    template,

    async beforeEach() {
      this.setProperties({
        message: EmberObject.create({
          id: 178,
          message: "tomtom",
          cooked: "tomtom",
          excerpt: "tomtom",
          created_at: "2021-07-22T08:14:16.950Z",
          flag_count: 0,
          user: null,
          edited: true,
        }),
        setReplyTo: () => {},
        replyMessageClicked: () => {},
        editButtonClicked: () => {},
        afterExpand: () => {},
        selectingMessages: false,
        onStartSelectingMessages: () => {},
        onSelectMessage: () => {},
        bulkSelectMessages: () => {},
        fullPage: false,
        afterReactionAdded: () => {},
      });
    },

    async test(assert) {
      assert.ok(exists(".chat-message-edited"));
    },
  });
});
