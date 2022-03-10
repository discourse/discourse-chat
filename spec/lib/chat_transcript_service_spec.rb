# frozen_string_literal: true

require 'rails_helper'

describe ChatTranscriptService do
  let(:user1) { Fabricate(:user, username: "martinchat") }
  let(:user2) { Fabricate(:user, username: "brucechat") }
  let(:channel) { Fabricate(:chat_channel, name: "The Beam Discussions") }

  def service(message_ids, opts: {})
    described_class.new(channel, messages_or_ids: Array.wrap(message_ids), opts: opts)
  end

  it "generates a simple chat transcript from one message" do
    message = Fabricate(:chat_message, user: user1, chat_channel: channel, message: "an extremely insightful response :)")

    expect(service(message.id).generate_markdown).to eq(<<~MARKDOWN)
    [chat quote="martinchat;#{message.id};#{message.created_at.iso8601}" channel="The Beam Discussions"]
    an extremely insightful response :)
    [/chat]
    MARKDOWN
  end

  it "generates a single chat transcript from multiple subsequent messages from the same user" do
    message1 = Fabricate(:chat_message, user: user1, chat_channel: channel, message: "an extremely insightful response :)")
    message2 = Fabricate(:chat_message, user: user1, chat_channel: channel, message: "if i say so myself")
    message3 = Fabricate(:chat_message, user: user1, chat_channel: channel, message: "yay!")

    rendered = service([message1.id, message2.id, message3.id]).generate_markdown
    expect(rendered).to eq(<<~MARKDOWN)
    [chat quote="martinchat;#{message1.id};#{message1.created_at.iso8601}" channel="The Beam Discussions" multiQuote="true"]
    an extremely insightful response :)

    if i say so myself

    yay!
    [/chat]
    MARKDOWN
  end

  it "generates chat messages in created_at order no matter what order the message_ids are passed in" do
    message1 = Fabricate(:chat_message, created_at: 10.minute.ago, user: user1, chat_channel: channel, message: "an extremely insightful response :)")
    message2 = Fabricate(:chat_message, created_at: 5.minutes.ago, user: user1, chat_channel: channel, message: "if i say so myself")
    message3 = Fabricate(:chat_message, created_at: 1.minutes.ago, user: user1, chat_channel: channel, message: "yay!")

    rendered = service([message3.id, message1.id, message2.id]).generate_markdown
    expect(rendered).to eq(<<~MARKDOWN)
    [chat quote="martinchat;#{message1.id};#{message1.created_at.iso8601}" channel="The Beam Discussions" multiQuote="true"]
    an extremely insightful response :)

    if i say so myself

    yay!
    [/chat]
    MARKDOWN
  end

  it "generates multiple chained chat transcripts for interleaving messages from different users" do
    message1 = Fabricate(:chat_message, user: user1, chat_channel: channel, message: "an extremely insightful response :)")
    message2 = Fabricate(:chat_message, user: user2, chat_channel: channel, message: "says you!")
    message3 = Fabricate(:chat_message, user: user1, chat_channel: channel, message: "aw :(")

    expect(service([message1.id, message2.id, message3.id]).generate_markdown).to eq(<<~MARKDOWN)
    [chat quote="martinchat;#{message1.id};#{message1.created_at.iso8601}" channel="The Beam Discussions" multiQuote="true" chained="true"]
    an extremely insightful response :)
    [/chat]

    [chat quote="brucechat;#{message2.id};#{message2.created_at.iso8601}" chained="true"]
    says you!
    [/chat]

    [chat quote="martinchat;#{message3.id};#{message3.created_at.iso8601}" chained="true"]
    aw :(
    [/chat]
    MARKDOWN
  end

  it "generates image / attachment / video / audio markdown inside the [chat] bbcode for upload-only messages" do
    SiteSetting.authorized_extensions = "mp4|mp3|pdf|jpg"
    message = Fabricate(:chat_message, user: user1, chat_channel: channel, message: "")
    video = Fabricate(:upload, original_filename: "test_video.mp4", extension: "mp4")
    audio = Fabricate(:upload, original_filename: "test_audio.mp3", extension: "mp3")
    attachment = Fabricate(:upload, original_filename: "test_file.pdf", extension: "pdf")
    image = Fabricate(:upload, width: 100, height: 200, original_filename: "test_img.jpg", extension: "jpg")
    cu1 = ChatUpload.create(chat_message: message, created_at: 10.seconds.ago, upload: video)
    cu2 = ChatUpload.create(chat_message: message, created_at: 9.seconds.ago, upload: audio)
    cu3 = ChatUpload.create(chat_message: message, created_at: 8.seconds.ago, upload: attachment)
    cu4 = ChatUpload.create(chat_message: message, created_at: 7.seconds.ago, upload: image)
    video_markdown = UploadMarkdown.new(video).to_markdown
    audio_markdown = UploadMarkdown.new(audio).to_markdown
    attachment_markdown = UploadMarkdown.new(attachment).to_markdown
    image_markdown = UploadMarkdown.new(image).to_markdown

    expect(service(message.id).generate_markdown).to eq(<<~MARKDOWN)
    [chat quote="martinchat;#{message.id};#{message.created_at.iso8601}" channel="The Beam Discussions"]
    #{video_markdown}
    #{audio_markdown}
    #{attachment_markdown}
    #{image_markdown}
    [/chat]
    MARKDOWN
  end

  it "generates the correct markdown if a message has text and an upload" do
    SiteSetting.authorized_extensions = "mp4|mp3|pdf|jpg"
    message = Fabricate(:chat_message, user: user1, chat_channel: channel, message: "this is a cool and funny picture")
    image = Fabricate(:upload, width: 100, height: 200, original_filename: "test_img.jpg", extension: "jpg")
    cu = ChatUpload.create(chat_message: message, created_at: 7.seconds.ago, upload: image)
    image_markdown = UploadMarkdown.new(image).to_markdown

    expect(service(message.id).generate_markdown).to eq(<<~MARKDOWN)
    [chat quote="martinchat;#{message.id};#{message.created_at.iso8601}" channel="The Beam Discussions"]
    this is a cool and funny picture

    #{image_markdown}
    [/chat]
    MARKDOWN
  end

  it "generates a transcript with the noLink option" do
    message = Fabricate(:chat_message, user: user1, chat_channel: channel, message: "an extremely insightful response :)")

    expect(service(message.id, opts: { no_link: true }).generate_markdown).to eq(<<~MARKDOWN)
    [chat quote="martinchat;#{message.id};#{message.created_at.iso8601}" channel="The Beam Discussions" noLink="true"]
    an extremely insightful response :)
    [/chat]
    MARKDOWN
  end
end
