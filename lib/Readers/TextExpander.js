'use strict';

const _ = require('lodash');
const fs = require('fs');
const path = require('path');
const plist = require('simple-plist');

const Index = require('../Models/Index');
const Group = require('../Models/Group');
const Snippet = require('../Models/Snippet');

const TextExpander = {
  types: {
    0: Snippet.TYPE_TEXT,
    1: Snippet.TYPE_RICHTEXT,
    2: Snippet.TYPE_APPLESCRIPT,
    3: Snippet.TYPE_SHELL_SCRIPT,
  },

  modes: {
    0: Snippet.MODE_CASE_SENSITIVE,
    1: Snippet.MODE_CASE_INSENSITIVE,
    2: Snippet.MODE_ADAPTIVE,
  },

  read: function(settingsPath) {
    let indexFile = settingsPath;

    if(fs.statSync(settingsPath).isDirectory()) {
      indexFile = path.join(settingsPath, this.getIndexFilename(settingsPath));
    }

    return this.parseIndex(indexFile);
  },

  parseIndex: function(indexFile) {
    const settingsDir = path.dirname(indexFile);
    const indexPlist = plist.readFileSync(indexFile);
    const indexData = _.cloneDeep(Index);

    indexPlist.groupsTE5.forEach((groupPlist) => {
      const groupFile = path.join(settingsDir, this.getGroupFilename(settingsDir, groupPlist.uuidString));
      const groupData = _.cloneDeep(Group);

      groupData.uuid = groupPlist.uuidString;
      groupData.meta.title = groupPlist.name;
      groupData.snippets = this.parseGroup(groupFile);

      indexData.groups.push(groupData);
    });

    return indexData;
  },

  parseGroup: function(groupFile) {
    const groupPlist = plist.readFileSync(groupFile);
    const snippets = [];

    groupPlist.snippetPlists.forEach((snippetPlist) => {
      const snippetData = _.cloneDeep(Snippet);

      snippetData.uuid = snippetPlist.uuidString;
      snippetData.meta.title = snippetPlist.label;
      snippetData.meta.created = snippetPlist.creationDate;
      snippetData.meta.updated = snippetPlist.modificationDate;
      snippetData.type = this.transposeType(snippetPlist.snippetType);
      snippetData.input.abbreviation.text = snippetPlist.abbreviation;
      snippetData.input.abbreviation.mode = this.transposeMode(snippetPlist.abbreviationMode);
      snippetData.data = snippetPlist.plainText;

      snippets.push(snippetData);
    });

    return snippets;
  },

  getIndexFilename: function(settingsPath) {
    const indexPattern = new RegExp('^index_[A-F\d]{8}-[A-F\d]{4}-4[A-F\d]{3}-[89AB][A-F\d]{3}-[A-F\d]{12}_.{10}\.xml$', 'i');
    const indexFiles = fs.readdirSync(settingsPath).filter((filename) => filename.match(patternIndex));

    return _.max(indexFiles, (file) => {
      return fs.statSync(path.join(indexPath, file)).mtime;
    })
  },

  getGroupFilename: function(settingsPath, groupUuid) {
    const groupPattern = new RegExp('^group_' + groupUuid + '_.{10}\.xml$', 'i');
    const groupFiles = fs.readdirSync(settingsPath).filter((filename) => filename.match(groupPattern));

    // If there are multiple files, select the newest.
    return _.max(groupFiles, (file) => {
      return fs.statSync(path.join(settingsPath, file)).mtime;
    })
  },

  transposeType: function(incomingType) {
    return this.types[incomingType];
  },

  transposeMode: function(incomingMode) {
    return this.modes[incomingMode];
  },
};

module.exports = TextExpander;
