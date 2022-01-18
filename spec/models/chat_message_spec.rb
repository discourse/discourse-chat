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
      <pre><code>something = test
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

      expect(cooked).to eq("<p><img src=\"/images/emoji/twitter/grin.png?v=12\" title=\":grin:\" class=\"emoji only-emoji\" alt=\":grin:\"></p>")
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
  end
end
