# frozen_string_literal: true


describe DiscourseChat::ChatChannelFetcher do
  describe ".unread_counts" do
    fab!(:user_1) { Fabricate(:user) }
    fab!(:user_2) { Fabricate(:user) }
    fab!(:chat_channel) { Fabricate(:chat_channel) }

    context "user is member of the channel" do
      before do
        Fabricate(:user_chat_channel_membership, chat_channel: chat_channel, user: user_1)
      end

      context "has unread messages" do
        before do
          Fabricate(:chat_message, chat_channel: chat_channel, message: "hi", user: user_2)
          Fabricate(:chat_message, chat_channel: chat_channel, message: "bonjour", user: user_2)
        end

        it "returns the correct count" do
          unread_counts = subject.unread_counts([chat_channel], user_1)
          expect(unread_counts[chat_channel.id]).to eq(2)
        end
      end

      context "has no unread messages" do
        it "returns the correct count" do
          unread_counts = subject.unread_counts([chat_channel], user_1)
          expect(unread_counts[chat_channel.id]).to be_nil
        end
      end

      context "last unread message has been deleted" do
        fab!(:last_unread) { Fabricate(:chat_message, chat_channel: chat_channel, message: "hi", user: user_2) }

        before do
          last_unread.update!(deleted_at: Time.zone.now)
        end

        it "returns the correct count" do
          unread_counts = subject.unread_counts([chat_channel], user_1)
          expect(unread_counts[chat_channel.id]).to be_nil
        end
      end
    end

    context "user is not member of the channel" do
      context "the channel has new messages" do
        before do
          Fabricate(:chat_message, chat_channel: chat_channel, message: "hi", user: user_2)
        end

        it "returns the correct count" do
          unread_counts = subject.unread_counts([chat_channel], user_1)
          expect(unread_counts[chat_channel.id]).to be_nil
        end
      end
    end
  end
end
