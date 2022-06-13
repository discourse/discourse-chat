# frozen_string_literal: true

require 'rails_helper'

describe ChatChannelSerializer do
  fab!(:user) { Fabricate(:user) }
  fab!(:admin) { Fabricate(:admin) }
  fab!(:chat_channel) { Fabricate(:chat_channel) }
  let(:guardian_user) { user }
  let(:guardian) { Guardian.new(guardian_user) }
  subject do
    described_class.new(chat_channel, scope: guardian, root: nil)
  end

  describe "archive status" do
    context "when user is not staff" do
      let(:guardian_user) { user }

      it "does not return any sort of archive status" do
        expect(subject.as_json.key?(:archive_completed)).to eq(false)
      end
    end

    context "when user is staff" do
      let(:guardian_user) { admin }

      it "includes the archive status if the channel is archived and the archive record exists" do
        expect(subject.as_json.key?(:archive_completed)).to eq(false)

        chat_channel.update!(status: ChatChannel.statuses[:archived])
        expect(subject.as_json.key?(:archive_completed)).to eq(false)

        ChatChannelArchive.create!(
          chat_channel: chat_channel,
          archived_by: admin,
          destination_topic_title: "This will be the archive topic",
          total_messages: 10
        )
        chat_channel.reload
        expect(subject.as_json.key?(:archive_completed)).to eq(true)
      end
    end
  end
end
