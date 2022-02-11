import { test } from "qunit";
import { click, currentURL, visit } from "@ember/test-helpers";
import {
  acceptance,
  exists,
  query,
  visible,
} from "discourse/tests/helpers/qunit-helpers";
import {
  chatChannels,
  chatView,
} from "discourse/plugins/discourse-chat/chat-fixtures";
import selectKit from "discourse/tests/helpers/select-kit-helper";

let quoteResponse = {
  bbcode: `[chat quote="martinchat;3875498;2022-02-04T01:12:15Z" channel="The Beam Discussions"]
  an extremely insightful response :)
  [/chat]`,
};

function setupPretenders(server, helper) {
  server.get("/chat/chat_channels.json", () => helper.response(chatChannels));
  server.post(`/chat/9/quote.json`, () => helper.response(quoteResponse));
  server.post(`/chat/4/quote.json`, () => helper.response(quoteResponse));
  server.post(`/chat/7/quote.json`, () => helper.response(quoteResponse));
  server.get("/chat/:chatChannelId/messages.json", () =>
    helper.response(chatView)
  );
  server.post("/uploads/lookup-urls", () => {
    return helper.response([]);
  });
}

acceptance("Discourse Chat | quoting out of topic", function (needs) {
  needs.user({
    admin: false,
    moderator: false,
    username: "eviltrout",
    id: 1,
    can_chat: true,
    has_chat_enabled: true,
  });

  needs.settings({
    chat_enabled: true,
  });

  needs.pretender((server, helper) => {
    setupPretenders(server, helper);
  });

  test("it opens the composer and appends the quote", async function (assert) {
    await visit("/chat/channel/9/Site");
    const firstMessage = query(".chat-message-container");
    const dropdown = selectKit(".chat-message-container .more-buttons");
    await dropdown.expand();
    await dropdown.selectRowByValue("selectMessage");

    assert.ok(firstMessage.classList.contains("selecting-messages"));
    const quoteBtn = query(".chat-live-pane #chat-quote-btn");
    assert.equal(
      quoteBtn.disabled,
      false,
      "button is enabled as a message is selected"
    );
    await click("#chat-quote-btn");
    assert.ok(exists("#reply-control.composer-action-createTopic"));
    assert.strictEqual(
      query("textarea.d-editor-input").value,
      quoteResponse.bbcode
    );
  });
});

acceptance("Discourse Chat | quote permissions", function (needs) {
  needs.user({
    admin: false,
    moderator: false,
    username: "eviltrout",
    id: 1,
    can_chat: true,
    has_chat_enabled: true,
  });

  needs.settings({
    chat_enabled: true,
  });

  needs.pretender((server, helper) => {
    setupPretenders(server, helper);
  });

  test("it does not show the quote button in direct messages", async function (assert) {
    await visit("/chat/channel/75/@hawk");
    const firstMessage = query(".chat-message-container");
    const dropdown = selectKit(".chat-message-container .more-buttons");
    await dropdown.expand();
    await dropdown.selectRowByValue("selectMessage");
    assert.ok(firstMessage.classList.contains("selecting-messages"));
    assert.ok(exists(".chat-selection-management"));
    assert.notOk(exists(".chat-live-pane #chat-quote-btn"));
  });
});

acceptance("Discourse Chat | quoting when topic open", async function (needs) {
  needs.user({
    admin: false,
    moderator: false,
    username: "eviltrout",
    id: 1,
    can_chat: true,
    has_chat_enabled: true,
  });

  needs.settings({
    chat_enabled: true,
  });

  needs.pretender((server, helper) => {
    setupPretenders(server, helper);
  });

  test("it opens the composer for the topic and pastes in the quote", async function (assert) {
    await visit("/t/internationalization-localization/280");
    await click(".header-dropdown-toggle.open-chat");
    assert.ok(visible(".topic-chat-float-container"), "chat float is open");
    const firstMessage = query(".chat-message-container");
    const dropdown = selectKit(".chat-message-container .more-buttons");
    await dropdown.expand();
    await dropdown.selectRowByValue("selectMessage");
    assert.ok(firstMessage.classList.contains("selecting-messages"));
    await click("#chat-quote-btn");
    assert.ok(exists("#reply-control.composer-action-reply"));
    assert.strictEqual(
      query(".composer-action-title .action-title").innerText,
      "Internationalization / localization"
    );
    assert.strictEqual(
      query("textarea.d-editor-input").value,
      quoteResponse.bbcode
    );
  });
});

acceptance(
  "Discourse Chat | quoting with chat isolated",
  async function (needs) {
    needs.user({
      admin: false,
      moderator: false,
      username: "eviltrout",
      id: 1,
      can_chat: true,
      has_chat_enabled: true,
      chat_isolated: true,
    });

    needs.settings({
      chat_enabled: true,
    });

    needs.pretender((server, helper) => {
      setupPretenders(server, helper);
    });

    test("it copies the quote to the clipboard", async function (assert) {
      await visit("/chat/channel/9/Site");
      const firstMessage = query(".chat-message-container");
      const dropdown = selectKit(".chat-message-container .more-buttons");
      await dropdown.expand();
      await dropdown.selectRowByValue("selectMessage");

      assert.ok(firstMessage.classList.contains("selecting-messages"));
      await click("#chat-quote-btn");
      assert.notOk(
        exists("#reply-control.composer-action-createTopic"),
        "the composer does not open"
      );
      assert.ok(
        exists(".chat-selection-message"),
        "the clipboard copy success message shows"
      );
    });
  }
);

acceptance("Discourse Chat | quoting on mobile", async function (needs) {
  needs.user({
    admin: false,
    moderator: false,
    username: "eviltrout",
    id: 1,
    can_chat: true,
    has_chat_enabled: true,
  });

  needs.settings({
    chat_enabled: true,
  });

  needs.pretender((server, helper) => {
    setupPretenders(server, helper);
  });
  needs.mobileView();

  test("it opens the chatable, opens the composer, and pastes the bbcode in", async function (assert) {
    await visit("/chat/channel/7/Uncategorized");
    const firstMessage = query(".chat-message-container");
    const dropdown = selectKit(".chat-message-container .more-buttons");
    await dropdown.expand();
    await dropdown.selectRowByValue("selectMessage");

    assert.ok(firstMessage.classList.contains("selecting-messages"));
    await click("#chat-quote-btn");
    assert.equal(
      currentURL(),
      "/c/uncategorized/1",
      "navigates to the chatable url"
    );
    assert.ok(
      exists("#reply-control.composer-action-createTopic"),
      "the composer opens"
    );
    assert.strictEqual(
      query("textarea.d-editor-input").value,
      quoteResponse.bbcode,
      "the composer has the bbcode"
    );
    assert.strictEqual(
      selectKit(".category-chooser").header().value(),
      "1",
      "it fills category selector with the right category"
    );
  });
});
