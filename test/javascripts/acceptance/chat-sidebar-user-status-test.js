import {
  acceptance,
  exists,
  publishToMessageBus,
  query,
} from "discourse/tests/helpers/qunit-helpers";
import { test } from "qunit";
import { visit } from "@ember/test-helpers";

acceptance("Discourse Chat - Sidebar - User Status", function (needs) {
  const directMessageUserId = 1;
  const status = { description: "off to dentist", emoji: "tooth" };

  needs.user({ has_chat_enabled: true });

  needs.settings({
    chat_enabled: true,
    enable_experimental_sidebar_hamburger: true,
    enable_sidebar: true,
  });

  needs.pretender((server, helper) => {
    const directMessageChannel = {
      chatable: {
        users: [
          {
            id: directMessageUserId,
            username: "user1",
            avatar_template:
              "/letter_avatar_proxy/v4/letter/t/f9ae1b/{size}.png",
            status,
          },
        ],
      },
      chatable_type: "DirectMessageChannel",
      title: "@user1",
    };

    server.get("/chat/chat_channels.json", () => {
      return helper.response({
        public_channels: [],
        direct_message_channels: [directMessageChannel],
      });
    });
  });

  test("Shows user status", async function (assert) {
    await visit("/");

    const statusEmoji = query(
      ".sidebar-sections .sidebar-section-link-content-text .emoji"
    );
    assert.ok(statusEmoji, "status is shown");
    assert.ok(
      statusEmoji.src.includes(status.emoji),
      "status emoji is correct"
    );
    assert.equal(
      statusEmoji.title,
      status.description,
      "status description is correct"
    );
  });

  test("Status gets updated after receiving a message bus update", async function (assert) {
    await visit("/");

    let statusEmoji = query(
      ".sidebar-sections .sidebar-section-link-content-text .emoji"
    );
    assert.ok(statusEmoji, "old status is shown");
    assert.ok(
      statusEmoji.src.includes(status.emoji),
      "old status emoji is correct"
    );
    assert.equal(
      statusEmoji.title,
      status.description,
      "old status description is correct"
    );

    const newStatus = { description: "surfing", emoji: "surfer" };
    await publishToMessageBus(`/user-status`, {
      [directMessageUserId]: newStatus,
    });

    statusEmoji = query(
      ".sidebar-sections .sidebar-section-link-content-text .emoji"
    );
    assert.ok(statusEmoji, "new status is shown");
    assert.ok(
      statusEmoji.src.includes(newStatus.emoji),
      "new status emoji is correct"
    );
    assert.equal(
      statusEmoji.title,
      newStatus.description,
      "new status description is correct"
    );
  });

  test("Status disappears after receiving a message bus update", async function (assert) {
    await visit("/");

    let statusEmoji = query(
      ".sidebar-sections .sidebar-section-link-content-text .emoji"
    );
    assert.ok(statusEmoji, "old status is shown");

    await publishToMessageBus(`/user-status`, { [directMessageUserId]: null });

    assert.notOk(
      exists(".sidebar-sections .sidebar-section-link-content-text .emoji"),
      "status has disappeared"
    );
  });
});
