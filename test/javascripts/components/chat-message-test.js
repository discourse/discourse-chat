import { setupRenderingTest } from "discourse/tests/helpers/component-test";
import User from "discourse/models/user";
import { render } from "@ember/test-helpers";
import ChatMessage from "discourse/plugins/discourse-chat/discourse/models/chat-message";
import {
  discourseModule,
  exists,
  query,
} from "discourse/tests/helpers/qunit-helpers";
import hbs from "htmlbars-inline-precompile";
import ChatChannel from "discourse/plugins/discourse-chat/discourse/models/chat-channel";
import I18n from "I18n";
import { test } from "qunit";

discourseModule("Discourse Chat | Component | chat-message", function (hooks) {
  setupRenderingTest(hooks);

  function generateMessageProps(messageData = {}) {
    const chatChannel = ChatChannel.create({
      chatable: { id: 1 },
      chatable_type: "Category",
      id: 9,
      title: "Site",
      unread_count: 0,
      muted: false,
    });
    return {
      message: ChatMessage.create(
        Object.assign(
          {
            id: 178,
            message: "from deleted user",
            cooked: "<p>from deleted user</p>",
            excerpt: "<p>from deleted user</p>",
            created_at: "2021-07-22T08:14:16.950Z",
            flag_count: 0,
            user: User.create({ username: "someguy", id: 1424 }),
            edited: false,
          },
          messageData
        )
      ),
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
      onHoverMessage: () => {},
    };
  }

  const template = hbs`{{chat-message
      message=message
      canInteractWithChat=canInteractWithChat
      details=this.details
      chatChannel=chatChannel
      setReplyTo=setReplyTo
      replyMessageClicked=replyMessageClicked
      editButtonClicked=editButtonClicked
      selectingMessages=selectingMessages
      onStartSelectingMessages=onStartSelectingMessages
      onSelectMessage=onSelectMessage
      bulkSelectMessages=bulkSelectMessages
      fullPage=fullPage
      onHoverMessage=onHoverMessage
      afterReactionAdded=reStickScrollIfNeeded
    }}`;

  test("Message with deleted user", async function (assert) {
    this.setProperties(generateMessageProps({ user: null }));
    await render(template);
    assert.equal(
      query(".chat-message-info__username__name").innerText.trim(),
      I18n.t("chat.user_deleted"),
      "shows the user_deleted text for the username"
    );
    assert.ok(
      exists(".chat-message .chat-emoji-avatar .emoji[title='wastebasket']"),
      "shows the wastebasket avatar"
    );
  });

  test("Message with edits", async function (assert) {
    this.setProperties(generateMessageProps({ edited: true }));
    await render(template);
    assert.ok(
      exists(".chat-message-edited"),
      "has the correct edited css class"
    );
  });

  test("Deleted message", async function (assert) {
    this.setProperties(generateMessageProps({ deleted_at: moment() }));
    await render(template);
    assert.ok(
      exists(".chat-message-deleted .chat-message-expand"),
      "has the correct deleted css class and expand button within"
    );
  });

  test("Hidden message", async function (assert) {
    this.setProperties(generateMessageProps({ hidden: true }));
    await render(template);
    assert.ok(
      exists(".chat-message-hidden .chat-message-expand"),
      "has the correct hidden css class and expand button within"
    );
  });
});
