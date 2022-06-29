# frozen_string_literal: true

require 'rails_helper'

describe DiscourseChat::Api::CategoryChatablesController do
  describe '#access_by_category' do
    fab!(:admin) { Fabricate(:admin) }
    fab!(:category) { Fabricate(:category) }
    fab!(:group) { Fabricate(:group) }

    before { Fabricate(:category_group, category: category, group: group) }

    context 'signed as an admin' do
      before { sign_in(admin) }

      it 'returns a list with the group names that could access a chat channel' do
        get "/chat/api/category-chatables/#{category.id}/permissions.json"

        expect(response.parsed_body['permissions']).to contain_exactly("@#{group.name}")
      end

      it "doesn't return group names from other categories" do
        category_2 = Fabricate(:category)
        group_2 = Fabricate(:group)
        Fabricate(:category_group, category: category_2, group: group_2)

        get "/chat/api/category-chatables/#{category.id}/permissions.json"

        expect(response.parsed_body['permissions']).to contain_exactly("@#{group.name}")
      end

      it "returns an empty list when the category doesn't have group permissions" do
        category_2 = Fabricate(:category)

        get "/chat/api/category-chatables/#{category_2.id}/permissions.json"

        expect(response.parsed_body['permissions']).to be_empty
      end
    end

    context 'as anon' do
      it 'returns a 404' do
        get "/chat/api/category-chatables/#{category.id}/permissions.json"

        expect(response.status).to eq(404)
      end
    end
  end
end
