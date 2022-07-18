# frozen_string_literal: true

describe UsersController do
  describe '#perform_account_activation' do
    let(:user) { Fabricate(:user, active: false) }
    let(:email_token) { Fabricate(:email_token, user: user) }
    let!(:channel) { Fabricate(:chat_channel, auto_join_users: true) }

    before do
      Jobs.run_immediately!
      UsersController.any_instance.stubs(:honeypot_or_challenge_fails?).returns(false)
      SiteSetting.send_welcome_message = false
      SiteSetting.chat_enabled = true
    end

    it 'triggers the auto-join process' do
      put "/u/activate-account/#{email_token.token}"

      expect(response.status).to eq(200)
      membership = UserChatChannelMembership.find_by(user: user, chat_channel: channel)
      expect(membership.following).to eq(true)
    end
  end
end
