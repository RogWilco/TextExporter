'use strict';

const Snippet = {
  TYPE_UNSUPPORTED: 'unsupported',
  TYPE_TEXT: 'text',
  TYPE_RICHTEXT: 'richtext',
  TYPE_APPLESCRIPT: 'applescript',
  TYPE_SHELL_SCRIPT: 'shell_script',
  TYPE_JAVASCRIPT: 'javascript',
  TYPE_PYTHON: 'python',
  METHOD_KEYBOARD: 'keyboard',
  METHOD_CLIPBOARD: 'clipboard',
  MODE_ADAPTIVE: 'adaptive',
  MODE_CASE_SENSITIVE: 'case-sensitive',
  MODE_CASE_INSENSITIVE: 'case-insensitive',
  uuid: null,
  meta: {
    title: '',
    description: '',
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
    usageCount: 0,
  },
  type: this.TYPE_TEXT,
  input: {
    abbreviation: {
      text: null,
      mode: this.MODE_ADAPTIVE,
      overwrite: true,
      trigger: "[\\w]",
    },
    hotkey: {
      modifiers: [],
      key: null,
    },
  },
  output: {
    method: this.METHOD_KEYBOARD,
    prompt: false,
    windowFilter: {
      regex: null,
      recursive: false,
    }
  },
  data: null
};

module.exports = Snippet;
