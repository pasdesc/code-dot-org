class LevelLoader
  def self.load_custom_levels
    level_index = Level.includes(:game).to_a.index_by(&:name)
    levels = Dir.glob(Rails.root.join('config/scripts/**/*.level')).sort.map do |path|
      load_custom_level(path, level_index)
    end.select(&:changed?)
    import levels
  end

  def self.import(levels)
    # activerecord-import doesn't run callbacks, so run them manually before the bulk import.
    levels.map do |level|
      level.run_callbacks(:validate)
      level.run_callbacks(:save) { level.run_callbacks(:create) }
    end
    Level.import levels, validate: true,
      on_duplicate_key_update: Level.columns.map(&:name).tap{|x|x.delete('id')}
    levels
  end

  def self.level_file_path(name)
    level_paths = Dir.glob(Rails.root.join("config/scripts/**/#{name}.level"))
    raise("Multiple .level files for '#{name}' found: #{level_paths}") if level_paths.many?
    level_paths.first || Rails.root.join("config/scripts/levels/#{name}.level")
  end

  def self.load_custom_level(level_path, level_index = {})
    name = File.basename(level_path, File.extname(level_path))
    level = (level_index[name] || Level.new(name: name))
    # Only reload level data when file contents change
    level_data = File.read(level_path)
    level.md5 = Digest::MD5.hexdigest(level_data)
    level = load_custom_level_xml(level_data, level) if level.changed?
    level
  rescue Exception => e
    # print filename for better debugging
    new_e = Exception.new("in level: #{level_path}: #{e.message}")
    new_e.set_backtrace(e.backtrace)
    raise new_e
  end

  def self.load_custom_level_xml(xml, level)
    xml_node = Nokogiri::XML(xml, &:noblanks)
    level = level.with_type(xml_node.root.name)
    # Delete entries for all other attributes that may no longer be specified in the xml.
    # Fixes issue #75863324 (delete removed level properties on import)
    level.send(:write_attribute, 'properties', {})
    level.assign_attributes(level.load_level_xml(xml_node))
    level
  end

  def self.update_unplugged
    # Unplugged level data is specified in 'unplugged.en.yml' file
    unplugged = I18n.t('data.unplugged')
    unplugged_game = Game.find_by(name: 'Unplugged')
    unplugged.map do |name,_|
      Level.where(name: name).first_or_create.update(
        type: 'Unplugged',
        game: unplugged_game
      )
    end
  end
end
