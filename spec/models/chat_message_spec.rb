# frozen_string_literal: true

require 'rails_helper'

describe ChatMessage do
  describe '.cook' do
    it 'does not support HTML tags' do
      cooked = ChatMessage.cook("<h1>test</h1>")

      expect(cooked).to eq("<p>&lt;h1&gt;test&lt;/h1&gt;</p>")
    end

    it 'does not support headings' do
      cooked = ChatMessage.cook("## heading 2")

      expect(cooked).to eq("<p>## heading 2</p>")
    end

    it 'does not support horizontal rules' do
      cooked = ChatMessage.cook("---")

      expect(cooked).to eq("<p>---</p>")
    end

    it 'supports backticks rule' do
      cooked = ChatMessage.cook("`test`")

      expect(cooked).to eq("<p><code>test</code></p>")
    end

    it 'supports fence rule' do
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

    it 'supports fence rule with language support' do
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

    it 'supports code rule' do
      cooked = ChatMessage.cook("    something = test")

      expect(cooked).to eq("<pre><code>something = test</code></pre>")
    end

    it 'supports blockquote rule' do
      cooked = ChatMessage.cook("> a quote")

      expect(cooked).to eq("<blockquote>\n<p>a quote</p>\n</blockquote>")
    end

    it 'supports strikethrough rule' do
      cooked = ChatMessage.cook("~~test~~")

      expect(cooked).to eq("<p><s>test</s></p>")
    end

    it 'supports emphasis rule' do
      cooked = ChatMessage.cook("**bold**")

      expect(cooked).to eq("<p><strong>bold</strong></p>")
    end

    it 'supports link markdown rule' do
      chat_message = Fabricate(:chat_message, message: "[test link](https://www.example.com)")

      expect(chat_message.cooked).to eq("<p><a href=\"https://www.example.com\" rel=\"noopener nofollow ugc\">test link</a></p>")
    end

    it 'supports table markdown plugin' do
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

    it 'supports onebox markdown plugin' do
      cooked = ChatMessage.cook("https://www.example.com")

      expect(cooked).to eq("<p><a href=\"https://www.example.com\" class=\"onebox\" target=\"_blank\" rel=\"noopener nofollow ugc\">https://www.example.com</a></p>")
    end

    it 'supports emoji plugin' do
      cooked = ChatMessage.cook(":grin:")

      expect(cooked).to eq("<p><img src=\"/images/emoji/twitter/grin.png?v=12\" title=\":grin:\" class=\"emoji only-emoji\" alt=\":grin:\" loading=\"lazy\" width=\"20\" height=\"20\"></p>")
    end

    it 'supports mentions plugin' do
      cooked = ChatMessage.cook("@mention")

      expect(cooked).to eq("<p><span class=\"mention\">@mention</span></p>")
    end

    it 'supports category-hashtag plugin' do
      category = Fabricate(:category)

      cooked = ChatMessage.cook("##{category.slug}")

      expect(cooked).to eq("<p><a class=\"hashtag\" href=\"#{category.url}\">#<span>#{category.slug}</span></a></p>")
    end

    it 'supports censored plugin' do
      watched_word = Fabricate(:watched_word, action: WatchedWord.actions[:censor])

      cooked = ChatMessage.cook(watched_word.word)

      expect(cooked).to eq("<p>■■■■■</p>")
    end

    it 'supports autolink with <>' do
      cooked = ChatMessage.cook("<https://github.com/discourse/discourse-chat/pull/468>")

      expect(cooked).to eq("<p><a href=\"https://github.com/discourse/discourse-chat/pull/468\" rel=\"noopener nofollow ugc\">https://github.com/discourse/discourse-chat/pull/468</a></p>")
    end

    it 'supports lists' do
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

    it 'supports inline emoji' do
      cooked = ChatMessage.cook(":D")
      expect(cooked).to eq(<<~HTML.chomp)
      <p><img src="/images/emoji/twitter/smiley.png?v=12" title=":smiley:" class="emoji only-emoji" alt=":smiley:" loading=\"lazy\" width=\"20\" height=\"20\"></p>
      HTML
    end

    it 'supports emoji shortcuts' do
      cooked = ChatMessage.cook("this is a replace test :P :|")
      expect(cooked).to eq(<<~HTML.chomp)
        <p>this is a replace test <img src="/images/emoji/twitter/stuck_out_tongue.png?v=12" title=":stuck_out_tongue:" class="emoji" alt=":stuck_out_tongue:" loading=\"lazy\" width=\"20\" height=\"20\"> <img src="/images/emoji/twitter/expressionless.png?v=12" title=":expressionless:" class="emoji" alt=":expressionless:" loading=\"lazy\" width=\"20\" height=\"20\"></p>
      HTML
    end

    it 'supports spoilers' do
      if SiteSetting.respond_to?(:spoiler_enabled) && SiteSetting.spoiler_enabled
        cooked = ChatMessage.cook("[spoiler]the planet of the apes was earth all along[/spoiler]")

        expect(cooked).to eq("<div class=\"spoiler\">\n<p>the planet of the apes was earth all along</p>\n</div>")
      end
    end
  end

  describe ".to_markdown" do
    fab!(:message) { Fabricate(:chat_message, message: "hey friend, what's up?!") }

    it "renders the message without uploads" do
      expect(message.to_markdown).to eq("hey friend, what's up?!")
    end

    it "renders the message with uploads" do
      image = Fabricate(:upload, original_filename: "test_image.jpg", width: 400, height: 300, extension: "jpg")
      image2 = Fabricate(:upload, original_filename: "meme.jpg", width: 10, height: 10, extension: "jpg")
      ChatUpload.create(chat_message: message, upload: image)
      ChatUpload.create(chat_message: message, upload: image2)
      expect(message.to_markdown).to eq(<<~MSG.chomp)
      hey friend, what's up?!

      ![test_image.jpg|400x300](#{image.short_url})
      ![meme.jpg|10x10](#{image2.short_url})
      MSG
    end
  end
end
