import ChatChannelDraft from "discourse/plugins/discourse-chat/discourse/models/chat-channel-draft";
import { module, test } from "qunit";

module("Discourse Chat | Unit | Model | chat-channel-draft", function () {
  test(".isValid - has value", function (assert) {
    const draft = ChatChannelDraft.create({ value: "test" });
    assert.ok(draft.isValid);
  });

  test(".isValid - has uploads", function (assert) {
    const draft = ChatChannelDraft.create({ uploads: [{ fileId: 1 }] });
    assert.ok(draft.isValid);
  });

  test(".isValid - has replyToMsg", function (assert) {
    const draft = ChatChannelDraft.create({ replyToMsg: { id: 1 } });
    assert.ok(draft.isValid);
  });

  test(".isValid - has no params", function (assert) {
    const draft = ChatChannelDraft.create({});
    assert.notOk(draft.isValid);
  });
});
