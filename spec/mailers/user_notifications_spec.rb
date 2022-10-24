# frozen_string_literal: true

require "rails_helper"

describe UserNotifications do
  fab!(:chatters_group) { Fabricate(:group) }
  fab!(:sender) { Fabricate(:user, group_ids: [chatters_group.id]) }
  fab!(:user) { Fabricate(:user, group_ids: [chatters_group.id]) }

  before do
    SiteSetting.chat_enabled = true
    SiteSetting.chat_allowed_groups = chatters_group.id
  end

  def refresh_auto_groups
    Group.refresh_automatic_groups!
    user.reload
    sender.reload
  end

  describe ".chat_summary" do
    context "with private channel" do
      fab!(:channel) do
        refresh_auto_groups
        DiscourseChat::DirectMessageChannelCreator.create!(
          acting_user: sender,
          target_users: [sender, user],
        )
      end

      describe "email subject" do
        it "includes the sender username in the subject" do
          expected_subject =
            I18n.t(
              "user_notifications.chat_summary.subject.direct_message",
              count: 1,
              email_prefix: SiteSetting.title,
              message_title: sender.username,
            )
          Fabricate(:chat_message, user: sender, chat_channel: channel)
          email = described_class.chat_summary(user, {})

          expect(email.subject).to eq(expected_subject)
          expect(email.subject).to include(sender.username)
        end

        it "only includes the name of the user who sent the message even if the DM has multiple participants" do
          another_participant = Fabricate(:user, group_ids: [chatters_group.id])
          Fabricate(
            :user_chat_channel_membership_for_dm,
            user: another_participant,
            chat_channel: channel,
          )
          DirectMessageUser.create!(
            direct_message_channel: channel.chatable,
            user: another_participant,
          )
          expected_subject =
            I18n.t(
              "user_notifications.chat_summary.subject.direct_message",
              count: 1,
              email_prefix: SiteSetting.title,
              message_title: sender.username,
            )
          Fabricate(:chat_message, user: sender, chat_channel: channel)
          email = described_class.chat_summary(user, {})

          expect(email.subject).to eq(expected_subject)
          expect(email.subject).to include(sender.username)
          expect(email.subject).not_to include(another_participant.username)
        end

        it "includes both channel titles when there are exactly two with unread messages" do
          another_dm_user = Fabricate(:user, group_ids: [chatters_group.id])
          refresh_auto_groups
          another_dm_user.reload
          another_channel =
            DiscourseChat::DirectMessageChannelCreator.create!(
              acting_user: user,
              target_users: [another_dm_user, user],
            )
          Fabricate(:chat_message, user: another_dm_user, chat_channel: another_channel)
          Fabricate(:chat_message, user: sender, chat_channel: channel)
          email = described_class.chat_summary(user, {})

          expect(email.subject).to include(sender.username)
          expect(email.subject).to include(another_dm_user.username)
        end

        it "displays a count when there are more than two DMs with unread messages" do
          user = Fabricate(:user, group_ids: [chatters_group.id])

          3.times do
            sender = Fabricate(:user, group_ids: [chatters_group.id])
            refresh_auto_groups
            sender.reload
            channel =
              DiscourseChat::DirectMessageChannelCreator.create!(
                acting_user: sender,
                target_users: [user, sender],
              )
            user
              .user_chat_channel_memberships
              .where(chat_channel_id: channel.id)
              .update!(following: true)

            Fabricate(:chat_message, user: sender, chat_channel: channel)
          end

          expected_count_text = I18n.t("user_notifications.chat_summary.subject.others", count: 2)

          email = described_class.chat_summary(user, {})

          expect(email.subject).to include(expected_count_text)
        end

        it "returns an email if the user is not following the direct channel" do
          user
            .user_chat_channel_memberships
            .where(chat_channel_id: channel.id)
            .update!(following: false)
          Fabricate(:chat_message, user: sender, chat_channel: channel)
          email = described_class.chat_summary(user, {})

          expect(email.to).to contain_exactly(user.email)
        end
      end
    end

    context "with public channel" do
      fab!(:channel) { Fabricate(:category_channel) }
      fab!(:chat_message) { Fabricate(:chat_message, user: sender, chat_channel: channel) }
      fab!(:user_membership) do
        Fabricate(
          :user_chat_channel_membership,
          chat_channel: channel,
          user: user,
          last_read_message_id: chat_message.id - 2,
        )
      end

      it "doesn't return an email if there are no unread mentions" do
        email = described_class.chat_summary(user, {})

        expect(email.to).to be_blank
      end

      describe "email subject" do
        context "with regular mentions" do
          before { Fabricate(:chat_mention, user: user, chat_message: chat_message) }

          it "includes the sender username in the subject" do
            expected_subject =
              I18n.t(
                "user_notifications.chat_summary.subject.chat_channel",
                count: 1,
                email_prefix: SiteSetting.title,
                message_title: channel.title(user),
              )

            email = described_class.chat_summary(user, {})

            expect(email.subject).to eq(expected_subject)
            expect(email.subject).to include(channel.title(user))
          end

          it "includes both channel titles when there are exactly two with unread mentions" do
            another_chat_channel = Fabricate(:category_channel, name: "Test channel")
            another_chat_message =
              Fabricate(:chat_message, user: sender, chat_channel: another_chat_channel)
            Fabricate(
              :user_chat_channel_membership,
              chat_channel: another_chat_channel,
              user: sender,
            )
            Fabricate(
              :user_chat_channel_membership,
              chat_channel: another_chat_channel,
              user: user,
              last_read_message_id: another_chat_message.id - 2,
            )
            Fabricate(:chat_mention, user: user, chat_message: another_chat_message)

            email = described_class.chat_summary(user, {})

            expect(email.subject).to include(channel.title(user))
            expect(email.subject).to include(another_chat_channel.title(user))
          end

          it "displays a count when there are more than two channels with unread mentions" do
            2.times do |n|
              another_chat_channel = Fabricate(:category_channel, name: "Test channel #{n}")
              another_chat_message =
                Fabricate(:chat_message, user: sender, chat_channel: another_chat_channel)
              Fabricate(
                :user_chat_channel_membership,
                chat_channel: another_chat_channel,
                user: sender,
              )
              Fabricate(
                :user_chat_channel_membership,
                chat_channel: another_chat_channel,
                user: user,
                last_read_message_id: another_chat_message.id - 2,
              )
              Fabricate(:chat_mention, user: user, chat_message: another_chat_message)
            end
            expected_count_text = I18n.t("user_notifications.chat_summary.subject.others", count: 2)

            email = described_class.chat_summary(user, {})

            expect(email.subject).to include(expected_count_text)
          end
        end

        context "with both unread DM messages and mentions" do
          before do
            refresh_auto_groups
            channel =
              DiscourseChat::DirectMessageChannelCreator.create!(
                acting_user: sender,
                target_users: [sender, user],
              )
            Fabricate(:chat_message, user: sender, chat_channel: channel)
            Fabricate(:chat_mention, user: user, chat_message: chat_message)
          end

          it "always includes the DM second" do
            expected_other_text =
              I18n.t(
                "user_notifications.chat_summary.subject.other_direct_message",
                message_title: sender.username,
              )

            email = described_class.chat_summary(user, {})

            expect(email.subject).to include(expected_other_text)
          end
        end
      end

      describe "When there are mentions" do
        before { Fabricate(:chat_mention, user: user, chat_message: chat_message) }

        describe "selecting mentions" do
          it "doesn't return an email if the user can't see chat" do
            SiteSetting.chat_allowed_groups = ""

            email = described_class.chat_summary(user, {})

            expect(email.to).to be_blank
          end

          it "doesn't return an email if the user can't see any of the included channels" do
            channel.chatable.destroy!

            email = described_class.chat_summary(user, {})

            expect(email.to).to be_blank
          end

          it "doesn't return an email if the user is not following the channel" do
            user_membership.update!(following: false)

            email = described_class.chat_summary(user, {})

            expect(email.to).to be_blank
          end

          it "doesn't return an email if the membership object doesn't exist" do
            user_membership.destroy!

            email = described_class.chat_summary(user, {})

            expect(email.to).to be_blank
          end

          it "doesn't return an email if the sender was deleted" do
            sender.destroy!

            email = described_class.chat_summary(user, {})

            expect(email.to).to be_blank
          end

          it "doesn't return an email when the user already saw the mention" do
            user_membership.update!(last_read_message_id: chat_message.id)

            email = described_class.chat_summary(user, {})

            expect(email.to).to be_blank
          end

          it "returns an email when the user haven't read a message yet" do
            user_membership.update!(last_read_message_id: nil)

            email = described_class.chat_summary(user, {})

            expect(email.to).to contain_exactly(user.email)
          end

          it "doesn't return an email when the unread count belongs to a different channel" do
            user_membership.update!(last_read_message_id: chat_message.id)
            second_channel = Fabricate(:chat_channel)
            Fabricate(
              :user_chat_channel_membership,
              chat_channel: second_channel,
              user: user,
              last_read_message_id: chat_message.id - 1,
            )

            email = described_class.chat_summary(user, {})

            expect(email.to).to be_blank
          end

          it "doesn't return an email if the message was deleted" do
            chat_message.trash!

            email = described_class.chat_summary(user, {})

            expect(email.to).to be_blank
          end

          it "returns an email when the user has unread private messages" do
            user_membership.update!(last_read_message_id: chat_message.id)
            refresh_auto_groups
            channel =
              DiscourseChat::DirectMessageChannelCreator.create!(
                acting_user: sender,
                target_users: [sender, user],
              )
            Fabricate(:chat_message, user: sender, chat_channel: channel)

            email = described_class.chat_summary(user, {})

            expect(email.to).to contain_exactly(user.email)
          end

          it "returns an email if the user read all the messages included in the previous summary" do
            user_membership.update!(
              last_read_message_id: chat_message.id,
              last_unread_mention_when_emailed_id: chat_message.id,
            )

            new_message = Fabricate(:chat_message, user: sender, chat_channel: channel)
            Fabricate(:chat_mention, user: user, chat_message: new_message)

            email = described_class.chat_summary(user, {})

            expect(email.to).to contain_exactly(user.email)
          end

          it "doesn't return an email if the mention is older than 1 week" do
            chat_message.update!(created_at: 1.5.weeks.ago)

            email = described_class.chat_summary(user, {})

            expect(email.to).to be_blank
          end
        end

        describe "mail contents" do
          it "returns an email when the user has unread mentions" do
            email = described_class.chat_summary(user, {})

            expect(email.to).to contain_exactly(user.email)
            expect(email.html_part.body.to_s).to include(chat_message.cooked_for_excerpt)

            user_avatar =
              Nokogiri::HTML5.fragment(email.html_part.body.to_s).css(".message-row img")

            expect(user_avatar.attribute("src").value).to eq(sender.small_avatar_url)
            expect(user_avatar.attribute("alt").value).to eq(sender.username)

            more_messages_channel_link =
              Nokogiri::HTML5.fragment(email.html_part.body.to_s).css(".more-messages-link")

            expect(more_messages_channel_link.attribute("href").value).to eq(chat_message.full_url)
            expect(more_messages_channel_link.text).to include(
              I18n.t("user_notifications.chat_summary.view_messages", count: 1),
            )
          end

          it "displays the sender's name when the site is configured to prioritize it" do
            SiteSetting.enable_names = true
            SiteSetting.prioritize_username_in_ux = false

            email = described_class.chat_summary(user, {})

            user_name = Nokogiri::HTML5.fragment(email.html_part.body.to_s).css(".message-row span")
            expect(user_name.text).to include(sender.name)

            user_avatar =
              Nokogiri::HTML5.fragment(email.html_part.body.to_s).css(".message-row img")

            expect(user_avatar.attribute("alt").value).to eq(sender.name)
          end

          it "displays the sender's username when the site is configured to prioritize it" do
            SiteSetting.enable_names = true
            SiteSetting.prioritize_username_in_ux = true

            email = described_class.chat_summary(user, {})

            user_name = Nokogiri::HTML5.fragment(email.html_part.body.to_s).css(".message-row span")
            expect(user_name.text).to include(sender.username)

            user_avatar =
              Nokogiri::HTML5.fragment(email.html_part.body.to_s).css(".message-row img")

            expect(user_avatar.attribute("alt").value).to eq(sender.username)
          end

          it "displays the sender's username when names are disabled" do
            SiteSetting.enable_names = false
            SiteSetting.prioritize_username_in_ux = false

            email = described_class.chat_summary(user, {})

            user_name = Nokogiri::HTML5.fragment(email.html_part.body.to_s).css(".message-row span")
            expect(user_name.text).to include(sender.username)

            user_avatar =
              Nokogiri::HTML5.fragment(email.html_part.body.to_s).css(".message-row img")

            expect(user_avatar.attribute("alt").value).to eq(sender.username)
          end

          it "displays the sender's username when the site is configured to prioritize it" do
            SiteSetting.enable_names = false
            SiteSetting.prioritize_username_in_ux = true

            email = described_class.chat_summary(user, {})

            user_name = Nokogiri::HTML5.fragment(email.html_part.body.to_s).css(".message-row span")
            expect(user_name.text).to include(sender.username)

            user_avatar =
              Nokogiri::HTML5.fragment(email.html_part.body.to_s).css(".message-row img")

            expect(user_avatar.attribute("alt").value).to eq(sender.username)
          end

          it "includes a view more link when there are more than two mentions" do
            2.times do
              msg = Fabricate(:chat_message, user: sender, chat_channel: channel)
              Fabricate(:chat_mention, user: user, chat_message: msg)
            end

            email = described_class.chat_summary(user, {})
            more_messages_channel_link =
              Nokogiri::HTML5.fragment(email.html_part.body.to_s).css(".more-messages-link")

            expect(more_messages_channel_link.attribute("href").value).to eq(chat_message.full_url)
            expect(more_messages_channel_link.text).to include(
              I18n.t("user_notifications.chat_summary.view_more", count: 1),
            )
          end

          it "doesn't repeat mentions we already sent" do
            user_membership.update!(
              last_read_message_id: chat_message.id - 1,
              last_unread_mention_when_emailed_id: chat_message.id,
            )

            new_message =
              Fabricate(:chat_message, user: sender, chat_channel: channel, cooked: "New message")
            Fabricate(:chat_mention, user: user, chat_message: new_message)

            email = described_class.chat_summary(user, {})
            body = email.html_part.body.to_s

            expect(body).not_to include(chat_message.cooked_for_excerpt)
            expect(body).to include(new_message.cooked_for_excerpt)
          end
        end
      end
    end
  end
end
