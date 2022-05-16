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
end
