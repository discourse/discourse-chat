# frozen_string_literal: true

require 'rails_helper'

describe ChatChannel do
  fab!(:group1) { Fabricate(:group) }
  fab!(:group2) { Fabricate(:group) }
  fab!(:site_channel) { Fabricate(:site_chat_channel) }
  fab!(:private_category) { Fabricate(:category, groups: [group1]) }
  fab!(:private_category_channel) { Fabricate(:chat_channel, chatable: private_category) }
  fab!(:public_topic_channel) { Fabricate(:chat_channel, chatable: Fabricate(:topic)) }
  fab!(:private_topic_channel) { Fabricate(:chat_channel, chatable: Fabricate(:topic)) }

end
