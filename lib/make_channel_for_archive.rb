# frozen_string_literal: true

require 'fabrication'
Dir[Rails.root.join("spec/fabricators/*.rb")].each { |f| require f }

class DiscourseChat::MakeChannelForArchive
  def self.make_user
    unique_prefix = "archiveuser#{SecureRandom.hex(4)}"
    Fabricate(:user, username: unique_prefix, email: "#{unique_prefix}@testemail.com")
  end

  def self.run(user_for_membership)
    topic = nil
    chat_channel = nil

    Topic.transaction do
      topic = Fabricate(:topic, user: make_user, title: "Testing topic for chat archiving #{SecureRandom.hex(4)}")
      Fabricate(:post, topic: topic, user: topic.user, raw: "This is some cool first post for archive stuff")
      chat_channel = ChatChannel.create(
        chatable: topic, chatable_type: "Topic", name: "testing channel for archiving"
      )
    end

    puts "topic: #{topic.id}, #{topic.title}"
    puts "channel: #{chat_channel.id}, #{chat_channel.name}"

    users = [make_user, make_user, make_user]

    ChatChannel.transaction do
      start_time = Time.now

      1039.times do
        cm = ChatMessage.new(message: messages(user_for_membership).sample, user: users.sample, chat_channel: chat_channel)
        cm.cook
        cm.save!
      end

      puts "message creation done"
      puts "took #{Time.now - start_time} seconds"

      UserChatChannelMembership.create(
        chat_channel: chat_channel,
        last_read_message_id: 0,
        user: User.find_by(username: user_for_membership),
        following: true
      )
    end

    puts "channel is located at #{chat_channel.url}"
  end

  def self.messages(mention_user)
    [
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
      "Cras sit **amet** metus eget nisl accumsan ullamcorper.",
      "Vestibulum commodo justo _quis_ fringilla fringilla.",
      "Etiam malesuada erat eget aliquam interdum.",
      "Praesent mattis lacus nec ~~orci~~ [spoiler]semper[/spoiler], et fermentum augue tincidunt.",
      "Duis vel tortor suscipit justo fringilla faucibus id tempus purus.",
      "Phasellus *tempus erat* sit amet pharetra facilisis.",
      "Fusce egestas urna ut nisi ornare, ut malesuada est fermentum.",
      "Aenean ornare arcu vitae pulvinar dictum.",
      "Nam at turpis eu magna sollicitudin fringilla sed sed diam.",
      "Proin non [enim](https://discourse.org/team) nec mauris efficitur convallis.",
      "Nullam cursus lacus non libero vulputate ornare.",
      "In eleifend ante ut ullamcorper ultrices.",
      "In placerat diam sit amet nibh feugiat, in posuere metus feugiat.",
      "Nullam porttitor leo a leo `cursus`, id hendrerit dui ultrices.",
      "Pellentesque ut @#{mention_user} ut ex pulvinar pharetra sit amet ac leo.",
      "Vestibulum sit amet enim et lectus tincidunt rhoncus hendrerit in enim.",
      <<~MSG
      some bigger message

      ```ruby
      beep = \"wow\"
      puts beep
      ```
      MSG
    ]
  end
end
