# frozen_string_literal: true

require 'rails_helper'

describe 'discourse-chat' do
  before do
    SiteSetting.clean_up_uploads = true
    SiteSetting.clean_orphan_uploads_grace_period_hours = 1
    Jobs::CleanUpUploads.new.reset_last_cleanup!
    SiteSetting.chat_enabled = true
  end

  describe 'register_upload_unused' do
    fab!(:chat_channel) { Fabricate(:chat_channel, chatable: Fabricate(:category)) }
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
    fab!(:chat_channel) { Fabricate(:chat_channel, chatable: Fabricate(:category)) }
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

  describe "chat oneboxes" do
    fab!(:chat_channel) { Fabricate(:chat_channel, chatable: Fabricate(:category)) }
    fab!(:user) { Fabricate(:user, active: true) }
    fab!(:user_2) { Fabricate(:user, active: false) }
    fab!(:user_3) { Fabricate(:user, staged: true) }
    fab!(:user_4) { Fabricate(:user, suspended_till: 3.weeks.from_now) }

    let!(:chat_message) do
      DiscourseChat::ChatMessageCreator.create(
        chat_channel: chat_channel,
        user: user,
        in_reply_to_id: nil,
        content: "Hello world!",
        upload_ids: []
      ).chat_message
    end

    let(:chat_url) { "#{Discourse.base_url}/chat/channel/#{chat_channel.id}" }

    context "inline" do
      it "renders channel" do
        results = InlineOneboxer.new([chat_url], skip_cache: true).process
        expect(results).to be_present
        expect(results[0][:url]).to eq(chat_url)
        expect(results[0][:title]).to eq("Chat ##{chat_channel.name}")
      end

      it "renders messages" do
        results = InlineOneboxer.new(["#{chat_url}?messageId=#{chat_message.id}"], skip_cache: true).process
        expect(results).to be_present
        expect(results[0][:url]).to eq("#{chat_url}?messageId=#{chat_message.id}")
        expect(results[0][:title]).to eq("Message ##{chat_message.id} by #{chat_message.user.username} – ##{chat_channel.name}")
      end
    end

    context "regular" do
      it "renders channel, excluding inactive, staged, and suspended users" do
        user.user_chat_channel_memberships.create!(chat_channel: chat_channel, following: true)
        user_2.user_chat_channel_memberships.create!(chat_channel: chat_channel, following: true)
        user_3.user_chat_channel_memberships.create!(chat_channel: chat_channel, following: true)
        user_4.user_chat_channel_memberships.create!(chat_channel: chat_channel, following: true)
        Jobs::UpdateUserCountsForChatChannels.new.execute({})

        expect(Oneboxer.preview(chat_url)).to match_html <<~HTML
          <aside class="onebox chat-onebox">
            <article class="onebox-body chat-onebox-body">
              <h3 class="chat-onebox-title">
                <a href="#{chat_url}">
                  <span class="category-chat-badge" style="color: ##{chat_channel.chatable.color}">
                    <svg class="fa d-icon d-icon-hashtag svg-icon svg-string" xmlns="http://www.w3.org/2000/svg"><use href="#hashtag"></use></svg>
                 </span>
                  <span class="clear-badge">#{chat_channel.name}</span>
                </a>
              </h3>
              <div class="chat-onebox-members-count">1 member</div>
              <div class="chat-onebox-members">
               <a class="trigger-user-card" data-user-card="#{user.username}" aria-hidden="true" tabindex="-1">
                 <img loading="lazy" alt="#{user.username}" width="30" height="30" src="#{user.avatar_template_url.gsub('{size}', '60')}" class="avatar">
               </a>
              </div>
            </article>
        </aside>

        HTML
      end

      it "renders messages" do
        expect(Oneboxer.preview("#{chat_url}?messageId=#{chat_message.id}")).to match_html <<~HTML
          <div class="discourse-chat-transcript" data-message-id="#{chat_message.id}" data-username="#{user.username}" data-datetime="#{chat_message.created_at.iso8601}" data-channel-name="#{chat_channel.name}" data-channel-id="#{chat_channel.id}">
          <div class="chat-transcript-user">
            <div class="chat-transcript-user-avatar">
              <a class="trigger-user-card" data-user-card="#{user.username}" aria-hidden="true" tabindex="-1">
                <img loading="lazy" alt="#{user.username}" width="20" height="20" src="#{user.avatar_template_url.gsub("{size}", "20")}" class="avatar">
              </a>
            </div>
            <div class="chat-transcript-username">#{user.username}</div>
              <div class="chat-transcript-datetime">
                <a href="#{chat_url}?messageId=#{chat_message.id}" title="#{chat_message.created_at}">#{chat_message.created_at}</a>
              </div>
              <a class="chat-transcript-channel" href="/chat/chat_channels/#{chat_channel.id}">
                <span class="category-chat-badge" style="color: ##{chat_channel.chatable.color}">
                  <svg class="fa d-icon d-icon-hashtag svg-icon svg-string" xmlns="http://www.w3.org/2000/svg"><use href="#hashtag"></use></svg>
                </span>
                #{chat_channel.name}
              </a>
            </div>
          <div class="chat-transcript-messages"><p>Hello world!</p></div>
        </div>
        HTML
      end
    end
  end

  describe 'auto-joining users to a channel' do
    fab!(:chatters_group) { Fabricate(:group) }
    fab!(:category) { Fabricate(:category) }
    fab!(:user) { Fabricate(:user, last_seen_at: 15.minutes.ago) }

    before do
      @channel = Fabricate(:chat_channel, auto_join_users: true, chatable: category)
    end

    describe 'when a user is added to a group with access to a channel through a category' do
      before { Fabricate(:category_group, category: category, group: chatters_group) }

      it 'joins the user to the channel if auto-join is enabled' do
        chatters_group.add(user)

        membership = UserChatChannelMembership.find_by(user: user, chat_channel: @channel, following: true)

        expect(membership).to be_present
      end

      it 'does nothing if auto-join is disabled' do
        @channel.update!(auto_join_users: false)
        chatters_group.add(user)

        membership = UserChatChannelMembership.find_by(user: user, chat_channel: @channel, following: true)

        expect(membership).to be_nil
      end
    end

    describe "when a user is removed from a group with access to a channel through a category" do
      before do
        Fabricate(:category_group, category: category, group: chatters_group)
        chatters_group.add(user)
      end

      it 'removes the user from the channel' do
        chatters_group.remove(user)

        membership = UserChatChannelMembership.find_by(user: user, chat_channel: @channel)

        expect(membership.following).to eq(false)
      end

      it "doesn't remove the user if auto-join is disabled" do
        @channel.update!(auto_join_users: false)
        chatters_group.add(user)

        chatters_group.remove(user)
        membership = UserChatChannelMembership.find_by(user: user, chat_channel: @channel)

        expect(membership.following).to eq(true)
      end

      it "doesn't remove the user if still has access through a different group" do
        another_group = Fabricate(:group)
        Fabricate(:category_group, category: category, group: another_group)
        another_group.add(user)

        chatters_group.remove(user)
        membership = UserChatChannelMembership.find_by(user: user, chat_channel: @channel)

        expect(membership.following).to eq(true)
      end

      it "doesn't remove the user from other channels where they still have access" do
        another_group = Fabricate(:group)
        another_category = Fabricate(:category)
        Fabricate(:category_group, category: another_category, group: another_group)
        another_channel = Fabricate(:chat_channel, auto_join_users: true, chatable: another_category)
        another_group.add(user)

        chatters_group.remove(user)
        membership = UserChatChannelMembership.find_by(user: user, chat_channel: another_channel)

        expect(membership.following).to eq(true)
      end
    end

    describe 'when category permissions change' do
      before { Jobs.run_immediately! }

      describe 'given permissions to a new group' do
        let(:chatters_group_permission) do
          { chatters_group.name => CategoryGroup.permission_types[:full] }
        end

        it 'adds the user to the channel' do
          chatters_group.add(user)
          apply_permissions_and_trigger_event(category, chatters_group_permission)

          membership = UserChatChannelMembership.find_by(user: user, chat_channel: @channel)

          expect(membership.following).to eq(true)
        end

        it 'does nothing if there is no channel for the category' do
          another_category = Fabricate(:category)
          chatters_group.add(user)
          apply_permissions_and_trigger_event(another_category, chatters_group_permission)

          membership = UserChatChannelMembership.find_by(user: user, chat_channel: @channel)

          expect(membership).to be_nil
        end
      end

      describe 'revoke group permissions' do
        before do
          Fabricate(:category_group, category: category, group: chatters_group)
          chatters_group.add(user)
        end

        it 'removes the user from the group' do
          apply_permissions_and_trigger_event(category, { 'staff' => CategoryGroup.permission_types[:full] })

          membership = UserChatChannelMembership.find_by(user: user, chat_channel: @channel)

          expect(membership.following).to eq(false)
        end
      end

      def apply_permissions_and_trigger_event(category, permissions)
        category.update!(permissions: permissions)
      end
    end
  end
end
