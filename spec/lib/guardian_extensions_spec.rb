# frozen_string_literal: true

require 'rails_helper'

describe DiscourseChat::GuardianExtensions do
  let(:user) { Fabricate(:user) }
  let(:staff) { Fabricate(:user, admin: true) }
  let(:guardian) { Guardian.new(user) }
  let(:staff_guardian) { Guardian.new(staff) }
  let(:chat_group) { Fabricate(:group) }

  before do
    SiteSetting.chat_allowed_groups = chat_group.id
  end

  it "cannot chat if the user is not in the DiscourseChat.allowed_group_ids" do
    SiteSetting.chat_allowed_groups = ""
    expect(guardian.can_chat?(user)).to eq(false)
  end

  describe "chat channel" do
    let(:channel) { Fabricate(:chat_channel) }

    it "only staff can create channels" do
      expect(guardian.can_create_chat_channel?).to eq(false)
      expect(staff_guardian.can_create_chat_channel?).to eq(true)
    end

    it "only staff can edit chat channels" do
      expect(guardian.can_edit_chat_channel?).to eq(false)
      expect(staff_guardian.can_edit_chat_channel?).to eq(true)
    end

    it "only staff can close chat channels" do
      expect(guardian.can_close_chat_channel?).to eq(false)
      expect(staff_guardian.can_close_chat_channel?).to eq(true)
    end

    it "only staff can archive chat channels" do
      expect(guardian.can_archive_chat_channel?).to eq(false)
      expect(staff_guardian.can_archive_chat_channel?).to eq(true)
    end

    describe "#can_see_chat_channel?" do
      context "for topic channels" do
        let(:topic) { Fabricate(:topic) }
        
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
        let(:dm_channel) { DirectMessageChannel.create! }

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
        let(:category) { Fabricate(:category, read_restricted: true) }

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
  end
end
