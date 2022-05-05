# frozen_string_literal: true

require 'rails_helper'

describe DiscourseChat::GuardianExtensions do
  fab!(:user) { Fabricate(:user) }
  fab!(:staff) { Fabricate(:user, admin: true) }
  fab!(:guardian) { Guardian.new(user) }
  fab!(:staff_guardian) { Guardian.new(staff) }
  fab!(:chat_group) { Fabricate(:group) }

  before do
    SiteSetting.chat_allowed_groups = chat_group.id
  end

  it "cannot chat if the user is not in the DiscourseChat.allowed_group_ids" do
    SiteSetting.chat_allowed_groups = ""
    expect(guardian.can_chat?(user)).to eq(false)
  end

  describe "chat channel" do
    fab!(:channel) { Fabricate(:chat_channel) }

    it "only staff can create channels" do
      expect(guardian.can_create_chat_channel?).to eq(false)
      expect(staff_guardian.can_create_chat_channel?).to eq(true)
    end

    it "only staff can edit chat channels" do
      expect(guardian.can_edit_chat_channel?).to eq(false)
      expect(staff_guardian.can_edit_chat_channel?).to eq(true)
    end

    it "only staff can close chat channels" do
      channel.update(status: :open)
      expect(guardian.can_change_channel_status?(channel, :closed)).to eq(false)
      expect(staff_guardian.can_change_channel_status?(channel, :closed)).to eq(true)
    end

    it "only staff can open chat channels" do
      channel.update(status: :closed)
      expect(guardian.can_change_channel_status?(channel, :open)).to eq(false)
      expect(staff_guardian.can_change_channel_status?(channel, :open)).to eq(true)
    end

    it "only staff can archive chat channels" do
      channel.update(status: :read_only)
      expect(guardian.can_change_channel_status?(channel, :archived)).to eq(false)
      expect(staff_guardian.can_change_channel_status?(channel, :archived)).to eq(true)
    end

    it "only staff can mark chat channels read_only" do
      channel.update(status: :open)
      expect(guardian.can_change_channel_status?(channel, :read_only)).to eq(false)
      expect(staff_guardian.can_change_channel_status?(channel, :read_only)).to eq(true)
    end

    describe "#can_see_chat_channel?" do
      context "for topic channels" do
        fab!(:topic) { Fabricate(:topic) }

        before do
          channel.update(chatable: topic)
        end

        it "returns false if the topic is closed or archived" do
          expect(guardian.can_see_chat_channel?(channel)).to eq(true)
          topic.update(closed: true)
          expect(guardian.can_see_chat_channel?(channel)).to eq(false)
          topic.update(closed: false, archived: true)
          expect(guardian.can_see_chat_channel?(channel)).to eq(false)
        end

        it "returns false if the user can't see the topic (e.g. a private category)" do
          expect(guardian.can_see_chat_channel?(channel)).to eq(true)
          topic.update(category: Fabricate(:private_category, group: Fabricate(:group)))
          expect(guardian.can_see_chat_channel?(channel)).to eq(false)
        end
      end

      context "for direct message channels" do
        fab!(:dm_channel) { DirectMessageChannel.create! }

        before do
          channel.update(chatable_type: "DirectMessageType", chatable: dm_channel)
        end

        it "returns true if the user is part of the direct message" do
          expect(guardian.can_see_chat_channel?(channel)).to eq(false)
          DirectMessageUser.create(user: user, direct_message_channel_id: dm_channel.id)
          expect(guardian.can_see_chat_channel?(channel)).to eq(true)
        end
      end

      context "for category channel" do
        fab!(:category) { Fabricate(:category, read_restricted: true) }

        before do
          channel.update(chatable: category)
        end

        it "returns true if the user can see the category" do
          expect(Guardian.new(user).can_see_chat_channel?(channel)).to eq(false)
          group = Fabricate(:group)
          CategoryGroup.create(group: group, category: category)
          GroupUser.create(group: group, user: user)

          # have to make a new instance of guardian because `user.secure_category_ids`
          # is memoized there
          expect(Guardian.new(user).can_see_chat_channel?(channel)).to eq(true)
        end
      end
    end

    describe "#can_flag_in_chat_channel?" do
      it "can only flag if the channel is not a direct message channel" do
        expect(guardian.can_see_chat_channel?(channel)).to eq(true)
        channel.update(chatable: DirectMessageChannel.create!)
        expect(guardian.can_flag_in_chat_channel?(channel)).to eq(false)
      end
    end

    describe "#can_moderate_chat?" do
      context "for topic channel" do
        fab!(:topic) { Fabricate(:topic) }

        before do
          channel.update(chatable: topic)
        end

        it "is based on whether the user is a group moderator or has high enough trust level, see core for details" do
          Guardian.any_instance.stubs(:can_perform_action_available_to_group_moderators?).returns(true)
          expect(guardian.can_moderate_chat?(channel.chatable)).to eq(true)
          Guardian.any_instance.stubs(:can_perform_action_available_to_group_moderators?).returns(false)
          expect(guardian.can_moderate_chat?(channel.chatable)).to eq(false)
        end
      end

      context "for category channel" do
        fab!(:category) { Fabricate(:category, read_restricted: true) }

        before do
          channel.update(chatable: category)
        end

        it "returns true for staff and false for regular users" do
          expect(staff_guardian.can_moderate_chat?(channel.chatable)).to eq(true)
          expect(guardian.can_moderate_chat?(channel.chatable)).to eq(false)
        end

        context "when enable_category_group_moderation is true" do
          before { SiteSetting.enable_category_group_moderation = true }

          it "returns true if the regular user is part of the reviewable_by_group for the category" do
            mods = Fabricate(:group)
            GroupUser.create(user: user, group: mods)
            category.update!(reviewable_by_group: mods)
            expect(staff_guardian.can_moderate_chat?(channel.chatable)).to eq(true)
            expect(guardian.can_moderate_chat?(channel.chatable)).to eq(true)
          end
        end
      end

      context "for DM channel" do
        fab!(:dm_channel) { DirectMessageChannel.create! }

        before do
          channel.update(chatable_type: "DirectMessageType", chatable: dm_channel)
        end

        it "returns true for staff and false for regular users" do
          expect(staff_guardian.can_moderate_chat?(channel.chatable)).to eq(true)
          expect(guardian.can_moderate_chat?(channel.chatable)).to eq(false)
        end
      end
    end
  end
end
