# frozen_string_literal: true

require "rails_helper"

describe ChatMessage do
  fab!(:message) { Fabricate(:chat_message, message: "hey friend, what's up?!") }
  describe ".cook" do
    it "does not support HTML tags" do
      cooked = ChatMessage.cook("<h1>test</h1>")

      expect(cooked).to eq("<p>&lt;h1&gt;test&lt;/h1&gt;</p>")
    end

    it "does not support headings" do
      cooked = ChatMessage.cook("## heading 2")

      expect(cooked).to eq("<p>## heading 2</p>")
    end

    it "does not support horizontal rules" do
      cooked = ChatMessage.cook("---")

      expect(cooked).to eq("<p>---</p>")
    end

    it "supports backticks rule" do
      cooked = ChatMessage.cook("`test`")

      expect(cooked).to eq("<p><code>test</code></p>")
    end

    it "supports fence rule" do
      cooked = ChatMessage.cook(<<~RAW)
      ```
      something = test
      ```
      RAW

      expect(cooked).to eq(<<~COOKED.chomp)
      <pre><code class="lang-auto">something = test
      </code></pre>
      COOKED
    end

    it "supports fence rule with language support" do
      cooked = ChatMessage.cook(<<~RAW)
      ```ruby
      Widget.triangulate(argument: "no u")
      ```
      RAW

      expect(cooked).to eq(<<~COOKED.chomp)
      <pre><code class="lang-ruby">Widget.triangulate(argument: "no u")
      </code></pre>
      COOKED
    end

    it "supports code rule" do
      cooked = ChatMessage.cook("    something = test")

      expect(cooked).to eq("<pre><code>something = test\n</code></pre>")
    end

    it "supports blockquote rule" do
      cooked = ChatMessage.cook("> a quote")

      expect(cooked).to eq("<blockquote>\n<p>a quote</p>\n</blockquote>")
    end

    it "supports quote bbcode" do
      topic = Fabricate(:topic, title: "Some quotable topic")
      post = Fabricate(:post, topic: topic)
      SiteSetting.external_system_avatars_enabled = false
      avatar_src =
        "//test.localhost#{User.system_avatar_template(post.user.username).gsub("{size}", "40")}"

      cooked = ChatMessage.cook(<<~RAW)
      [quote="#{post.user.username}, post:#{post.post_number}, topic:#{topic.id}"]
      Mark me...this will go down in history.
      [/quote]
      RAW

      expect(cooked).to eq(<<~COOKED.chomp)
      <aside class="quote no-group" data-username="#{post.user.username}" data-post="#{post.post_number}" data-topic="#{topic.id}">
      <div class="title">
      <div class="quote-controls"></div>
      <img loading="lazy" alt="" width="20" height="20" src="#{avatar_src}" class="avatar"><a href="http://test.localhost/t/some-quotable-topic/#{topic.id}/#{post.post_number}">#{topic.title}</a>
      </div>
      <blockquote>
      <p>Mark me...this will go down in history.</p>
      </blockquote>
      </aside>
      COOKED
    end

    it "supports chat quote bbcode" do
      chat_channel = Fabricate(:chat_channel, name: "testchannel")
      user = Fabricate(:user, username: "chatbbcodeuser")
      user2 = Fabricate(:user, username: "otherbbcodeuser")
      avatar_src =
        "//test.localhost#{User.system_avatar_template(user.username).gsub("{size}", "40")}"
      avatar_src2 =
        "//test.localhost#{User.system_avatar_template(user2.username).gsub("{size}", "40")}"
      msg1 =
        Fabricate(
          :chat_message,
          chat_channel: chat_channel,
          message: "this is the first message",
          user: user,
        )
      msg2 =
        Fabricate(
          :chat_message,
          chat_channel: chat_channel,
          message: "and another cool one",
          user: user2,
        )
      other_messages_to_quote = [msg1, msg2]
      cooked =
        ChatMessage.cook(
          ChatTranscriptService.new(
            chat_channel,
            Fabricate(:user),
            messages_or_ids: other_messages_to_quote.map(&:id),
          ).generate_markdown,
        )

      expect(cooked).to eq(<<~COOKED.chomp)
        <div class="discourse-chat-transcript chat-transcript-chained" data-message-id="#{msg1.id}" data-username="chatbbcodeuser" data-datetime="#{msg1.created_at.iso8601}" data-channel-name="testchannel" data-channel-id="#{chat_channel.id}">
        <div class="chat-transcript-meta">
        Originally sent in <a href="/chat/channel/#{chat_channel.id}/-">testchannel</a>
        </div>
        <div class="chat-transcript-user">
        <div class="chat-transcript-user-avatar">
        <img loading="lazy" alt="" width="20" height="20" src="#{avatar_src}" class="avatar">
        </div>
        <div class="chat-transcript-username">
        chatbbcodeuser</div>
        <div class="chat-transcript-datetime">
        <a href="/chat/message/#{msg1.id}" title="#{msg1.created_at.iso8601}"></a>
        </div>
        </div>
        <div class="chat-transcript-messages">
        <p>this is the first message</p>
        </div>
        </div>
        <div class="discourse-chat-transcript chat-transcript-chained" data-message-id="#{msg2.id}" data-username="otherbbcodeuser" data-datetime="#{msg2.created_at.iso8601}">
        <div class="chat-transcript-user">
        <div class="chat-transcript-user-avatar">
        <img loading="lazy" alt="" width="20" height="20" src="#{avatar_src2}" class="avatar">
        </div>
        <div class="chat-transcript-username">
        otherbbcodeuser</div>
        <div class="chat-transcript-datetime">
        <a href="/chat/message/#{msg2.id}" title="#{msg2.created_at.iso8601}"></a>
        </div>
        </div>
        <div class="chat-transcript-messages">
        <p>and another cool one</p>
        </div>
        </div>
      COOKED
    end

    it "supports strikethrough rule" do
      cooked = ChatMessage.cook("~~test~~")

      expect(cooked).to eq("<p><s>test</s></p>")
    end

    it "supports emphasis rule" do
      cooked = ChatMessage.cook("**bold**")

      expect(cooked).to eq("<p><strong>bold</strong></p>")
    end

    it "supports link markdown rule" do
      chat_message = Fabricate(:chat_message, message: "[test link](https://www.example.com)")

      expect(chat_message.cooked).to eq(
        "<p><a href=\"https://www.example.com\" rel=\"noopener nofollow ugc\">test link</a></p>",
      )
    end

    it "supports table markdown plugin" do
      cooked = ChatMessage.cook(<<~RAW)
      | Command | Description |
      | --- | --- |
      | git status | List all new or modified files |
      RAW

      expected = <<~COOKED
      <div class="md-table">
      <table>
      <thead>
      <tr>
      <th>Command</th>
      <th>Description</th>
      </tr>
      </thead>
      <tbody>
      <tr>
      <td>git status</td>
      <td>List all new or modified files</td>
      </tr>
      </tbody>
      </table>
      </div>
      COOKED

      expect(cooked).to eq(expected.chomp)
    end

    it "supports onebox markdown plugin" do
      cooked = ChatMessage.cook("https://www.example.com")

      expect(cooked).to eq(
        "<p><a href=\"https://www.example.com\" class=\"onebox\" target=\"_blank\" rel=\"noopener nofollow ugc\">https://www.example.com</a></p>",
      )
    end

    # it "supports emoji plugin" do
    #   cooked = ChatMessage.cook(":grin:")

    #   expect(cooked).to eq(
    #     "<p><img src=\"/images/emoji/twitter/grin.png?v=12\" title=\":grin:\" class=\"emoji only-emoji\" alt=\":grin:\" loading=\"lazy\" width=\"20\" height=\"20\"></p>",
    #   )
    # end

    it "supports mentions plugin" do
      cooked = ChatMessage.cook("@mention")

      expect(cooked).to eq("<p><span class=\"mention\">@mention</span></p>")
    end

    it "supports category-hashtag plugin" do
      category = Fabricate(:category)

      cooked = ChatMessage.cook("##{category.slug}")

      expect(cooked).to eq(
        "<p><a class=\"hashtag\" href=\"#{category.url}\">#<span>#{category.slug}</span></a></p>",
      )
    end

    it "supports censored plugin" do
      watched_word = Fabricate(:watched_word, action: WatchedWord.actions[:censor])

      cooked = ChatMessage.cook(watched_word.word)

      expect(cooked).to eq("<p>■■■■■</p>")
    end

    it "includes links in pretty text excerpt if the raw message is a single link and the PrettyText excerpt is blank" do
      message =
        Fabricate.build(
          :chat_message,
          message: "https://twitter.com/EffinBirds/status/1518743508378697729",
        )
      expect(message.excerpt).to eq("https://twitter.com/EffinBirds/status/1518743508378697729")
      message =
        Fabricate.build(
          :chat_message,
          message: "https://twitter.com/EffinBirds/status/1518743508378697729",
          cooked: <<~COOKED,
          <aside class=\"onebox twitterstatus\" data-onebox-src=\"https://twitter.com/EffinBirds/status/1518743508378697729\">\n  <header class=\"source\">\n\n      <a href=\"https://twitter.com/EffinBirds/status/1518743508378697729\" target=\"_blank\" rel=\"nofollow ugc noopener\">twitter.com</a>\n  </header>\n\n  <article class=\"onebox-body\">\n    \n<h4><a href=\"https://twitter.com/EffinBirds/status/1518743508378697729\" target=\"_blank\" rel=\"nofollow ugc noopener\">Effin' Birds</a></h4>\n<div class=\"twitter-screen-name\"><a href=\"https://twitter.com/EffinBirds/status/1518743508378697729\" target=\"_blank\" rel=\"nofollow ugc noopener\">@EffinBirds</a></div>\n\n<div class=\"tweet\">\n  <span class=\"tweet-description\">https://t.co/LjlqMm9lck</span>\n</div>\n\n<div class=\"date\">\n  <a href=\"https://twitter.com/EffinBirds/status/1518743508378697729\" class=\"timestamp\" target=\"_blank\" rel=\"nofollow ugc noopener\">5:07 PM - 25 Apr 2022</a>\n\n    <span class=\"like\">\n      <svg viewbox=\"0 0 512 512\" width=\"14px\" height=\"16px\" aria-hidden=\"true\">\n        <path d=\"M462.3 62.6C407.5 15.9 326 24.3 275.7 76.2L256 96.5l-19.7-20.3C186.1 24.3 104.5 15.9 49.7 62.6c-62.8 53.6-66.1 149.8-9.9 207.9l193.5 199.8c12.5 12.9 32.8 12.9 45.3 0l193.5-199.8c56.3-58.1 53-154.3-9.8-207.9z\"></path>\n      </svg>\n      2.5K\n    </span>\n\n    <span class=\"retweet\">\n      <svg viewbox=\"0 0 640 512\" width=\"14px\" height=\"16px\" aria-hidden=\"true\">\n        <path d=\"M629.657 343.598L528.971 444.284c-9.373 9.372-24.568 9.372-33.941 0L394.343 343.598c-9.373-9.373-9.373-24.569 0-33.941l10.823-10.823c9.562-9.562 25.133-9.34 34.419.492L480 342.118V160H292.451a24.005 24.005 0 0 1-16.971-7.029l-16-16C244.361 121.851 255.069 96 276.451 96H520c13.255 0 24 10.745 24 24v222.118l40.416-42.792c9.285-9.831 24.856-10.054 34.419-.492l10.823 10.823c9.372 9.372 9.372 24.569-.001 33.941zm-265.138 15.431A23.999 23.999 0 0 0 347.548 352H160V169.881l40.416 42.792c9.286 9.831 24.856 10.054 34.419.491l10.822-10.822c9.373-9.373 9.373-24.569 0-33.941L144.971 67.716c-9.373-9.373-24.569-9.373-33.941 0L10.343 168.402c-9.373 9.373-9.373 24.569 0 33.941l10.822 10.822c9.562 9.562 25.133 9.34 34.419-.491L96 169.881V392c0 13.255 10.745 24 24 24h243.549c21.382 0 32.09-25.851 16.971-40.971l-16.001-16z\"></path>\n      </svg>\n      499\n    </span>\n</div>\n\n  </article>\n\n  <div class=\"onebox-metadata\">\n    \n    \n  </div>\n\n  <div style=\"clear: both\"></div>\n</aside>\n
        COOKED
        )
      expect(message.excerpt).to eq("https://twitter.com/EffinBirds/status/1518743508378697729")
      message =
        Fabricate.build(
          :chat_message,
          message:
            "wow check out these birbs https://twitter.com/EffinBirds/status/1518743508378697729",
        )
      expect(message.excerpt).to eq(
        "wow check out these birbs <a href=\"https://twitter.com/EffinBirds/status/1518743508378697729\" class=\"inline-onebox-loading\" rel=\"noopener nofollow ugc\">https://twitter.com/Effi&hellip;</a>",
      )
    end

    it "returns an empty string if PrettyText.excerpt returns empty string" do
      message = Fabricate(:chat_message, message: <<~MSG)
      [quote="martin, post:30, topic:3179, full:true"]
      This is a real **quote** topic with some *markdown* in it I can quote.
      [/quote]
      MSG
      expect(message.excerpt).to eq("")
    end

    it "excerpts upload file name if message is empty" do
      gif =
        Fabricate(:upload, original_filename: "cat.gif", width: 400, height: 300, extension: "gif")
      message = Fabricate(:chat_message, message: "")
      ChatUpload.create(chat_message: message, upload: gif)

      expect(message.excerpt).to eq "cat.gif"
    end

    it "supports autolink with <>" do
      cooked = ChatMessage.cook("<https://github.com/discourse/discourse-chat/pull/468>")

      expect(cooked).to eq(
        "<p><a href=\"https://github.com/discourse/discourse-chat/pull/468\" rel=\"noopener nofollow ugc\">https://github.com/discourse/discourse-chat/pull/468</a></p>",
      )
    end

    it "supports lists" do
      cooked = ChatMessage.cook(<<~MSG)
      wow look it's a list

      * item 1
      * item 2
      MSG

      expect(cooked).to eq(<<~HTML.chomp)
      <p>wow look it's a list</p>
      <ul>
      <li>item 1</li>
      <li>item 2</li>
      </ul>
      HTML
    end

    # it "supports inline emoji" do
    #   cooked = ChatMessage.cook(":D")
    #   expect(cooked).to eq(<<~HTML.chomp)
    #   <p><img src="/images/emoji/twitter/smiley.png?v=12" title=":smiley:" class="emoji only-emoji" alt=":smiley:" loading=\"lazy\" width=\"20\" height=\"20\"></p>
    #   HTML
    # end


    it "supports spoilers" do
      if SiteSetting.respond_to?(:spoiler_enabled) && SiteSetting.spoiler_enabled
        cooked = ChatMessage.cook("[spoiler]the planet of the apes was earth all along[/spoiler]")

        expect(cooked).to eq(
          "<div class=\"spoiler\">\n<p>the planet of the apes was earth all along</p>\n</div>",
        )
      end
    end

    context "unicode usernames are enabled" do
      before { SiteSetting.unicode_usernames = true }

      it "cooks unicode mentions" do
        user = Fabricate(:unicode_user)
        cooked = ChatMessage.cook("<h1>@#{user.username}</h1>")

        expect(cooked).to eq("<p>&lt;h1&gt;@#{user.username}&lt;/h1&gt;</p>")
      end
    end
  end

  describe ".to_markdown" do
    it "renders the message without uploads" do
      expect(message.to_markdown).to eq("hey friend, what's up?!")
    end

    it "renders the message with uploads" do
      image =
        Fabricate(
          :upload,
          original_filename: "test_image.jpg",
          width: 400,
          height: 300,
          extension: "jpg",
        )
      image2 =
        Fabricate(:upload, original_filename: "meme.jpg", width: 10, height: 10, extension: "jpg")
      ChatUpload.create(chat_message: message, upload: image)
      ChatUpload.create(chat_message: message, upload: image2)
      expect(message.to_markdown).to eq(<<~MSG.chomp)
      hey friend, what's up?!

      ![test_image.jpg|400x300](#{image.short_url})
      ![meme.jpg|10x10](#{image2.short_url})
      MSG
    end
  end

  describe ".push_notification_excerpt" do
    it "truncates to 400 characters" do
      message = ChatMessage.new(message: "Hello, World!" * 40)
      expect(message.push_notification_excerpt.size).to eq(400)
    end

    it "encodes emojis" do
      message = ChatMessage.new(message: ":grinning:")
      expect(message.push_notification_excerpt).to eq("😀")
    end
  end

  describe "blocking duplicate messages" do
    fab!(:channel) { Fabricate(:chat_channel, user_count: 10) }
    fab!(:user1) { Fabricate(:user) }
    fab!(:user2) { Fabricate(:user) }

    before { SiteSetting.chat_duplicate_message_sensitivity = 1 }

    it "blocks duplicate messages for the message, channel user, and message age requirements" do
      Fabricate(:chat_message, message: "this is duplicate", chat_channel: channel, user: user1)
      message = ChatMessage.new(message: "this is duplicate", chat_channel: channel, user: user2)
      message.validate_message(has_uploads: false)
      expect(message.errors.full_messages).to include(I18n.t("chat.errors.duplicate_message"))
    end
  end

  describe "#destroy" do
    it "nullify messages with in_reply_to_id to this destroyed message" do
      message_1 = Fabricate(:chat_message)
      message_2 = Fabricate(:chat_message, in_reply_to_id: message_1.id)
      message_3 = Fabricate(:chat_message, in_reply_to_id: message_2.id)

      expect(message_2.in_reply_to_id).to eq(message_1.id)

      message_1.destroy!

      expect(message_2.reload.in_reply_to_id).to be_nil
      expect(message_3.reload.in_reply_to_id).to eq(message_2.id)
    end

    it "destroys chat_message_revisions" do
      message_1 = Fabricate(:chat_message)
      revision_1 = Fabricate(:chat_message_revision, chat_message: message_1)

      message_1.destroy!

      expect { revision_1.reload }.to raise_error(ActiveRecord::RecordNotFound)
    end

    it "destroys chat_message_reactions" do
      message_1 = Fabricate(:chat_message)
      reaction_1 = Fabricate(:chat_message_reaction, chat_message: message_1)

      message_1.destroy!

      expect { reaction_1.reload }.to raise_error(ActiveRecord::RecordNotFound)
    end

    it "destroys chat_mention" do
      message_1 = Fabricate(:chat_message)
      mention_1 = Fabricate(:chat_mention, chat_message: message_1)

      message_1.destroy!

      expect { mention_1.reload }.to raise_error(ActiveRecord::RecordNotFound)
    end

    it "destroys chat_webhook_event" do
      message_1 = Fabricate(:chat_message)
      webhook_1 = Fabricate(:chat_webhook_event, chat_message: message_1)

      message_1.destroy!

      expect { webhook_1.reload }.to raise_error(ActiveRecord::RecordNotFound)
    end

    it "destroys chat_uploads" do
      message_1 = Fabricate(:chat_message)
      chat_upload_1 = Fabricate(:chat_upload, chat_message: message_1)

      message_1.destroy!

      expect { chat_upload_1.reload }.to raise_error(ActiveRecord::RecordNotFound)
    end

    context "bookmarks" do
      before { Bookmark.register_bookmarkable(ChatMessageBookmarkable) }

      it "destroys bookmarks" do
        message_1 = Fabricate(:chat_message)
        bookmark_1 = Fabricate(:bookmark, bookmarkable: message_1)

        message_1.destroy!

        expect { bookmark_1.reload }.to raise_error(ActiveRecord::RecordNotFound)
      end
    end
  end
end
