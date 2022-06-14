# frozen_string_literal: true

describe "chat bbcode quoting in posts" do
  fab!(:post) { Fabricate(:post) }

  before do
    SiteSetting.chat_enabled = true
  end

  it "can render the simplest version" do
    post.update!(raw: "[chat quote=\"martin;2321;2022-01-25T05:40:39Z\"]\nThis is a chat message.\n[/chat]")
    expect(post.cooked.chomp).to eq(<<~COOKED.chomp)
      <div class="discourse-chat-transcript" data-message-id="2321" data-username="martin" data-datetime="2022-01-25T05:40:39Z">
      <div class="chat-transcript-user">
      <div class="chat-transcript-user-avatar"></div>
      <div class="chat-transcript-username">
      martin</div>
      <div class="chat-transcript-datetime">
      <a href="/chat/message/2321" title="2022-01-25T05:40:39Z"></a>
      </div>
      </div>
      <div class="chat-transcript-messages">
      <p>This is a chat message.</p>
      </div>
      </div>
    COOKED
  end

  it "renders the channel name if provided with multiQuote" do
    post.update!(raw: "[chat quote=\"martin;2321;2022-01-25T05:40:39Z\" channel=\"Cool Cats Club\" channelId=\"1234\" multiQuote=\"true\"]\nThis is a chat message.\n[/chat]")
    expect(post.cooked.chomp).to eq(<<~COOKED.chomp)
      <div class="discourse-chat-transcript" data-message-id="2321" data-username="martin" data-datetime="2022-01-25T05:40:39Z" data-channel-name="Cool Cats Club" data-channel-id="1234">
      <div class="chat-transcript-meta">
      Originally sent in <a href="/chat/chat_channels/1234">Cool Cats Club</a>
      </div>
      <div class="chat-transcript-user">
      <div class="chat-transcript-user-avatar"></div>
      <div class="chat-transcript-username">
      martin</div>
      <div class="chat-transcript-datetime">
      <a href="/chat/message/2321" title="2022-01-25T05:40:39Z"></a>
      </div>
      </div>
      <div class="chat-transcript-messages">
      <p>This is a chat message.</p>
      </div>
      </div>
    COOKED
  end

  it "renders the channel name if provided without multiQuote" do
    post.update!(raw: "[chat quote=\"martin;2321;2022-01-25T05:40:39Z\" channel=\"Cool Cats Club\" channelId=\"1234\"]\nThis is a chat message.\n[/chat]")
    expect(post.cooked.chomp).to eq(<<~COOKED.chomp)
      <div class="discourse-chat-transcript" data-message-id="2321" data-username="martin" data-datetime="2022-01-25T05:40:39Z" data-channel-name="Cool Cats Club" data-channel-id="1234">
      <div class="chat-transcript-user">
      <div class="chat-transcript-user-avatar"></div>
      <div class="chat-transcript-username">
      martin</div>
      <div class="chat-transcript-datetime">
      <a href="/chat/message/2321" title="2022-01-25T05:40:39Z"></a>
      </div>
      <a class="chat-transcript-channel" href="/chat/chat_channels/1234">
      #Cool Cats Club</a>
      </div>
      <div class="chat-transcript-messages">
      <p>This is a chat message.</p>
      </div>
      </div>
    COOKED
  end

  it "renders with the chained attribute for more compact quotes" do
    post.update!(raw: "[chat quote=\"martin;2321;2022-01-25T05:40:39Z\" channel=\"Cool Cats Club\" channelId=\"1234\" chained=\"true\"]\nThis is a chat message.\n[/chat]")
    expect(post.cooked.chomp).to eq(<<~COOKED.chomp)
      <div class="discourse-chat-transcript chat-transcript-chained" data-message-id="2321" data-username="martin" data-datetime="2022-01-25T05:40:39Z" data-channel-name="Cool Cats Club" data-channel-id="1234">
      <div class="chat-transcript-user">
      <div class="chat-transcript-user-avatar"></div>
      <div class="chat-transcript-username">
      martin</div>
      <div class="chat-transcript-datetime">
      <a href="/chat/message/2321" title="2022-01-25T05:40:39Z"></a>
      </div>
      <a class="chat-transcript-channel" href="/chat/chat_channels/1234">
      #Cool Cats Club</a>
      </div>
      <div class="chat-transcript-messages">
      <p>This is a chat message.</p>
      </div>
      </div>
    COOKED
  end

  it "renders with the noLink attribute to remove the links to the individual messages from the datetimes" do
    post.update!(raw: "[chat quote=\"martin;2321;2022-01-25T05:40:39Z\" channel=\"Cool Cats Club\" channelId=\"1234\" multiQuote=\"true\" noLink=\"true\"]\nThis is a chat message.\n[/chat]")
    expect(post.cooked.chomp).to eq(<<~COOKED.chomp)
      <div class="discourse-chat-transcript" data-message-id="2321" data-username="martin" data-datetime="2022-01-25T05:40:39Z" data-channel-name="Cool Cats Club" data-channel-id="1234">
      <div class="chat-transcript-meta">
      Originally sent in <a href="/chat/chat_channels/1234">Cool Cats Club</a>
      </div>
      <div class="chat-transcript-user">
      <div class="chat-transcript-user-avatar"></div>
      <div class="chat-transcript-username">
      martin</div>
      <div class="chat-transcript-datetime">
      <span title="2022-01-25T05:40:39Z"></span>
      </div>
      </div>
      <div class="chat-transcript-messages">
      <p>This is a chat message.</p>
      </div>
      </div>
    COOKED
  end

  it "renders with the reactions attribute" do
    reactions_attr = "+1:martin;heart:martin,eviltrout"
    post.update!(raw: "[chat quote=\"martin;2321;2022-01-25T05:40:39Z\" channel=\"Cool Cats Club\" channelId=\"1234\" reactions=\"#{reactions_attr}\"]\nThis is a chat message.\n[/chat]")
    expect(post.cooked.chomp).to eq(<<~COOKED.chomp)
      <div class="discourse-chat-transcript" data-message-id="2321" data-username="martin" data-datetime="2022-01-25T05:40:39Z" data-reactions="+1:martin;heart:martin,eviltrout" data-channel-name="Cool Cats Club" data-channel-id="1234">
      <div class="chat-transcript-user">
      <div class="chat-transcript-user-avatar"></div>
      <div class="chat-transcript-username">
      martin</div>
      <div class="chat-transcript-datetime">
      <a href="/chat/message/2321" title="2022-01-25T05:40:39Z"></a>
      </div>
      <a class="chat-transcript-channel" href="/chat/chat_channels/1234">
      #Cool Cats Club</a>
      </div>
      <div class="chat-transcript-messages">
      <p>This is a chat message.</p>
      <div class="chat-transcript-reactions">
      <div class="chat-transcript-reaction">
      <img width="20" height="20" src="/images/emoji/twitter/+1.png?v=12" title="+1" loading="lazy" alt="+1" class="emoji"> 1</div>
      <div class="chat-transcript-reaction">
      <img width="20" height="20" src="/images/emoji/twitter/heart.png?v=12" title="heart" loading="lazy" alt="heart" class="emoji"> 2</div>
      </div>
      </div>
      </div>
    COOKED
  end

  it "correctly renders inline and non-inline oneboxes combined with chat quotes" do
    full_onebox_html = <<~HTML.chomp
      <aside class="onebox wikipedia" data-onebox-src="https://en.wikipedia.org/wiki/Hyperlink" dir="ltr">
        <header class="source">
          <svg class="fa d-icon d-icon-fab-wikipedia-w svg-icon svg-string" xmlns="http://www.w3.org/2000/svg">
            <use href="#fab-wikipedia-w"></use>
          </svg>
          <a href="https://en.wikipedia.org/wiki/Hyperlink" target="_blank" rel="nofollow ugc noopener" tabindex="-1">en.wikipedia.org</a>
        </header>
        <article class="onebox-body">
          <img src="//upload.wikimedia.org/wikipedia/commons/thumb/d/d5/Hyperlink-Wikipedia.svg/250px-Hyperlink-Wikipedia.svg.png" class="thumbnail">
          <h3>
            <a href="https://en.wikipedia.org/wiki/Hyperlink" target="_blank" rel="nofollow ugc noopener" tabindex="-1">Hyperlink | History</a>
          </h3>
          <p>The term "link" was coined in 1965 (or possibly 1964) by Ted Nelson at the start of Project Xanadu. Nelson had been inspired by "As We May Think", a popular 1945 essay by Vannevar Bush. In the essay, Bush described a microfilm-based machine (the Memex) in which one could link any two pages of information into a "trail" of related information, and then scroll back and forth among pages in a trail as if they were on a single microfilm reel. In a series of books and articles published from 1964 thr...</p>
        </article>
        <div class="onebox-metadata"></div>
        <div style="clear: both"></div>
      </aside>
    HTML
    SiteSetting.enable_inline_onebox_on_all_domains = true
    Oneboxer.stubs(:cached_onebox).with("https://en.wikipedia.org/wiki/Hyperlink").returns(full_onebox_html)
    stub_request(:get, "https://en.wikipedia.org/wiki/Hyperlink").to_return(
      status: 200,
      body: "<html><head><title>Hyperlink - Wikipedia</title></head></html>"
    )
    stub_request(:get, "http://upload.wikimedia.org/wikipedia/commons/thumb/d/d5/Hyperlink-Wikipedia.svg/250px-Hyperlink-Wikipedia.svg.png").to_return(status: 200, body: "", headers: {})
    post.update!(raw: <<~MD)
https://en.wikipedia.org/wiki/Hyperlink

[chat quote=\"martin;2321;2022-01-25T05:40:39Z\"]
This is a chat message.
[/chat]

https://en.wikipedia.org/wiki/Hyperlink

This is an inline onebox https://en.wikipedia.org/wiki/Hyperlink.
    MD

    expect(post.cooked.chomp).to eq(<<~COOKED.chomp)
#{full_onebox_html}
<div class="discourse-chat-transcript" data-message-id="2321" data-username="martin" data-datetime="2022-01-25T05:40:39Z">
<div class="chat-transcript-user">
<div class="chat-transcript-user-avatar"></div>
<div class="chat-transcript-username">
martin</div>
<div class="chat-transcript-datetime">
<a href="/chat/message/2321" title="2022-01-25T05:40:39Z"></a>
</div>
</div>
<div class="chat-transcript-messages">
<p>This is a chat message.</p>
</div>
</div>
#{full_onebox_html}
<p>This is an inline onebox <a href="https://en.wikipedia.org/wiki/Hyperlink" class="inline-onebox-loading" rel="noopener nofollow ugc">https://en.wikipedia.org/wiki/Hyperlink</a>.</p>
    COOKED
  ensure
    InlineOneboxer.invalidate("https://en.wikipedia.org/wiki/Hyperlink")
  end
end
