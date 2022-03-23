# frozen_string_literal: true

require 'rails_helper'

describe 'discourse-chat' do
  before do
    SiteSetting.clean_up_uploads = true
    SiteSetting.clean_orphan_uploads_grace_period_hours = 1
    Jobs::CleanUpUploads.new.reset_last_cleanup!
  end

  describe 'register_upload_unused' do
    fab!(:chat_channel) { Fabricate(:chat_channel, chatable: Fabricate(:topic)) }
    fab!(:user) { Fabricate(:user) }
    fab!(:upload) { Fabricate(:upload, user: user, created_at: 1.month.ago) }
    fab!(:unused_upload) { Fabricate(:upload, user: user, created_at: 1.month.ago) }

    let!(:chat_message) do
      DiscourseChat::ChatMessageCreator.create(
        chat_channel: chat_channel,
        user: user,
        in_reply_to_id: nil,
        content: "Hello world!",
        upload_ids: [upload.id]
      )
    end

    it 'marks uploads with ChatUpload in use' do
      unused_upload

      expect { Jobs::CleanUpUploads.new.execute({}) }.to change { Upload.count }.by(-1)
      expect(Upload.exists?(id: upload.id)).to eq(true)
      expect(Upload.exists?(id: unused_upload.id)).to eq(false)
    end
  end

  describe 'register_upload_in_use' do
    fab!(:chat_channel) { Fabricate(:chat_channel, chatable: Fabricate(:topic)) }
    fab!(:user) { Fabricate(:user) }
    fab!(:message_upload) { Fabricate(:upload, user: user, created_at: 1.month.ago) }
    fab!(:draft_upload) { Fabricate(:upload, user: user, created_at: 1.month.ago) }
    fab!(:unused_upload) { Fabricate(:upload, user: user, created_at: 1.month.ago) }

    let!(:chat_message) do
      DiscourseChat::ChatMessageCreator.create(
        chat_channel: chat_channel,
        user: user,
        in_reply_to_id: nil,
        content: "Hello world! #{message_upload.sha1}",
        upload_ids: []
      )
    end

    let!(:draft_message) do
      ChatDraft.create!(
        user: user,
        chat_channel: chat_channel,
        data: "{\"value\":\"hello world \",\"uploads\":[\"#{draft_upload.sha1}\"],\"replyToMsg\":null}"
      )
    end

    it 'marks uploads with ChatUpload in use' do
      draft_upload
      unused_upload

      expect { Jobs::CleanUpUploads.new.execute({}) }.to change { Upload.count }.by(-1)
      expect(Upload.exists?(id: message_upload.id)).to eq(true)
      expect(Upload.exists?(id: draft_upload.id)).to eq(true)
      expect(Upload.exists?(id: unused_upload.id)).to eq(false)
    end
  end

  describe "topic view serializer extension" do
    fab!(:topic) { Fabricate(:topic) }
    fab!(:user) { Fabricate(:user) }
    fab!(:chat_channel) { Fabricate(:chat_channel, chatable: topic) }

    def topic_view
      topic_view = TopicView.new(topic.id, user)
      serializer = TopicViewSerializer.new(topic_view, scope: Guardian.new(user), root: false).as_json
      JSON.parse(MultiJson.dump(serializer)).deep_symbolize_keys!
    end

    it "has_chat_live is true when the channel is open or closed, not read_only or archived" do
      expect(topic_view[:has_chat_live]).to eq(true)
      chat_channel.update!(status: "closed")
      expect(topic_view[:has_chat_live]).to eq(true)
      chat_channel.update!(status: "read_only")
      expect(topic_view[:has_chat_live]).to eq(false)
      chat_channel.update!(status: "archived")
      expect(topic_view[:has_chat_live]).to eq(false)
    end
  end

  describe "user card serializer extension #can_chat_user" do
    fab!(:target_user) { Fabricate(:user) }
    let!(:user) { Fabricate(:user) }
    let!(:guardian) { Guardian.new(user) }
    let(:serializer) { UserCardSerializer.new(target_user, scope: guardian) }
    fab!(:group) { Fabricate(:group) }

    context "when chat enabled" do
      before do
        SiteSetting.chat_enabled = true
      end

      it "returns true if the target user and the guardian user is in the DiscourseChat.allowed_group_ids" do
        SiteSetting.chat_allowed_groups = group.id
        GroupUser.create(user: target_user, group: group)
        GroupUser.create(user: user, group: group)
        expect(serializer.can_chat_user).to eq(true)
      end

      it "returns false if the target user but not the guardian user is in the DiscourseChat.allowed_group_ids" do
        SiteSetting.chat_allowed_groups = group.id
        GroupUser.create(user: target_user, group: group)
        expect(serializer.can_chat_user).to eq(false)
      end

      it "returns false if the guardian user but not the target user is in the DiscourseChat.allowed_group_ids" do
        SiteSetting.chat_allowed_groups = group.id
        GroupUser.create(user: user, group: group)
        expect(serializer.can_chat_user).to eq(false)
      end

      context "when guardian user is same as target user" do
        let!(:guardian) { Guardian.new(target_user) }

        it "returns false" do
          expect(serializer.can_chat_user).to eq(false)
        end
      end

      context "when guardian user is anon" do
        let!(:guardian) { Guardian.new }

        it "returns false" do
          expect(serializer.can_chat_user).to eq(false)
        end
      end
    end

    context "when chat not enabled" do
      before do
        SiteSetting.chat_enabled = false
      end

      it "returns false" do
        expect(serializer.can_chat_user).to eq(false)
      end
    end
  end
end
