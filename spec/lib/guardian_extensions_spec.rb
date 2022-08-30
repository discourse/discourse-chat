# frozen_string_literal: true

require "rails_helper"

RSpec.describe DiscourseChat::GuardianExtensions do
  fab!(:user) { Fabricate(:user) }
  fab!(:staff) { Fabricate(:user, admin: true) }
  fab!(:guardian) { Guardian.new(user) }
  fab!(:staff_guardian) { Guardian.new(staff) }
  fab!(:chat_group) { Fabricate(:group) }

  before { SiteSetting.chat_allowed_groups = chat_group.id }

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
      context "for direct message channels" do
        fab!(:chatable) { Fabricate(:direct_message_channel) }
        fab!(:channel) { Fabricate(:chat_channel, chatable: chatable) }

        it "returns false if the user is not part of the direct message" do
          expect(guardian.can_see_chat_channel?(channel)).to eq(false)
        end

        it "returns true if the user is part of the direct message" do
          DirectMessageUser.create!(user: user, direct_message_channel_id: chatable.id)
          expect(guardian.can_see_chat_channel?(channel)).to eq(true)
        end
      end

      context "for category channel" do
        fab!(:category) { Fabricate(:category, read_restricted: true) }

        before { channel.update(chatable: category) }

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
      context "for category channel" do
        fab!(:category) { Fabricate(:category, read_restricted: true) }

        before { channel.update(chatable: category) }

        it "returns true for staff and false for regular users" do
          expect(staff_guardian.can_moderate_chat?(channel.chatable)).to eq(true)
          expect(guardian.can_moderate_chat?(channel.chatable)).to eq(false)
        end

        context "when enable_category_group_moderation is true" do
          before { SiteSetting.enable_category_group_moderation = true }

          it "returns true if the regular user is part of the reviewable_by_group for the category" do
            moderator = Fabricate(:user)
            mods = Fabricate(:group)
            mods.add(moderator)
            category.update!(reviewable_by_group: mods)
            expect(Guardian.new(Fabricate(:admin)).can_moderate_chat?(channel.chatable)).to eq(true)
            expect(Guardian.new(moderator).can_moderate_chat?(channel.chatable)).to eq(true)
          end
        end
      end

      context "for DM channel" do
        fab!(:dm_channel) { DirectMessageChannel.create! }

        before { channel.update(chatable_type: "DirectMessageType", chatable: dm_channel) }

        it "returns true for staff and false for regular users" do
          expect(staff_guardian.can_moderate_chat?(channel.chatable)).to eq(true)
          expect(guardian.can_moderate_chat?(channel.chatable)).to eq(false)
        end
      end
    end

    describe "#can_restore_chat?" do
      fab!(:message) { Fabricate(:chat_message, chat_channel: channel, user: user) }
      fab!(:chatable) { Fabricate(:category) }

      context "channel is closed" do
        before { channel.update!(status: :closed) }

        it "disallows a owner to restore" do
          expect(guardian.can_restore_chat?(message, chatable)).to eq(false)
        end

        it "allows a staff to restore" do
          expect(staff_guardian.can_restore_chat?(message, chatable)).to eq(true)
        end
      end

      context "chatable is a direct message" do
        fab!(:chatable) { DirectMessageChannel.create! }

        it "allows owner to restore" do
          expect(guardian.can_restore_chat?(message, chatable)).to eq(true)
        end

        it "allows staff to restore" do
          expect(staff_guardian.can_restore_chat?(message, chatable)).to eq(true)
        end
      end

      context "user is not owner of the message" do
        fab!(:message) { Fabricate(:chat_message, chat_channel: channel, user: Fabricate(:user)) }

        context "chatable is a category" do
          context "category is not restricted" do
            it "allows staff to restore" do
              expect(staff_guardian.can_restore_chat?(message, chatable)).to eq(true)
            end

            it "disallows any user to restore" do
              expect(guardian.can_restore_chat?(message, chatable)).to eq(false)
            end
          end

          context "category is restricted" do
            fab!(:chatable) { Fabricate(:category, read_restricted: true) }

            it "allows staff to restore" do
              expect(staff_guardian.can_restore_chat?(message, chatable)).to eq(true)
            end

            it "disallows any user to restore" do
              expect(guardian.can_restore_chat?(message, chatable)).to eq(false)
            end

            context "group moderation is enabled" do
              before { SiteSetting.enable_category_group_moderation = true }

              it "allows a group moderator to restore" do
                moderator = Fabricate(:user)
                mods = Fabricate(:group)
                mods.add(moderator)
                chatable.update!(reviewable_by_group: mods)
                expect(Guardian.new(moderator).can_restore_chat?(message, chatable)).to eq(true)
              end
            end
          end

          context "chatable is a direct message" do
            fab!(:chatable) { DirectMessageChannel.create! }

            it "allows staff to restore" do
              expect(staff_guardian.can_restore_chat?(message, chatable)).to eq(true)
            end

            it "disallows any user to restore" do
              expect(guardian.can_restore_chat?(message, chatable)).to eq(false)
            end
          end
        end
      end

      context "user is owner of the message" do
        context "chatable is a category" do
          it "allows to restore if owner can see category" do
            expect(guardian.can_restore_chat?(message, chatable)).to eq(true)
          end

          context "category is restricted" do
            fab!(:chatable) { Fabricate(:category, read_restricted: true) }

            it "disallows to restore if owner can't see category" do
              expect(guardian.can_restore_chat?(message, chatable)).to eq(false)
            end

            it "allows staff to restore" do
              expect(staff_guardian.can_restore_chat?(message, chatable)).to eq(true)
            end
          end
        end

        context "chatable is a direct message" do
          fab!(:chatable) { DirectMessageChannel.create! }

          it "allows staff to restore" do
            expect(staff_guardian.can_restore_chat?(message, chatable)).to eq(true)
          end

          it "allows owner to restore" do
            expect(guardian.can_restore_chat?(message, chatable)).to eq(true)
          end
        end
      end
    end

    describe "#can_delete_category?" do
      alias_matcher :be_able_to_delete_category, :be_can_delete_category

      let(:category) { channel.chatable }

      context "when category has no channel" do
        before do
          category.chat_channel.destroy
          category.reload
        end

        it "allows to delete the category" do
          expect(staff_guardian).to be_able_to_delete_category(category)
        end
      end

      context "when category has a channel" do
        it "does not allow to delete the category" do
          expect(staff_guardian).not_to be_able_to_delete_category(category)
        end
      end
    end
  end
end
