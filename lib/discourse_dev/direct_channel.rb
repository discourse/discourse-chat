# frozen_string_literal: true

require 'discourse_dev/record'
require 'faker'

module DiscourseDev
  class DirectChannel < Record
    def initialize
      super(::DirectMessageChannel, 5)
    end

    def data
      if Faker::Boolean.boolean(true_ratio: 0.5)
        admin_username = DiscourseDev::Config.new.config[:admin][:username]
        admin_user = ::User.find_by(username: admin_username)
      end

      [
        User.new.create!,
        admin_user || User.new.create!
      ]
    end

    def create!
      DiscourseChat::DirectMessageChannelCreator.create!(acting_user: data.first, target_users: data)
    end
  end
end
